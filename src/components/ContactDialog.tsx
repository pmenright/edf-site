import { useRef } from 'react'
import { ContactForm } from './ContactForm'
import { Popup } from './Popup'

/**
 * CONTACT popup (opened from every CONTACT button, see src/lib/contact.ts): the heading, a line in
 * League Spartan, and the message form (ContactForm.tsx). The box itself is Popup.tsx.
 */
export function ContactDialog({ onClose }: { onClose: () => void }) {
  // Start on the heading; Tab goes on to the form.
  const heading = useRef<HTMLHeadingElement>(null)

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
          <p
            id="contact-blurb"
            className="mx-auto mt-4 max-w-[28em] font-text text-[19px] leading-[1.4] tracking-normal text-balance normal-case max-sm:text-[17px]"
          >
            Send me a message and we can get started.
          </p>
          <ContactForm />
        </>
      )}
    </Popup>
  )
}
