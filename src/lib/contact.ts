import { createPopupState } from './popup'

/** The contact popup (ContactDialog.tsx), opened by the rail's CONTACT. See popup.ts. */
const contact = createPopupState()
export const openContact = contact.open
export const closeContact = contact.close
export const useContactOpen = contact.useIsOpen
