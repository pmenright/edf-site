import { useRef } from 'react'
import { site } from '../content'
import { useCopy } from '../lib/copy'
import { POPUP_BUTTON, POPUP_BUTTON_FILLED, POPUP_BUTTON_OUTLINED } from '../lib/popup'
import { Popup } from './Popup'

const mail = `mailto:${site.email}`

/**
 * CONTACT popup (opened from the rail's CONTACT, see src/lib/contact.ts): the email address as a
 * mail link, COPY (copies it) and EMAIL (opens the visitor's mail app). The box itself is Popup.tsx.
 */
export function ContactDialog({ onClose }: { onClose: () => void }) {
  // Start on the heading, so a stray Enter doesn't open the mail app; Tab goes on to the address.
  const heading = useRef<HTMLHeadingElement>(null)
  const { copied, copy: copyTo } = useCopy(site.email)
  const copy = () => copyTo(heading.current?.parentElement)

  return (
    <Popup
      labelledBy="contact-title"
      describedBy="contact-blurb"
      initialFocus={heading}
      panelClassName="max-w-[640px] px-10 pt-14 pb-11 max-sm:px-6 max-sm:pt-12 max-sm:pb-9"
      onClose={onClose}
    >
      {() => (
        <>
          <h2 id="contact-title" ref={heading} tabIndex={-1} className="text-[30px] leading-[1.15] text-balance outline-none max-sm:text-[24px]">
            How can I work with you?
          </h2>
          <p id="contact-blurb" className="mx-auto mt-4 max-w-[28em] text-[18px] leading-[1.4] text-balance max-sm:text-[16px]">
            Send me an email and we can get started.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
            <a
              href={mail}
              className="text-[20px] tracking-[0.04em] underline decoration-sand/40 decoration-2 underline-offset-[6px] transition-colors hover:decoration-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sand max-sm:text-[18px]"
            >
              {site.email}
            </a>
            <div className="flex gap-3">
              <button type="button" onClick={copy} aria-label="Copy email address" className="group grid cursor-pointer place-items-center outline-none">
                <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_OUTLINED} px-5`}>
                  {/* Both words in the same spot, so the button keeps its width when the label changes. */}
                  <span className="grid">
                    <span className={`col-start-1 row-start-1 ${copied ? 'invisible' : ''}`}>Copy</span>
                    <span className={`col-start-1 row-start-1 ${copied ? '' : 'invisible'}`} aria-hidden="true">
                      Copied
                    </span>
                  </span>
                </span>
              </button>
              <a href={mail} aria-label={`Email ${site.email}`} className="group grid cursor-pointer place-items-center outline-none">
                <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_FILLED} px-5`}>Email</span>
              </a>
            </div>
          </div>
          <p role="status" className="sr-only">
            {copied ? 'Email address copied' : ''}
          </p>
        </>
      )}
    </Popup>
  )
}
