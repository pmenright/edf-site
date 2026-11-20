import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { byCategory, withBase, type Category, type Project } from '../content'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { openContact } from '../lib/contact'
import { POPUP_BUTTON, POPUP_BUTTON_FILLED, POPUP_BUTTON_OUTLINED } from '../lib/popup'
import { Hero } from './Hero'
import { MobileContactBar, MobileNavRow } from './Nav'
import { ProjectPanel } from './ProjectPanel'

interface GalleryProps {
  category: Category
  onCategory: (c: Category) => void
  onOpen: (p: Project) => void
  /** Open scrolled past the hero to the start of the work (links like "/#video"). */
  startAtWork?: boolean
  /** Open scrolled to this project's panel (links like "/?panel=nsyte"). */
  startAtPanel?: string
}

/**
 * How many square tiles fit across: one on phones, two on upright tablets, and on screens lying on
 * their side as many as it takes for a whole tile to fit on screen (two, or three on long phones).
 */
function useColumns() {
  const long = useMediaQuery('(orientation: landscape) and (min-aspect-ratio: 8/5)')
  const landscape = useMediaQuery('(orientation: landscape)')
  const tablet = useMediaQuery('(min-width: 768px)')
  return long ? 3 : landscape || tablet ? 2 : 1
}

const other = (c: Category): Category => (c === 'design' ? 'video' : 'design')

/**
 * Phones, tablets, and any screen that isn't wide enough for the desktop strip: a normal vertical page.
 * Bar with CONTACT and RESUME, hero, the DESIGN / VIDEO row (it sticks to the top once scrolled to),
 * then the work as square tiles. Switching category slides the two sides sideways; if the page was
 * scrolled into the work, the new side starts at its first project (like the desktop strip).
 */
export function MobileGallery({ category, onCategory, onOpen, startAtWork, startAtPanel }: GalleryProps) {
  const reduce = useReducedMotion()
  const cols = useColumns()
  const work = useRef<HTMLDivElement>(null)
  const columns = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = startAtPanel && document.querySelector(`.panel[data-project="${CSS.escape(startAtPanel)}"]`)
    if (panel) panel.scrollIntoView({ block: 'center' })
    else if (startAtWork) work.current?.scrollIntoView({ block: 'start' })
  }, [startAtWork, startAtPanel])

  /** Page scroll at which the first tiles sit right under the stuck DESIGN / VIDEO row. */
  const workTop = () => {
    if (!work.current) return 0
    const navH = document.getElementById('nav')?.offsetHeight ?? 0
    return Math.max(0, work.current.getBoundingClientRect().top + window.scrollY - navH)
  }

  /*
    Switching DESIGN / VIDEO while scrolled down into the work: the page goes back to the start of the
    work, and in that same frame the side being left is moved up by the same amount so it still shows
    what it showed. Then the usual sideways slide runs and the new side arrives at its first project.
  */
  const shiftDesign = useMotionValue(0)
  const shiftVideo = useMotionValue(0)
  const prevCategory = useRef(category)
  useLayoutEffect(() => {
    const prev = prevCategory.current
    prevCategory.current = category
    if (prev === category) return
    const outgoing = prev === 'design' ? shiftDesign : shiftVideo
    const incoming = category === 'design' ? shiftDesign : shiftVideo
    incoming.set(0)
    const top = workTop()
    const by = window.scrollY - top
    if (by <= 1) return
    window.scrollTo({ top, behavior: 'instant' })
    outgoing.set(-by)
    const t = window.setTimeout(() => outgoing.set(0), reduce ? 0 : 300)
    return () => window.clearTimeout(t)
  }, [category, reduce, shiftDesign, shiftVideo])

  /** Skip link: straight to the first project of the current category. */
  const skipToWork = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const first = columns.current?.querySelector<HTMLElement>('section:not([inert]) .panel')
    first?.focus({ preventScroll: true })
    window.scrollTo({ top: workTop(), behavior: reduce ? 'instant' : 'smooth' })
  }

  /** From an end card: show the other side, starting at its first project. */
  const seeOther = (c: Category) => {
    onCategory(other(c))
    if (window.scrollY < workTop() - 1) {
      animate(window.scrollY, workTop(), {
        duration: reduce ? 0 : 0.4,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => window.scrollTo({ top: v, behavior: 'instant' }),
      })
    }
  }

  return (
    <main className="mobile-page relative">
      <a
        href="#nav"
        onClick={skipToWork}
        className="sr-only z-50 bg-sand px-4 py-2 font-ddc text-[18px] text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-2 focus:outline-offset-2 focus:outline-sand"
      >
        Skip to work
      </a>
      <MobileContactBar resumeHref={withBase('/about/')} />
      <Hero className="mobile-hero w-full" />
      <MobileNavRow category={category} onCategory={onCategory} />
      <div ref={work} aria-hidden="true" className="scroll-mt-[var(--mnav-h)]" />
      <div ref={columns} className="overflow-hidden">
        <motion.div
          initial={false}
          animate={{ x: category === 'video' ? '-50%' : '0%' }}
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeInOut' }}
          className="flex w-[200%] items-start"
        >
          {(['design', 'video'] as const).map((cat) => {
            const items = byCategory[cat]
            // The end card fills out the last row (or takes a row of its own when the tiles come out even).
            const span = cols - (items.length % cols) || cols
            return (
              <motion.section
                key={cat}
                aria-label={cat === 'design' ? 'Design work' : 'Video work'}
                aria-hidden={cat !== category}
                inert={cat !== category}
                style={{ y: cat === 'design' ? shiftDesign : shiftVideo, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                className="grid w-1/2"
              >
                {items.map((p) => (
                  <ProjectPanel key={p.id} project={p} onOpen={onOpen} className="aspect-square w-full" />
                ))}
                <EndCard
                  category={cat}
                  style={{ gridColumn: `span ${span}`, aspectRatio: cols === 1 ? '4 / 3' : `${span} / 1` }}
                  onOther={() => seeOther(cat)}
                />
              </motion.section>
            )
          })}
        </motion.div>
      </div>
    </main>
  )
}

/**
 * After the last project: where to go next. The other side of the work, the about / resume page,
 * and the contact popup. It fills out the grid's last row, so the work never ends on an empty square.
 */
function EndCard({ category, style, onOther }: { category: Category; style: CSSProperties; onOther: () => void }) {
  const button = `${POPUP_BUTTON} px-5 whitespace-nowrap`
  return (
    <div style={style} className="flex flex-col items-center justify-center gap-5 bg-ink px-6 py-8 text-center font-ddc text-sand">
      <p className="text-[clamp(18px,4.5vw,26px)] leading-tight">
        That's the {category} work.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onOther} className="group cursor-pointer outline-none">
          <span className={`${button} ${POPUP_BUTTON_FILLED}`}>See {other(category)} work</span>
        </button>
        <a href={withBase('/about/')} className="group outline-none">
          <span className={`${button} ${POPUP_BUTTON_OUTLINED}`}>About me</span>
        </a>
        <button type="button" aria-haspopup="dialog" onClick={openContact} className="group cursor-pointer outline-none">
          <span className={`${button} ${POPUP_BUTTON_OUTLINED}`}>Contact</span>
        </button>
      </div>
    </div>
  )
}
