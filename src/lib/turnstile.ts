/**
 * Cloudflare Turnstile, the bot check on the site's contact form (see form-relay/ for the other end).
 * The script loads the first time someone starts on the form, so other visitors never fetch it. Each
 * send renders a fresh check that stays invisible unless Cloudflare wants a click; its token goes
 * along with the message, and the relay verifies it with Cloudflare before emailing Jim.
 */

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string
  remove(widgetId: string): void
}

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
      reject(new Error('turnstile did not load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

const widgets = new WeakMap<HTMLElement, string>()

/** Runs the check in `box` and resolves with its token. */
export async function humanCheck(box: HTMLElement, sitekey: string, theme: 'light' | 'dark'): Promise<string> {
  const turnstile = await loadTurnstile()
  clearCheck(box)
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('turnstile timed out')), TIMEOUT)
    const id = turnstile.render(box, {
      sitekey,
      theme,
      appearance: 'interaction-only',
      callback: (token: string) => {
        window.clearTimeout(timer)
        resolve(token)
      },
      'error-callback': () => {
        window.clearTimeout(timer)
        reject(new Error('turnstile error'))
      },
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
