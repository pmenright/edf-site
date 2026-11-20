import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import { ContactDialog } from '../components/ContactDialog'
import { MobileContactBar, NavColumn } from '../components/Nav'
import { withBase } from '../content'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { closeContact, useContactOpen } from '../lib/contact'
import { RAIL_NARROW } from '../lib/rail'
import { AboutIntro } from './AboutIntro'
import { ResumeBoard, ResumeDocument } from './Resume'

/**
 * The about / resume page (/about/). Two full-screen slides, About then Resume. On desktop they sit
 * side by side and scrolling (down or right) slides from one to the other, like the portfolio's strip,
 * with the docked rail at the left (RESUME selected). On phones and portrait screens it's one
 * vertical page. "/about/#resume" opens on the resume.
 */
export default function AboutPage() {
  const isDesktop = useIsDesktop()
  const contactOpen = useContactOpen()
  return (
    <>
      {isDesktop ? <AboutDesktop /> : <AboutMobile />}
      {contactOpen && <ContactDialog onClose={closeContact} />}
    </>
  )
}

const SLIDES = ['About', 'Resume'] as const
const startsOnResume = () => window.location.hash === '#resume'

/** Visible page width (not 100vw, which includes a classic scrollbar). */
const viewWidth = () => document.documentElement.clientWidth

/** Wheel / trackpad travel (px) that turns the page to the other slide. */
const TURN_AT = 40
const TURN_EASE = [0.65, 0, 0.35, 1] as const

