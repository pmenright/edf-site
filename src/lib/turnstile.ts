/**
 * Cloudflare Turnstile, the bot check on the site's contact form (see form-relay/ for the other end).
 * The script loads the first time someone starts on the form, so other visitors never fetch it. Each
 * send renders a fresh check that stays invisible unless Cloudflare wants a click; its token goes
 * along with the message, and the relay verifies it with Cloudflare before emailing Jim.
 */

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string
  reset(widgetId: string): void
  remove(widgetId: string): void
}

/** A send that failed, with a short reason (shown on the dev preview, see ContactForm.tsx). */
export class SendError extends Error {}

declare global {
  interface Window {
    turnstile?: Turnstile
    edfTurnstileLoaded?: () => void
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=edfTurnstileLoaded'
/** Long enough to finish a click-through challenge; the send fails only if it never answers. */
const TIMEOUT = 120_000

let loading: Promise<Turnstile> | null = null

export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<Turnstile>((resolve, reject) => {
    window.edfTurnstileLoaded = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new SendError('bot check script did not load (blocked?)'))
    }
    document.head.appendChild(script)
  })
  return loading
}

const widgets = new WeakMap<HTMLElement, string>()

/** Tries the check gets before the send gives up (Cloudflare's own advice: a hiccup usually clears). */
const TRIES = 3

/**
 * Runs the check in `box` and resolves with its token. A check that hits an error (they happen now
 * and then, more often in phone browsers) is run again, up to TRIES times, before the send fails;
 * the failure carries Cloudflare's error code.
 */
export async function humanCheck(box: HTMLElement, sitekey: string, theme: 'light' | 'dark'): Promise<string> {
  const turnstile = await loadTurnstile()
  clearCheck(box)
  return new Promise<string>((resolve, reject) => {
    let tries = 1
    const fail = (reason: string) => {
      window.clearTimeout(timer)
      reject(new SendError(reason))
    }
    const timer = window.setTimeout(() => fail('bot check never answered'), TIMEOUT)
    const id = turnstile.render(box, {
      sitekey,
      theme,
      appearance: 'interaction-only',
      // Retries are ours (below), so each one counts.
      retry: 'never',
      callback: (token: string) => {
        window.clearTimeout(timer)
        resolve(token)
      },
      'error-callback': (code: string) => {
        if (tries >= TRIES) {
          fail(`bot check error ${code || '(no code)'}, ${tries} tries`)
        } else {
          tries++
          window.setTimeout(() => turnstile.reset(id), 800)
        }
        return true // handled: Turnstile doesn't throw it as well
      },
      'timeout-callback': () => fail('bot check wanted a click and timed out'),
      'unsupported-callback': () => fail('bot check: this browser is not supported'),
    })
    widgets.set(box, id)
  })
}

/** Takes the check out of `box` (tokens are single use, so each send gets a new one). */
export function clearCheck(box: HTMLElement | null) {
  const id = box && widgets.get(box)
  if (!box || !id) return
  widgets.delete(box)
  window.turnstile?.remove(id)
}
