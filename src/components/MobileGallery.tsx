import { motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { ABOUT_SLIDE_DURATION, AboutStack, type AboutSlide } from '../about/AboutLayer'
import { byCategory, type Category, type Project } from '../content'
import type { AboutState } from '../hooks/useAboutHash'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { openContact } from '../lib/contact'
import { Hero } from './Hero'
import { MobileNavRow } from './Nav'
import { ProjectPanel } from './ProjectPanel'

interface GalleryProps {
  category: Category
  onCategory: (c: Category) => void
  onOpen: (p: Project) => void
  /** Open scrolled past the hero to the start of the work (links like "/#video"). */
  startAtWork?: boolean
  /** Open scrolled to this project's panel (links like "/?panel=nsyte"). */
  startAtPanel?: string
  /** The about / resume panel (App.tsx, useAboutHash). */
  about: AboutState
  /** RESUME (in the DESIGN / VIDEO row): open the panel on this slide. */
  onAbout: (s: AboutSlide) => void
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
 * The DESIGN / VIDEO | RESUME row (stuck to the top of the screen), the hero with CONTACT under it,
 * the work as square tiles, then a ribbon with CONTACT. Switching category slides the two
 * sides sideways; if the page was scrolled into the work, the new side starts at its first project
 * (like the desktop strip). Each side is only as tall as its own tiles, so the page ends right after
 * the side that's showing, however many projects each side has.
 *
 * RESUME (in the DESIGN / VIDEO row) slides the about / resume panel in from the right, in place of the work (About, then the whole resume, down the page); DESIGN or VIDEO
 * slides it back out.
 */
export function MobileGallery({ category, onCategory, onOpen, startAtWork, startAtPanel, about, onAbout }: GalleryProps) {
  const reduce = useReducedMotion()
  const cols = useColumns()
  const work = useRef<HTMLDivElement>(null)
  const columns = useRef<HTMLDivElement>(null)

  // Each side's height. The two sides sit side by side and slide, so the box holding them takes the
  // showing side's height (not the taller one's): no empty space under the shorter side.
  const sideRefs = useRef<Record<Category | 'about', HTMLElement | null>>({ design: null, video: null, about: null })
  const [heights, setHeights] = useState<Record<Category | 'about', number>>({ design: 0, video: 0, about: 0 })
  useLayoutEffect(() => {
    const measure = () =>
      setHeights({
        design: sideRefs.current.design?.offsetHeight ?? 0,
        video: sideRefs.current.video?.offsetHeight ?? 0,
        about: sideRefs.current.about?.offsetHeight ?? 0,
      })
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of Object.values(sideRefs.current)) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [cols])

  /** Page scroll at which the first tiles sit right under the stuck DESIGN / VIDEO row. */
  const workTop = () => {
    if (!work.current) return 0
    const navH = document.getElementById('nav')?.offsetHeight ?? 0
    return Math.max(0, work.current.getBoundingClientRect().top + window.scrollY - navH)
  }
  /** Page scroll at which the resume (in the about / resume panel) sits right under that row. */
  const resumeTop = () => {
    const el = sideRefs.current.about?.querySelector('[data-about-resume]')
    if (!el) return workTop()
    const navH = document.getElementById('nav')?.offsetHeight ?? 0
    return Math.max(0, el.getBoundingClientRect().top + window.scrollY - navH)
  }

  useEffect(() => {
    const panel = startAtPanel && document.querySelector(`.panel[data-project="${CSS.escape(startAtPanel)}"]`)
    if (panel) panel.scrollIntoView({ block: 'center' })
    else if (about.open) window.scrollTo({ top: about.slide === 1 ? resumeTop() : workTop(), behavior: 'instant' })
    else if (startAtWork) work.current?.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAtWork, startAtPanel])

  /*
    Switching DESIGN / VIDEO while scrolled down into the work: the page goes back to the start of the
    work, and in that same frame the side being left is moved up by the same amount so it still shows
    what it showed. Then the usual sideways slide runs and the new side arrives at its first project.
  */
  const shiftDesign = useMotionValue(0)
  const shiftVideo = useMotionValue(0)
  const shiftAbout = useMotionValue(0)

  /*
    The about / resume panel. Opening it from inside the work works like a DESIGN / VIDEO switch: the
    page jumps to the panel's start (or the resume's, from RESUME) and the work being left is moved by
    the same amount, so it still shows what it showed as it slides away left and the panel slides in
    from the right. From higher up the page (the hero), the page scrolls down to it as it slides in.
    Closing goes back to the start of the work the same way. The panel's contents are only on the page
    while it's open (and sliding out).
  */
  const aboutWasOpen = useRef(about.open)
  const aboutSeq = useRef(about.seq)
  const [keepAbout, setKeepAbout] = useState(false)
  // Read during render on purpose: on the render that closes it, the effect below hasn't run yet, so
  // this still says "was open" and the panel stays on the page for its slide out.
  const showAbout = about.open || aboutWasOpen.current || keepAbout
  useLayoutEffect(() => {
    const opening = about.open && !aboutWasOpen.current
    const closing = !about.open && aboutWasOpen.current
    const asked = about.seq !== aboutSeq.current
    aboutWasOpen.current = about.open
    aboutSeq.current = about.seq
    if (!opening && !closing && !asked) return // first render (a "/#about" link is handled on landing)
    const ms = reduce ? 0 : ABOUT_SLIDE_DURATION * 1000 + 50
    if (about.open) {
      setKeepAbout(false)
      const target = about.slide === 1 ? resumeTop() : workTop()
      const y = window.scrollY
      if (opening && y >= workTop() - 1) {
        shiftAbout.set(0)
        const outgoing = category === 'design' ? shiftDesign : shiftVideo
        window.scrollTo({ top: target, behavior: 'instant' })
        outgoing.set(target - y)
        const t = window.setTimeout(() => outgoing.set(0), ms)
        return () => window.clearTimeout(t)
      }
      window.scrollTo({ top: target, behavior: reduce ? 'instant' : 'smooth' })
      return
    }
    if (!closing) return
    setKeepAbout(true)
    const top = workTop()
    const by = window.scrollY - top
    ;(category === 'design' ? shiftDesign : shiftVideo).set(0)
    if (by > 1) {
      window.scrollTo({ top, behavior: 'instant' })
      shiftAbout.set(-by)
    }
    const t = window.setTimeout(() => {
      shiftAbout.set(0)
      setKeepAbout(false)
    }, ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about.open, about.seq])

  const prevCategory = useRef(category)
  useLayoutEffect(() => {
    const prev = prevCategory.current
    prevCategory.current = category
    if (prev === category) return
    // (Switched from the about / resume panel: the effect above already took the page back to the
    // start of the work, so there's nothing to move here; the sides swap under the panel.)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <MobileNavRow
        category={category}
        onCategory={onCategory}
        categoryActive={!about.open}
        onResume={() => onAbout(0)}
        resumeActive={about.open}
      />
      <Hero onContact={openContact} className="mobile-hero w-full" />
      <div ref={work} aria-hidden="true" className="scroll-mt-[var(--mnav-h)]" />
      <div
        ref={columns}
        className="overflow-hidden"
        style={{ height: (about.open ? heights.about : heights[category]) || undefined }}
      >
        {/* The work (its two sides) and the about / resume panel, side by side. */}
        <motion.div
          initial={false}
          animate={{ x: about.open ? '-50%' : '0%' }}
          transition={{ duration: reduce ? 0 : ABOUT_SLIDE_DURATION, ease: [0.65, 0, 0.35, 1] }}
          className="flex w-[200%] items-start"
        >
        <div className="w-1/2 overflow-hidden" inert={about.open}>
        <motion.div
          initial={false}
          animate={{ x: category === 'video' ? '-50%' : '0%' }}
          transition={{ duration: reduce || showAbout ? 0 : 0.25, ease: 'easeInOut' }}
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
        <motion.div
          ref={(el: HTMLDivElement | null) => {
            sideRefs.current.about = el
          }}
          role="region"
          aria-label="About and resume"
          aria-hidden={!about.open}
          inert={!about.open}
          style={{ y: shiftAbout }}
          className="w-1/2"
        >
          {showAbout && <AboutStack />}
        </motion.div>
        </motion.div>
      </div>
      <BottomRibbon />
    </main>
  )
}

/** After the work: the contact popup, in a sand ribbon like the DESIGN / VIDEO row. */
function BottomRibbon() {
  const button =
    'group grid h-11 cursor-pointer place-items-center outline-none'
  const face =
    'block h-10 border-2 border-ink px-6 font-ddc text-[16px] leading-[36px] tracking-[0.08em] text-ink uppercase transition-colors group-hover:bg-ink group-hover:text-sand group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink'
  return (
    <nav aria-label="More" className="flex items-center justify-center gap-4 bg-sand px-4 py-4">
      <button type="button" aria-haspopup="dialog" onClick={openContact} className={button}>
        <span className={face}>Contact</span>
      </button>
    </nav>
  )
}