function AboutDesktop() {
  const reduce = useReducedMotion()
  const pin = useMotionValue(0)
  const squeeze = useMotionValue(1)

  // The docked rail is RAIL_NARROW of the full nav column (20vh, or 300px from 1920 wide). Each slide
  // is the rest of the screen.
  const [dims, setDims] = useState({ railW: 0, slideW: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      const navW = window.innerWidth >= 1920 ? 300 : window.innerHeight * 0.2
      const railW = Math.round(navW * RAIL_NARROW)
      setDims({ railW, slideW: viewWidth() - railW })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  /*
    The slides turn like pages: one wheel notch, trackpad swipe, finger swipe or arrow key moves to
    the other slide and the rest of that gesture is ignored. Down or right goes forward, up or left
    goes back. When the resume is taller than the screen (small laptops) it scrolls first, and turns
    back to About only from its top.
  */
  const [slide, setSlide] = useState(() => (startsOnResume() ? 1 : 0))
  const current = useRef(slide)
  const x = useMotionValue(0)
  useLayoutEffect(() => {
    x.set(-current.current * dims.slideW)
  }, [dims.slideW, x])
  const goTo = useCallback(
    (i: number) => {
      const to = Math.max(0, Math.min(SLIDES.length - 1, i))
      if (to === current.current) return
      current.current = to
      setSlide(to)
      animate(x, -to * dims.slideW, { duration: reduce ? 0 : 0.6, ease: TURN_EASE })
    },
    [dims.slideW, reduce, x],
  )

  // Keep the address in step, so a copied link opens the same slide.
  useEffect(() => {
    const want = slide === 1 ? '#resume' : ''
    if (window.location.hash !== want) window.history.replaceState(null, '', window.location.pathname + window.location.search + want)
  }, [slide])

  useEffect(() => {
    const popupOpen = () => document.documentElement.classList.contains('viewer-open')
    /** The current slide, if its contents scroll (the resume on a short screen). */
    const scroller = () => {
      const el = document.querySelector<HTMLElement>(`[data-slide="${current.current}"]`)
      return el && el.scrollHeight > el.clientHeight + 1 ? el : null
    }
    const g = { amount: 0, locked: false, last: 0, native: 0 }

    const onWheel = (e: WheelEvent) => {
      if (popupOpen() || e.ctrlKey) return // ctrlKey = pinch-zoom on trackpads
      const now = performance.now()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      const d = (sideways ? e.deltaX : e.deltaY) * unit
      if (g.locked) {
        // Swallow the rest of the gesture (trackpad momentum) that turned the page.
        if (now - g.last < 220) {
          g.last = now
          e.preventDefault()
          return
        }
        g.locked = false
        g.amount = 0
      }
      const box = !sideways ? scroller() : null
      if (box && box.contains(e.target as Node)) {
        const canScroll = d > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0
        if (canScroll) {
          g.native = now
          return // the resume scrolls
        }
        // Momentum that carried a fast scroll to the edge doesn't turn the page.
        if (now - g.native < 250) {
          g.native = now
          e.preventDefault()
          return
        }
      }
      e.preventDefault()
      if (d === 0) return
      if (now - g.last > 300) g.amount = 0
      g.last = now
      g.amount += d
      if (Math.abs(g.amount) >= TURN_AT) {
        g.locked = true
        g.amount = 0
        goTo(current.current + Math.sign(d))
      }
    }

    // Touch screens wide enough for this layout (tablets on their side): swipe to turn.
    let start: { x: number; y: number; top: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return (start = null)
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, top: scroller()?.scrollTop ?? 0 }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!start || popupOpen()) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const box = scroller()
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) goTo(current.current - Math.sign(dx))
      // Up and down swipes turn too, unless they were scrolling the resume.
      else if (Math.abs(dy) > 60 && (!box || (dy > 0 && start.top <= 0))) goTo(current.current - Math.sign(dy))
      start = null
    }

    const onKey = (e: KeyboardEvent) => {
      if (popupOpen() || e.altKey || e.metaKey || e.ctrlKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const box = scroller()
      const atTop = !box || box.scrollTop <= 0
      const forward = e.key === 'ArrowRight' || (!box && (e.key === 'ArrowDown' || e.key === 'PageDown'))
      const back = e.key === 'ArrowLeft' || (atTop && (e.key === 'ArrowUp' || e.key === 'PageUp'))
      if (forward && current.current < SLIDES.length - 1) goTo(current.current + 1)
      else if (back && current.current > 0) goTo(current.current - 1)
      else return
      e.preventDefault()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
    }
  }, [goTo])

  // Tabbing into the slide that's off screen brings it in (the slides clip, so the browser can't).
  const onFocusCapture = (e: FocusEvent) => {
    const i = Number((e.target as HTMLElement).closest<HTMLElement>('[data-slide]')?.dataset.slide)
    if (!Number.isNaN(i) && i !== current.current) requestAnimationFrame(() => goTo(i))
  }

  return (
    <main className="relative h-screen overflow-clip">
      <div className="about-rail fixed inset-y-0 left-0 z-30">
        <NavColumn
          category="design"
          onCategory={() => {}}
          pin={pin}
          squeeze={squeeze}
          onHome={() => window.location.assign(withBase('/'))}
          resumeHref={withBase('/about/')}
          resumeActive
          workLinks={{ design: withBase('/#design'), video: withBase('/#video') }}
        />
      </div>
      <div className="h-screen w-full overflow-clip" style={{ paddingLeft: dims.railW }}>
        <motion.div style={{ x }} onFocusCapture={onFocusCapture} className="flex h-full w-max will-change-transform">
          <section data-slide="0" aria-label="About" className="h-screen flex-none" style={{ width: dims.slideW }}>
            <AboutIntro />
          </section>
          <section data-slide="1" aria-label="Resume" className="h-screen flex-none" style={{ width: dims.slideW }}>
            <ResumeBoard />
          </section>
        </motion.div>
        {/* The scroll hint from the portfolio's hero: on the about slide, it turns to the resume. */}
        <motion.button
          type="button"
          onClick={() => goTo(1)}
          aria-label="Next: resume"
          animate={{ opacity: slide === 0 ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          tabIndex={slide === 0 ? 0 : -1}
          className={`absolute top-1/2 right-[20px] -translate-y-1/2 cursor-pointer rounded-[8px] py-3 pr-[30px] pl-3 outline-offset-0 focus-visible:outline-2 focus-visible:outline-sand ${slide === 0 ? '' : 'pointer-events-none'}`}
        >
          <span className="relative flex h-[50px] w-5 flex-col items-start justify-start rounded-[20px] bg-sand">
            <span className="scroll-ball mt-0.5 ml-0.5 block size-4 rounded-[20px] bg-ink" />
            <span className="scroll-arrow absolute top-[10px] left-[30px] h-0 w-0 border-y-[15px] border-l-[15px] border-y-transparent border-l-sand" />
          </span>
        </motion.button>
        {/* Not on the about slide (the mockup keeps it clean); on the resume it's the way back. */}
        <motion.div
          initial={false}
          animate={{ opacity: slide === 1 ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className={slide === 1 ? '' : 'pointer-events-none'}
          inert={slide !== 1}
        >
          <SlidePager slide={slide} onGo={goTo} />
        </motion.div>
      </div>
    </main>
  )
}

/** "01 About  02 Resume" at the bottom right: where you are, and a click away from the other. */
function SlidePager({ slide, onGo }: { slide: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Slides" className="absolute right-6 bottom-3 z-10 flex gap-1 bg-ink px-1 font-ddc text-[13px] tracking-[0.1em] uppercase shadow-[0_0_12px_8px_var(--color-ink)] wide:text-[15px]">
      {SLIDES.map((name, i) => (
        <button
          key={name}
          type="button"
          onClick={() => onGo(i)}
          aria-current={slide === i ? 'true' : undefined}
          className={`flex h-9 cursor-pointer items-center gap-1.5 border-b-2 px-2 outline-none transition-colors focus-visible:outline-2 focus-visible:outline-sand ${
            slide === i ? 'border-sand text-sand' : 'border-transparent text-sand/55 hover:text-sand'
          }`}
        >
          <span className="opacity-60">{String(i + 1).padStart(2, '0')}</span>
          {name}
        </button>
      ))}
    </nav>
  )
}

/** Phones and portrait screens: About, then the whole resume, down one page. */
function AboutMobile() {
  const resumeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (startsOnResume()) resumeRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  return (
    <main className="relative">
      <MobileContactBar workHref={withBase('/')} />
      <section aria-label="About" className="px-[6%] pt-12 pb-12">
        <AboutIntro stacked />
      </section>
      <section id="resume" ref={resumeRef} aria-label="Resume" className="bg-sand px-[6%] pt-10 pb-14 text-ink">
        <ResumeDocument />
      </section>
      <footer className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-8 font-ddc text-[18px] tracking-[0.06em] uppercase">
        <a href={withBase('/#design')} className="py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sand">
          Design work
        </a>
        <a href={withBase('/#video')} className="py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sand">
          Video work
        </a>
      </footer>
    </main>
  )
}
