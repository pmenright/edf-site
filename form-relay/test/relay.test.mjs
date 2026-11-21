// Tests for the form relay (node --test form-relay/test). Cloudflare is mocked: Turnstile's
// siteverify (global fetch) and the email binding.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import worker from '../src/index.js'

const ORIGIN = 'https://enrightdesignfoundry.com'
let sent, verifyCalls, verifyResult, realFetch, errors, realError

function env(extra = {}) {
  return {
    TURNSTILE_SECRET: 'secret-123',
    FROM_ADDRESS: 'website@forms.enrightdesignfoundry.com',
    FROM_NAME: 'EDF website',
    MAIL_TO: 'owner@example.com',
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
    EMAIL: { send: async (m) => { sent.push(m); return { messageId: 'x' } } },
    ...extra,
  }
}

function post(fields, { origin = ORIGIN, json = false, headers = {} } = {}) {
  let body
  const h = { Origin: origin, 'CF-Connecting-IP': '203.0.113.7', ...headers }
  if (json) {
    body = JSON.stringify(fields)
    h['Content-Type'] = 'application/json'
  } else {
    body = new FormData()
    for (const [k, v] of Object.entries(fields)) body.append(k, v)
  }
  return new Request('https://edf-forms.example.workers.dev/', { method: 'POST', body, headers: h })
}

const good = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello!\nTwo lines.', _form: 'Portfolio contact', 'cf-turnstile-response': 'tok', website: '' }

beforeEach(() => {
  sent = []
  verifyCalls = []
  verifyResult = { success: true }
  realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    verifyCalls.push({ url, body: Object.fromEntries(new URLSearchParams(init.body)) })
    return new Response(JSON.stringify(verifyResult), { headers: { 'Content-Type': 'application/json' } })
  }
  errors = []
  realError = console.error
  console.error = (...a) => errors.push(a.join(' '))
})
afterEach(() => {
  globalThis.fetch = realFetch
  console.error = realError
})

test('preflight from the site gets CORS headers', async () => {
  const r = await worker.fetch(new Request('https://x/', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env())
  assert.equal(r.status, 204)
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN)
})

test('other sites are turned away, without CORS headers', async () => {
  const r = await worker.fetch(post(good, { origin: 'https://evil.example' }), env())
  assert.equal(r.status, 403)
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(sent.length, 0)
  assert.equal(verifyCalls.length, 0)
})

test('GET is not allowed', async () => {
  const r = await worker.fetch(new Request('https://x/', { headers: { Origin: ORIGIN } }), env())
  assert.equal(r.status, 405)
})

test('a good message is checked with Turnstile and emailed', async () => {
  const r = await worker.fetch(post(good), env())
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { ok: true })
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.equal(verifyCalls.length, 1)
  assert.equal(verifyCalls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
  assert.deepEqual(verifyCalls[0].body, { secret: 'secret-123', response: 'tok', remoteip: '203.0.113.7' })
  assert.equal(sent.length, 1)
  const m = sent[0]
  assert.deepEqual(m.from, { email: 'website@forms.enrightdesignfoundry.com', name: 'EDF website' })
  assert.equal(m.to, 'owner@example.com')
  assert.equal(m.subject, 'Portfolio contact: message from Ada Lovelace')
  assert.equal(m.replyTo, 'ada@example.com')
  assert.match(m.text, /^name:\nAda Lovelace\n\nemail:\nada@example.com\n\nmessage:\nHello!\nTwo lines\./)
  assert.match(m.text, /Sent from the Portfolio contact form on enrightdesignfoundry\.com\.$/)
  assert.doesNotMatch(m.text, /tok|website|_form/)
})

test('multipart as Safari / Chrome send it (mixed-case boundary) is read', async () => {
  // The bug that broke the live forms: the boundary was lowercased before parsing.
  const boundary = '----WebKitFormBoundaryAbC123xYz789QwE'
  const part = (name, value) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  const body = part('Name', 'Ada') + part('Email', 'ada@example.com') + part('Message', 'Hi') + part('cf-turnstile-response', 'tok') + part('website', '') + `--${boundary}--\r\n`
  const req = new Request('https://x/', { method: 'POST', body, headers: { Origin: ORIGIN, 'Content-Type': `multipart/form-data; boundary=${boundary}` } })
  const r = await worker.fetch(req, env())
  assert.equal(r.status, 200)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].replyTo, 'ada@example.com')
})

test('a plain URL-encoded form post (what the site sends) works', async () => {
  const body = new URLSearchParams(good)
  const r = await worker.fetch(new Request('https://x/', { method: 'POST', body, headers: { Origin: ORIGIN } }), env())
  assert.equal(r.status, 200)
  assert.equal(sent.length, 1)
  assert.match(sent[0].text, /message:\nHello!\nTwo lines\./)
})

