import { createPopupState } from './popup'

/** The "Download my resume" popup (ResumeDialog.tsx), opened by the resume's RESUME PDF. See popup.ts. */
const resume = createPopupState()
export const openResume = resume.open
export const closeResume = resume.close
export const useResumeOpen = resume.useIsOpen
