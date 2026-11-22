import { useEffect, useRef, useState, type FormEvent } from 'react'
import { site } from '../content'
import { POPUP_BUTTON, POPUP_BUTTON_FILLED } from '../lib/popup'
import { clearCheck, humanCheck, loadTurnstile } from '../lib/turnstile'

const { endpoint, turnstileSiteKey } = site.forms

type Status = 'idle' | 'sending' | 'sent' | 'failed'

const LABEL_TEXT = 'font-ddc text-[14px] tracking-[0.12em] uppercase phone-short:leading-[1.2]'
const LABEL = `block ${LABEL_TEXT}`
// phone-short: short phone screens (iPhone SE size, see index.css) get a little less padding.
const FIELD =
  'contact-field mt-1.5 block w-full border-2 border-sand bg-transparent px-3 py-2.5 font-text text-[17px] leading-[1.35] tracking-normal normal-case text-sand outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand phone-short:mt-1 phone-short:py-[7px]'

/**
 * The CONTACT popup's form: name, email and message, sent through the EDF form relay (form-relay/, a
 * Cloudflare Worker that emails Jim) with a Turnstile bot check and a hidden "website" field that
 * only bots fill in. Jim's address isn't on the site anywhere (2026-11-21), so a failed send just
 * asks to try again.
 */
export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const form = useRef<HTMLFormElement>(null)
  const check = useRef<HTMLDivElement>(null)
  const note = useRef<HTMLParagraphElement>(null)
  // Closed mid-send: take the check down with it.
  useEffect(() => {
    const box = check.current
    return () => clearCheck(box)
  }, [])

  // A failed send's note sits under SEND. On the shortest screens it can land below the popup's
  // edge, so the popup's contents scroll just far enough to show it.
  useEffect(() => {
    if (status !== 'failed' || !note.current) return
    const body = note.current.closest('.popup-body')
    if (!body) return
    const over = note.current.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom
    if (over > 0) body.scrollTop += over + 12
  }, [status])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setStatus('sending')
    try {
      data.set('_form', 'Portfolio contact')
      data.set('cf-turnstile-response', await humanCheck(check.current!, turnstileSiteKey, 'dark'))
      // Sent URL-encoded (a plain form post): read the same way from every browser.
      const body = new URLSearchParams([...data].flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : [])))
      const res = await fetch(endpoint, { method: 'POST', body, headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      form.current?.reset()
      setStatus('sent')
    } catch {
      setStatus('failed')
    } finally {
      clearCheck(check.current)
    }
  }

  // Sent: just the thanks (no "Send another", Jim 2026-11-22). Closing and reopening CONTACT
  // brings back an empty form.
  if (status === 'sent') {
    return (
      <div className="mx-auto mt-8 max-w-[460px]">
        <p role="status" className="text-[20px] leading-[1.4] text-balance max-sm:text-[18px]">
          Thanks! Your message is on its way, and I'll get back to you soon.
        </p>
      </div>
    )
  }

  return (
    <form
      ref={form}
      onSubmit={onSubmit}
      onFocus={() => {
        loadTurnstile().catch(() => {})
      }}
      className="mx-auto mt-8 flex min-h-0 w-full max-w-[460px] flex-col gap-4 text-left max-sm:mt-6 max-sm:gap-3 phone-short:mt-4 phone-short:gap-2"
    >
      <label className={LABEL}>
        Name
        <input name="Name" type="text" autoComplete="name" maxLength={200} className={FIELD} />
      </label>
      {/* Email is the one required field (the asterisk; the browser says so for screen readers). */}
      <label className={LABEL}>
        Email
        <span aria-hidden="true">*</span>
        <input name="Email" type="email" autoComplete="email" required maxLength={254} className={FIELD} />
      </label>
      {/* The message box: five lines tall when there's room. When the screen is short it's what gives
          up height, down to about three lines (the label's min height), so the popup fits on a phone
          without scrolling. The form, this label and the popup's contents are flex columns that may
          shrink; everything else keeps its size. */}
      <label className={`${LABEL_TEXT} flex min-h-[120px] flex-col phone-short:min-h-[100px]`}>
        Message
        <textarea name="Message" rows={5} maxLength={5000} className={`${FIELD} min-h-0 flex-auto resize-y`} />
      </label>
      {/* Bots fill this in; people never see or reach it. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {/* Cloudflare's bot check: empty unless it needs a click. */}
      <div ref={check} className="empty:hidden" />
      {/* SEND, centered, with any note about the send under it. */}
      <div className="mt-2 flex shrink-0 flex-col items-center text-center phone-short:mt-1">
        <button type="submit" disabled={status === 'sending'} className="group grid cursor-pointer place-items-center outline-none disabled:cursor-wait">
          <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_FILLED} min-w-[120px] px-6`}>{status === 'sending' ? 'Sending…' : 'Send'}</span>
        </button>
        <p
          ref={note}
          role={status === 'failed' ? 'alert' : 'status'}
          className="mt-3 font-text text-[16px] leading-[1.35] tracking-normal text-balance normal-case empty:mt-0 phone-short:mt-1.5"
        >
          {status === 'failed' && "That didn't send. Please try again in a moment."}
        </p>
      </div>
    </form>
  )
}
