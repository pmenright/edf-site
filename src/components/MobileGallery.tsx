import { motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { byCategory, withBase, type Category, type Project } from '../content'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { openContact } from '../lib/contact'
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

/**
 * Phones, tablets, and any screen that isn't wide enough for the desktop strip: a normal vertical page.
 * Bar with CONTACT and RESUME, hero, the DESIGN / VIDEO row (it sticks to the top once scrolled to),
 * the work as square tiles, then a ribbon with ABOUT and CONTACT. Switching category slides the two
 * sides sideways; if the page was scrolled into the work, the new side starts at its first project
 * (like the desktop strip). Each side is only as tall as its own tiles, so the page ends right after
 * the side that's showing, however many projects each side has.
 */
export function MobileGallery({ category, onCategory, onOpen, startAtWork, startAtPanel }: GalleryProps) {
  const reduce = useReducedMotion()
  const cols = useColumns()
  const work = useRef<HTMLDivElement>(null)
  const columns = useRef<HTMLDivElement>(null)

  // Each side's height. The two sides sit side by side and slide, so the box holding them takes the
  // showing side's height (not the taller one's): no empty space under the shorter side.
  const sideRefs = useRef<Record<Category, HTMLElement | null>>({ design: null, video: null })
  const [heights, setHeights] = useState<Record<Category, number>>({ design: 0, video: 0 })
  useLayoutEffect(() => {
    const measure = () =>
      setHeights({ design: sideRefs.current.design?.offsetHeight ?? 0, video: sideRefs.current.video?.offsetHeight ?? 0 })
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of Object.values(sideRefs.current)) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [cols])

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
      <div ref={columns} className="overflow-hidden" style={{ height: heights[category] || undefined }}>
        <motion.div
          initial={false}
          animate={{ x: category === 'video' ? '-50%' : '0%' }}
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeInOut' }}
          className="flex w-[200%] items-start"
        >
          {(['design', 'video'] as const).map((cat) => (
            <motion.section
              key={cat}
              ref={(el: HTMLElement | null) => {
                sideRefs.current[cat] = el
              }}
              aria-label={cat === 'design' ? 'Design work' : 'Video work'}
              aria-hidden={cat !== category}
              inert={cat !== category}
              style={{ y: cat === 'design' ? shiftDesign : shiftVideo, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              className="grid w-1/2"
            >
              {byCategory[cat].map((p) => (
                <ProjectPanel key={p.id} project={p} onOpen={onOpen} className="aspect-square w-full" />
              ))}
            </motion.section>
          ))}
        </motion.div>
      </div>
      <BottomRibbon />
    </main>
  )
}

/** After the work: the about / resume page and the contact popup, in a sand ribbon like the DESIGN / VIDEO row. */
function BottomRibbon() {
  const button =
    'group grid h-11 cursor-pointer place-items-center outline-none'
  const face =
    'block h-10 border-2 border-ink px-6 font-ddc text-[16px] leading-[36px] tracking-[0.08em] text-ink uppercase transition-colors group-hover:bg-ink group-hover:text-sand group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink'
  return (
    <nav aria-label="More" className="flex items-center justify-center gap-4 bg-sand px-4 py-4">
      <a href={withBase('/about/')} className={button}>
        <span className={face}>About</span>
      </a>
      <button type="button" aria-haspopup="dialog" onClick={openContact} className={button}>
        <span className={face}>Contact</span>
      </button>
    </nav>
  )
}