test('a failed bot check logs Cloudflare\'s reason, not the message', async () => {
  verifyResult = { success: false, 'error-codes': ['invalid-input-secret'] }
  await worker.fetch(post(good), env())
  assert.deepEqual(errors, ['turnstile rejected invalid-input-secret'])
})

test('JSON posts work too', async () => {
  const r = await worker.fetch(post(good, { json: true }), env())
  assert.equal(r.status, 200)
  assert.equal(sent.length, 1)
})

test('Nsyte-style labels: name found by label, reply-to from _replyto', async () => {
  const r = await worker.fetch(post({ 'Name': 'Bo', 'Email Address': 'bo@example.com', "What's on your mind?": 'Hi', _replyto: 'bo@example.com', _form: 'Nsyte contact', 'cf-turnstile-response': 'tok' }), env())
  assert.equal(r.status, 200)
  assert.equal(sent[0].subject, 'Nsyte contact: message from Bo')
  assert.equal(sent[0].replyTo, 'bo@example.com')
  assert.equal((sent[0].text.match(/bo@example\.com/g) || []).length, 1, 'the address shows once (its own field), not twice')
})

test('no Turnstile token: refused, nothing sent', async () => {
  const { ['cf-turnstile-response']: _, ...rest } = good
  const r = await worker.fetch(post(rest), env())
  assert.equal(r.status, 400)
  assert.equal(sent.length, 0)
})

test('Turnstile says no: refused, nothing sent', async () => {
  verifyResult = { success: false, 'error-codes': ['invalid-input-response'] }
  const r = await worker.fetch(post(good), env())
  assert.equal(r.status, 403)
  assert.equal(sent.length, 0)
})

test('Turnstile unreachable: a retryable error', async () => {
  globalThis.fetch = async () => { throw new Error('down') }
  const r = await worker.fetch(post(good), env())
  assert.equal(r.status, 502)
  assert.equal(sent.length, 0)
})

test('honeypot filled: answered ok, nothing checked or sent', async () => {
  const r = await worker.fetch(post({ ...good, website: 'http://spam.example' }), env())
  assert.equal(r.status, 200)
  assert.equal(sent.length, 0)
  assert.equal(verifyCalls.length, 0)
})

test('header injection in the name stays on one line', async () => {
  await worker.fetch(post({ ...good, name: 'Eve\r\nBcc: victim@example.com' }), env())
  assert.equal(sent[0].subject, 'Portfolio contact: message from Eve Bcc: victim@example.com')
  assert.doesNotMatch(sent[0].subject, /[\r\n]/)
})

test('a bad reply-to address is left off', async () => {
  await worker.fetch(post({ ...good, email: 'not an email' }), env())
  assert.equal(sent.length, 1)
  assert.equal(sent[0].replyTo, undefined)
})

test('oversized fields and posts are refused', async () => {
  let r = await worker.fetch(post({ ...good, message: 'x'.repeat(5001) }), env())
  assert.equal(r.status, 400)
  const many = { ...good }
  for (let i = 0; i < 25; i++) many[`f${i}`] = 'v'
  r = await worker.fetch(post(many), env())
  assert.equal(r.status, 400)
  r = await worker.fetch(post({ ...good, message: 'x'.repeat(70000) }, { json: true }), env())
  assert.equal(r.status, 400)
  assert.equal(sent.length, 0)
})

test('empty message (only internal fields) is refused', async () => {
  const r = await worker.fetch(post({ 'cf-turnstile-response': 'tok', _form: 'x', name: '   ' }), env())
  assert.equal(r.status, 400)
  assert.equal(sent.length, 0)
})

test('unsupported body type is refused', async () => {
  const r = await worker.fetch(new Request('https://x/', { method: 'POST', body: 'hello', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' } }), env())
  assert.equal(r.status, 400)
})

test('send failure: 502, and only the error code is logged', async () => {
  const e = env({ EMAIL: { send: async () => { const err = new Error('nope: Ada Lovelace said Hello'); err.code = 'E_DELIVERY_FAILED'; throw err } } })
  const r = await worker.fetch(post(good), e)
  assert.equal(r.status, 502)
  assert.deepEqual(errors, ['send failed E_DELIVERY_FAILED'])
})

test('missing configuration: 500, nothing sent', async () => {
  const r = await worker.fetch(post(good), env({ TURNSTILE_SECRET: '' }))
  assert.equal(r.status, 500)
  assert.equal(sent.length, 0)
})
