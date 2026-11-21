import { useEffect, useRef, useState, type FormEvent } from 'react'
import { site } from '../content'
import { POPUP_BUTTON, POPUP_BUTTON_FILLED, POPUP_BUTTON_OUTLINED } from '../lib/popup'
import { clearCheck, humanCheck, loadTurnstile } from '../lib/turnstile'

const { endpoint, turnstileSiteKey } = site.forms
/** The relay is set up (forms in site.json). Until then, SEND opens the visitor's email app instead. */
const live = Boolean(endpoint && turnstileSiteKey)

type Status = 'idle' | 'sending' | 'sent' | 'failed' | 'mailed'

const LABEL = 'block font-ddc text-[14px] tracking-[0.12em] uppercase'
const FIELD =
  'contact-field mt-1.5 block w-full border-2 border-sand bg-transparent px-3 py-2.5 font-text text-[17px] leading-[1.35] tracking-normal normal-case text-sand outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand'

/**
 * The CONTACT popup's form: name, email and message, sent through the EDF form relay (form-relay/, a
 * Cloudflare Worker that emails Jim) with a Turnstile bot check and a hidden "website" field that
 * only bots fill in. Before the relay is set up, SEND opens the visitor's email app with the message
 * already written.
 */
export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const form = useRef<HTMLFormElement>(null)
  const check = useRef<HTMLDivElement>(null)
  // Closed mid-send: take the check down with it.
  useEffect(() => {
    const box = check.current
    return () => clearCheck(box)
  }, [])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (!live) {
      const text = (key: string) => String(data.get(key) || '').trim()
      const subject = `Portfolio message${text('Name') ? ` from ${text('Name')}` : ''}`
      const body = `${text('Message')}\n\n${text('Name')}\n${text('Email')}`.trim()
      window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      setStatus('mailed')
      return
    }
    setStatus('sending')
    try {
      data.set('_form', 'Portfolio contact')
      data.set('cf-turnstile-response', await humanCheck(check.current!, turnstileSiteKey, 'dark'))
      const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      form.current?.reset()
      setStatus('sent')
    } catch {
      setStatus('failed')
    } finally {
      clearCheck(check.current)
    }
  }

  if (status === 'sent') {
    return (
      <div className="mx-auto mt-8 max-w-[460px]">
        <p role="status" className="text-[20px] leading-[1.4] text-balance max-sm:text-[18px]">
          Thanks! Your message is on its way, and I'll get back to you soon.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="group mt-6 inline-grid cursor-pointer place-items-center outline-none">
          <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_OUTLINED} px-5`}>Send another</span>
        </button>
      </div>
    )
  }

  return (
    <form
      ref={form}
      onSubmit={onSubmit}
      onFocus={() => {
        if (live) loadTurnstile().catch(() => {})
      }}
      className="mx-auto mt-8 grid max-w-[460px] gap-4 text-left"
    >
      <label className={LABEL}>
        Name
        <input name="Name" type="text" autoComplete="name" maxLength={200} className={FIELD} />
      </label>
      <label className={LABEL}>
        Email
        <input name="Email" type="email" autoComplete="email" required maxLength={254} className={FIELD} />
      </label>
      <label className={LABEL}>
        Message
        <textarea name="Message" required rows={5} maxLength={5000} className={`${FIELD} resize-y`} />
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
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" disabled={status === 'sending'} className="group grid cursor-pointer place-items-center outline-none disabled:cursor-wait">
          <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_FILLED} min-w-[120px] px-6`}>{status === 'sending' ? 'Sending…' : 'Send'}</span>
        </button>
        <p role={status === 'failed' ? 'alert' : 'status'} className="min-w-0 flex-1 font-text text-[16px] leading-[1.35]">
          {status === 'failed' && "That didn't send. Please try again, or email me directly below."}
          {status === 'mailed' && 'Your email app should open with your message ready to send.'}
        </p>
      </div>
    </form>
  )
}
