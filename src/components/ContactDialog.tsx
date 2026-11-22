import { useRef } from 'react'
import { ContactForm } from './ContactForm'
import { Popup } from './Popup'

/**
 * CONTACT popup (opened from every CONTACT button, see src/lib/contact.ts): the heading, a line in
 * League Spartan, and the message form (ContactForm.tsx). The box itself is Popup.tsx.
 *
 * On phones it all fits on one screen without scrolling (Jim, 2026-11-22): tighter spacing, and the
 * message box gives up height to fit, down to about three lines (see ContactForm.tsx). Only a
 * screen shorter than an iPhone SE's (a phone turned sideways) scrolls, inside the box.
 */
export function ContactDialog({ onClose }: { onClose: () => void }) {
  // Start on the heading; Tab goes on to the form.
  const heading = useRef<HTMLHeadingElement>(null)

  return (
    <Popup
      labelledBy="contact-title"
      describedBy="contact-blurb"
      initialFocus={heading}
      panelClassName="max-w-[640px]"
      bodyClassName="px-10 pt-14 pb-11 max-sm:px-6 max-sm:pt-12 max-sm:pb-7 phone-short:pt-11 phone-short:pb-3"
      onClose={onClose}
    >
      {() => (
        <>
          <h2 id="contact-title" ref={heading} tabIndex={-1} className="shrink-0 text-[30px] leading-[1.15] text-balance outline-none max-sm:text-[24px]">
            How can I work with you?
          </h2>
          <p
            id="contact-blurb"
            className="mx-auto mt-4 max-w-[28em] shrink-0 font-text text-[19px] leading-[1.4] tracking-normal text-balance normal-case max-sm:mt-3 max-sm:text-[17px] phone-short:mt-2"
          >
            Send me a message and we can get started.
          </p>
          <ContactForm />
        </>
      )}
    </Popup>
  )
}
