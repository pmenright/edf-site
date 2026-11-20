import { Picture } from '../components/Picture'
import { openContact } from '../lib/contact'
import { about } from './content'

/**
 * The about slide (Jim's mockup): HELLO FRIEND. over a sand-outlined letter on the left, signed, with
 * CONTACT under it, and the cutout portrait large on the right. The portrait sits on top: the top of
 * the head runs off the top of the screen, the shoulders off the bottom, and the letter's corner
 * tucks under the shoulder. A wide, soft dark-blue shadow sets the cutout off the background.
 * `stacked` (phones and upright screens): the portrait first, then the words.
 */
export function AboutIntro({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={stacked ? 'hello hello-stacked' : 'hello'}>
      <div className="hello-copy">
        <h1 className="hello-headline">{about.headline}</h1>
        <div className="hello-letter">
          {about.letter.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="hello-signature">
            <span className="hello-name">{about.signature}</span>
            <span className="hello-signoff">- {about.signoff}</span>
          </p>
        </div>
        <button type="button" aria-haspopup="dialog" onClick={openContact} className="hello-contact group">
          <span>Contact</span>
        </button>
      </div>
      <Picture
        asset={about.photo}
        alt={about.photoAlt}
        sizes={stacked ? '(orientation: landscape) 45vw, 100vw' : '80vw'}
        loading="eager"
        className="hello-photo"
      />
    </div>
  )
}
