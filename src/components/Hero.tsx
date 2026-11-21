import { useLayoutEffect, useRef } from 'react'
import heroLockup from '../assets/brand/hero-lockup.svg'

interface HeroProps {
  /** Desktop only: scroll hint at the right edge. */
  onScrollHint?: () => void
  /**
   * Phones and tablets: a CONTACT button under the lockup (opens the contact popup), and the two
   * pinned while the page scrolls up under them (see .hero-pinned in index.css).
   */
  onContact?: () => void
  className?: string
  /** Out of reach (the about / resume panel covers it). */
  inert?: boolean
}

const title = <h1 className="sr-only">Enright Design Foundry: graphic design and videography. Austin based, veteran owned.</h1>

/** Full-screen lockup: "Enright Design Foundry, Hand Made, Austin Based, Veteran Owned". */
export function Hero({ onScrollHint, onContact, className = '', inert = false }: HeroProps) {
  if (onContact) return <PinnedHero onContact={onContact} className={className} inert={inert} />
  return (
    <section
      inert={inert}
      className={`relative flex flex-none flex-col items-center justify-center px-[5%] pt-8 pb-6 short:pt-4 short:pb-3 strip:p-0 ${className}`}
    >
      {title}
      <img
        src={heroLockup}
        alt=""
        fetchPriority="high"
        className="min-h-0 w-full max-w-[1000px] shrink object-contain strip:h-auto strip:w-[60%] strip:max-w-none strip:flex-none"
      />
      {onScrollHint && (
        // The button is a larger, invisible hit area (62 x 74) around the 20 x 50 pill; the pill and arrow sit where they always did.
        <button
          type="button"
          onClick={onScrollHint}
          aria-label="Scroll to the work"
          className="absolute top-1/2 right-[20px] -translate-y-1/2 cursor-pointer rounded-[8px] py-3 pr-[30px] pl-3 outline-offset-0 focus-visible:outline-2 focus-visible:outline-sand"
        >
          <span className="relative flex h-[50px] w-5 flex-col items-start justify-start rounded-[20px] bg-sand">
            <span className="scroll-ball mt-0.5 ml-0.5 block size-4 rounded-[20px] bg-ink" />
            <span className="scroll-arrow absolute top-[10px] left-[30px] h-0 w-0 border-y-[15px] border-l-[15px] border-y-transparent border-l-sand" />
          </span>
        </button>
      )}
    </section>
  )
}

/**
 * Phones and tablets: the lockup with CONTACT under it, centered on the first screen. As the page
 * scrolls, the two hold still while what comes after (the work, or About) slides up under them; when
 * it's twice the lockup-to-button gap below CONTACT, it all scrolls on together and the hero leaves.
 * Scrolling back plays it in reverse. That's position: sticky (.hero-pinned in index.css); centering
 * it needs the pair's height, measured here into --hero-g.
 */
function PinnedHero({ onContact, className, inert }: { onContact: () => void; className: string; inert: boolean }) {
  const section = useRef<HTMLElement>(null)
  const group = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const s = section.current
    const g = group.current
    if (!s || !g) return
    const measure = () => s.style.setProperty('--hero-g', `${g.offsetHeight}px`)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(g)
    return () => ro.disconnect()
  }, [])
  return (
    <section ref={section} inert={inert} className={`hero-pinned relative flex-none ${className}`}>
      {title}
      <div ref={group} className="hero-group">
        <img src={heroLockup} alt="" width={1013} height={594} fetchPriority="high" className="hero-lockup" />
        <button type="button" aria-haspopup="dialog" onClick={onContact} className="hero-contact group grid h-11 cursor-pointer place-items-center outline-none">
          <span className="block h-10 border-2 border-sand px-7 font-ddc text-[17px] leading-[36px] tracking-[0.1em] text-sand uppercase transition-colors group-hover:bg-sand group-hover:text-ink group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-sand">
            Contact
          </span>
        </button>
      </div>
    </section>
  )
}
