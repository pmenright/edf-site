import { createPopupState } from './popup'

/** The resume popup (ResumeDialog.tsx), opened by the rail's RESUME. See popup.ts. */
const resume = createPopupState()
export const openResume = resume.open
export const closeResume = resume.close
export const useResumeOpen = resume.useIsOpen
