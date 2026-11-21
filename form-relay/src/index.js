/*
 * EDF form relay: a Cloudflare Worker that takes the site's contact forms and emails them to Jim.
 *
 * - Only accepts posts from the site's own pages (ALLOWED_ORIGINS).
 * - Each post must carry a Cloudflare Turnstile token (the bot check), verified with Cloudflare before
 *   anything is sent. A hidden "website" field catches simple bots: if it's filled in, the post is
 *   quietly dropped (and still answered "ok", so the bot learns nothing).
 * - Sends a plain-text email through Cloudflare Email Routing to Jim's verified address, from an
 *   address on the forms subdomain, with Reply-To set to the visitor's email.
 * - Nothing is stored, and message contents are never logged. On a sending failure, only Cloudflare's
 *   error code is logged.
 *
 * Settings live in wrangler.jsonc (vars) plus one secret, TURNSTILE_SECRET (`npx wrangler secret put`).
 */

/** Fields the forms send for the relay's own use, never shown in the email. */
const INTERNAL = new Set(['cf-turnstile-response', 'website', '_form', '_replyto'])

const LIMITS = {
  /** The whole post, in bytes. */
  body: 64 * 1024,
  fields: 20,
  key: 100,
  value: 5000,
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const origin = request.headers.get('Origin') || ''
    const okOrigin = allowed.includes(origin)
    const cors = okOrigin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' }
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
      })

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      })
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' })
    if (!okOrigin) return reply(403, { ok: false, error: 'origin' })
    if (!env.TURNSTILE_SECRET || !env.FROM_ADDRESS || !env.TO_ADDRESS || !env.EMAIL) {
      console.error('form relay is not configured')
      return reply(500, { ok: false, error: 'not-configured' })
    }

    let fields
    try {
      fields = await readFields(request)
    } catch {
      return reply(400, { ok: false, error: 'bad-request' })
    }

    // The honeypot: people never see this field, so anything in it came from a bot.
    if ((fields.get('website') || '').trim()) return reply(200, { ok: true })

    const token = fields.get('cf-turnstile-response')
    if (!token) return reply(400, { ok: false, error: 'captcha' })
    let human
    try {
      human = await verify(token, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP'))
    } catch {
      return reply(502, { ok: false, error: 'captcha-unavailable' })
    }
    if (!human) return reply(403, { ok: false, error: 'captcha' })

    const shown = [...fields].filter(([key, value]) => !INTERNAL.has(key) && value.trim())
    if (!shown.length) return reply(400, { ok: false, error: 'empty' })

    const name = oneLine(valueWhere(shown, (k) => /name/i.test(k)) || '')
    const formName = oneLine(fields.get('_form') || 'Website')
    const replyTo = (fields.get('_replyto') || valueWhere(shown, (k) => /e-?mail/i.test(k)) || '').trim()

    const text = [
      ...shown.map(([key, value]) => `${key}:\n${value.trim()}`),
      `--\nSent from the ${formName} form on ${origin.replace(/^https?:\/\//, '')}.`,
    ].join('\n\n')

    const message = {
      from: { email: env.FROM_ADDRESS, name: env.FROM_NAME || 'Website form' },
      to: env.TO_ADDRESS,
      subject: clip(`${formName}: message${name ? ` from ${name}` : ''}`, 150),
      text,
    }
    if (EMAIL_RE.test(replyTo) && replyTo.length <= 254) message.replyTo = replyTo

    try {
      await env.EMAIL.send(message)
    } catch (e) {
      // The error code only: never the message itself.
      console.error('send failed', (e && e.code) || (e && e.name) || 'unknown')
      return reply(502, { ok: false, error: 'send' })
    }
    return reply(200, { ok: true })
  },
}

/** The post's text fields, as a Map (form data or JSON). Throws on anything malformed or too big. */
async function readFields(request) {
  const declared = Number(request.headers.get('Content-Length') || 0)
  if (declared > LIMITS.body) throw new Error('too big')
  const raw = await request.arrayBuffer()
  if (raw.byteLength > LIMITS.body) throw new Error('too big')
  // The type as sent: a multipart boundary is case-sensitive (browsers use mixed case, like
  // ----WebKitFormBoundaryAbC123), so only the copy used for matching is lowercased.
  const sentType = request.headers.get('Content-Type') || ''
  const type = sentType.toLowerCase()

  let entries
  if (type.includes('application/json')) {
    const data = JSON.parse(new TextDecoder().decode(raw))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object')
    entries = Object.entries(data)
  } else if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    const form = await new Response(raw, { headers: { 'Content-Type': sentType } }).formData()
    entries = [...form.entries()]
  } else {
    throw new Error('unsupported type')
  }

  const fields = new Map()
  for (const [key, raw] of entries) {
    if (typeof raw !== 'string') continue // files and anything else: ignored
    const value = raw.replace(/\r\n?/g, '\n') // form posts send line breaks as \r\n
    if (key.length > LIMITS.key || value.length > LIMITS.value) throw new Error('field too long')
    fields.set(oneLine(key), value)
  }
  if (fields.size > LIMITS.fields) throw new Error('too many fields')
  return fields
}

/** Asks Cloudflare whether the Turnstile token is good. */
async function verify(token, secret, ip) {
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  const res = await fetch(SITEVERIFY, { method: 'POST', body })
  if (!res.ok) throw new Error(`siteverify ${res.status}`)
  const data = await res.json()
  // Why a check failed (Cloudflare's codes only, nothing from the message), for `wrangler tail`.
  if (data.success !== true) console.error('turnstile rejected', (data['error-codes'] || []).join(',') || 'no code')
  return data.success === true
}

function valueWhere(entries, test) {
  const hit = entries.find(([key]) => test(key))
  return hit ? hit[1] : ''
}

/** No line breaks (they'd break an email header), runs of space collapsed. */
function oneLine(s) {
  return String(s).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function clip(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
