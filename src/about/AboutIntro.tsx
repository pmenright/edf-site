import { withBase } from '../content'
import { openContact } from '../lib/contact'
import { POPUP_BUTTON, POPUP_BUTTON_FILLED, POPUP_BUTTON_OUTLINED } from '../lib/popup'
import { about } from './content'

/**
 * The about slide: a large stylized portrait beside a headline and a short blurb. On desktop the
 * portrait takes the right side, full height; on phones it comes first, then the words.
 */
export function AboutIntro({ onResume, stacked = false }: { onResume: () => void; stacked?: boolean }) {
  return (
    <div className={stacked ? 'about-intro about-intro-stacked' : 'about-intro'}>
      <div className="about-copy">
        <p className="about-eyebrow">{about.eyebrow}</p>
        <h1 className="about-headline">{about.headline}</h1>
        {about.blurb.map((p) => (
          <p key={p} className="about-blurb">
            {p}
          </p>
        ))}
        <div className="mt-[1.6em] flex flex-wrap gap-3">
          <button type="button" onClick={onResume} className="group cursor-pointer outline-none">
            <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_FILLED} px-5`}>
              Resume <span aria-hidden="true">→</span>
            </span>
          </button>
          <button type="button" aria-haspopup="dialog" onClick={openContact} className="group cursor-pointer outline-none">
            <span className={`${POPUP_BUTTON} ${POPUP_BUTTON_OUTLINED} px-5`}>Contact</span>
          </button>
        </div>
      </div>
      <figure className="about-photo">
        {about.photo ? (
          <img src={withBase(about.photo)} alt={about.photoAlt} className="h-full w-full object-cover" />
        ) : (
          <PortraitPlaceholder />
        )}
      </figure>
    </div>
  )
}

/**
 * PLACEHOLDER until the stylized portrait exists (about.json "photo"): a halftone field, like the nav
 * buttons' dots, with a head-and-shoulders silhouette and a label.
 */
function PortraitPlaceholder() {
  return (
    <div className="about-photo-placeholder" role="img" aria-label="Portrait placeholder">
      <svg aria-hidden="true" viewBox="0 0 400 500" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[88%] w-full">
        <defs>
          <pattern id="halftone-ink" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="4.5" cy="4.5" r="3.1" fill="#1d262c" />
          </pattern>
        </defs>
        <circle cx="200" cy="170" r="92" fill="url(#halftone-ink)" />
        <path d="M40 500c0-120 70-190 160-190s160 70 160 190z" fill="url(#halftone-ink)" />
      </svg>
      <span className="absolute top-[6%] left-1/2 w-max max-w-[88%] -translate-x-1/2 border-2 border-ink bg-sand px-3 py-1.5 text-center font-ddc text-[clamp(10px,1.4vh,13px)] tracking-[0.12em] text-ink uppercase">
        Stylized portrait goes here
      </span>
    </div>
  )
}
