import { useRef } from 'react'
import { site, withBase } from '../content'
import { POPUP_BUTTON, POPUP_BUTTON_FILLED, POPUP_BUTTON_OUTLINED } from '../lib/popup'
import { Popup } from './Popup'

const href = withBase(site.resumeFile)
const file = site.resumeFile.split('/').pop() ?? 'resume.pdf'

interface ResumeDialogProps {
  onClose: () => void
  /**
   * VIEW: opens the resume in the project viewer (resumeProject in src/content). Resolves once the
   * viewer is up, so this popup fades out underneath it. Left out while there are no resume pages.
   */
  onView?: () => Promise<void>
}

/**
 * "Download my resume" popup (opened by the resume's RESUME PDF, see src/lib/resume.ts), laid out like
 * the project viewer's download popup (the typeface): a heading and DOWNLOAD (and VIEW, if `onView`). The file is `resumeFile` in
 * src/content/site.json (it lives in public/downloads/). The box itself is Popup.tsx.
 */
export function ResumeDialog({ onClose, onView }: ResumeDialogProps) {
  const download = useRef<HTMLAnchorElement>(null)
  return (
    <Popup labelledBy="resume-title" initialFocus={download} panelClassName="max-w-[520px]" bodyClassName="px-8 pt-12 pb-9" onClose={onClose}>
      {(close) => (
        <>
          <h2 id="resume-title" className="text-[24px] leading-[1.3] text-balance">
            Download my resume
          </h2>
          <div className="mt-7 flex justify-center gap-3">
            {onView && (
              <button
                type="button"
                onClick={async () => {
                  await onView()
                  close()
                }}
                className="group grid cursor-pointer place-items-center outline-none"
              >
                <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_OUTLINED} px-6`}>View</span>
              </button>
            )}
            <a
              ref={download}
              href={href}
              download={file}
              aria-label={`Download ${file}`}
              // the download has started; give it a beat, then close
              onClick={() => window.setTimeout(close, 200)}
              className="group grid cursor-pointer place-items-center outline-none"
            >
              <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_FILLED} px-6`}>Download</span>
            </a>
          </div>
        </>
      )}
    </Popup>
  )
}
