import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import { AboutIntro } from './AboutIntro'
import { ResumeBoard, ResumeDocument } from './Resume'

/** 0 = About, 1 = Resume. */
export type AboutSlide = 0 | 1

/** How long the panel takes to slide in over the work, or back out (seconds). */
export const ABOUT_SLIDE_DURATION = 0.35
const SLIDE_EASE = [0.65, 0, 0.35, 1] as const

/** A scroll or swipe this far (px) toward the other slide carries on to it when you let go. */
const COMMIT_AT = 40
/**
 * Wheel events closer together than this (ms) are one gesture (a trackpad swipe and its momentum).
 * This long after the last one, the strip settles on a slide.
 */
const GESTURE_GAP = 140

const popupOpen = () => document.documentElement.classList.contains('viewer-open')

interface DesktopProps {
  open: boolean
  /** The slide to show when it opens, and to go to when `seq` changes while it's open. */
  slide: AboutSlide
  /** Changes every time the panel is asked to show a slide (RESUME pressed, links). */
  seq: number
  /** Holds the panel against the docked rail wherever the strip under it is (from DesktopGallery). */
  pin: MotionValue<number>
  /** One slide's width: the screen right of the docked rail. */
  slideW: number
  /** The slide it settled on (for the address bar). */
  onSlide: (s: AboutSlide) => void
}

/**
 * Desktop: About and the resume, side by side, in a panel that slides in from the right over the
 * work when RESUME is pressed (the way DESIGN and VIDEO slide in from above and below) and back out
 * when DESIGN or VIDEO is. The docked rail stays put on its left.
 *
 * Scrolling moves between the two slides the way it moves the portfolio's strip: the slides follow
 * the wheel, trackpad or finger as it moves, and when you let go they settle on whichever slide you
 * were heading for (40px toward it is enough), so it never feels stuck. When the resume is taller than
 * the screen it scrolls down once it's fully in, and back to About from its top.
 */
export function AboutDesktopLayer({ open, slide, seq, pin, slideW, onSlide }: DesktopProps) {
  const reduce = useReducedMotion()
  const [present, setPresent] = useState(open)
  const presentRef = useRef(present)
  presentRef.current = present
  const openRef = useRef(open)
  openRef.current = open
  const W = useRef(slideW)
  W.current = slideW
  const onSlideRef = useRef(onSlide)
  onSlideRef.current = onSlide

  // Slid in (0) or out past the right edge (slideW), on top of the pin.
  const enter = useMotionValue(open ? 0 : slideW)
  const x = useTransform(() => pin.get() + enter.get())
  // How far along the two slides the panel is showing: 0 = About, slideW = Resume.
  const p = useMotionValue(slide * slideW)
  const trackX = useTransform(p, (v) => -v)
  const [current, setCurrent] = useState<AboutSlide>(slide)
  const currentRef = useRef(current)

  const snap = useRef<AnimationPlaybackControls | null>(null)
  const stopSnap = () => {
    snap.current?.stop()
    snap.current = null
  }

  /** Glide to a slide. */
  const goTo = useCallback(
    (i: number) => {
      const to: AboutSlide = i <= 0 ? 0 : 1
      stopSnap()
      const w = W.current
      const dist = Math.abs(p.get() - to * w)
      const a = animate(p, to * w, {
        duration: reduce ? 0 : Math.min(0.6, 0.25 + (0.35 * dist) / Math.max(1, w)),
        ease: SLIDE_EASE,
      })
      snap.current = a
      void a.then(() => {
        if (snap.current === a) snap.current = null
      })
      if (to !== currentRef.current) {
        currentRef.current = to
        setCurrent(to)
      }
      onSlideRef.current(to)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, reduce],
  )

  // Opening slides it in at the asked-for slide; asking again while open (RESUME, links) goes there;
  // closing slides it out and then removes it.
  const wasOpen = useRef(open)
  useLayoutEffect(() => {
    const opening = open && !wasOpen.current
    const closing = !open && wasOpen.current
    wasOpen.current = open
    if (opening) {
      stopSnap()
      if (!presentRef.current) enter.set(W.current)
      setPresent(true)
      p.set(slide * W.current)
      currentRef.current = slide
      setCurrent(slide)
      animate(enter, 0, { duration: reduce ? 0 : ABOUT_SLIDE_DURATION, ease: SLIDE_EASE })
    } else if (closing) {
      const a = animate(enter, W.current, { duration: reduce ? 0 : ABOUT_SLIDE_DURATION, ease: SLIDE_EASE })
      void a.then(() => {
        if (!openRef.current) setPresent(false)
      })
    } else if (open) {
      goTo(slide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seq])

  // Window resized: stay on the same slide.
  useLayoutEffect(() => {
    stopSnap()
    p.set(currentRef.current * slideW)
    if (!openRef.current) enter.set(slideW)
  }, [slideW, p, enter])

  useEffect(() => {
    if (!open) return
    /** The resume slide, when it's taller than the screen and scrolls. */
    const scroller = () => {
      const el = document.querySelector<HTMLElement>('[data-about-layer] [data-slide="1"]')
      return el && el.scrollHeight > el.clientHeight + 1 ? el : null
    }
    const clamp = (v: number) => Math.min(W.current, Math.max(0, v))

    // The slides ease toward `target` (smooths out both mouse-wheel steps and trackpad jitter).
    const g = { target: p.get(), start: p.get(), raf: 0, timer: 0, last: -1e9, native: -1e9, moving: false }
    const tick = () => {
      const cur = p.get()
      const d = g.target - cur
      if (Math.abs(d) < 0.5) {
        p.set(g.target)
        g.raf = 0
        return
      }
      p.set(cur + d * 0.35)
      g.raf = requestAnimationFrame(tick)
    }
    /** The gesture ended: carry on to the slide it was heading for, or back to where it started. */
    const settle = () => {
      cancelAnimationFrame(g.raf)
      g.raf = 0
      const moved = g.target - g.start
      goTo(moved > COMMIT_AT ? 1 : moved < -COMMIT_AT ? 0 : Math.round(g.start / Math.max(1, W.current)))
    }

    const onWheel = (e: WheelEvent) => {
      if (popupOpen() || e.ctrlKey) return // ctrlKey = pinch-zoom on trackpads
      const now = performance.now()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      const d = (sideways ? e.deltaX : e.deltaY) * unit
      const newGesture = now - g.last > GESTURE_GAP
      const box = sideways ? null : scroller()
      if (box && currentRef.current === 1 && p.get() >= W.current - 1 && box.contains(e.target as Node)) {
        const canScroll = d > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0
        if (canScroll) {
          g.last = now
          // The swipe that just brought the resume in doesn't run on into scrolling it.
          if (g.moving && !newGesture) return e.preventDefault()
          g.moving = false
          g.native = now
          return // the resume scrolls
        }
        // Momentum that carried a scroll to the resume's top doesn't turn back to About.
        if (now - g.native < GESTURE_GAP) {
          g.native = now
          g.last = now
          return e.preventDefault()
        }
      }
      e.preventDefault() // the page under the panel never scrolls
      if (d === 0) return
      if (newGesture || snap.current) {
        stopSnap()
        g.target = g.start = p.get()
      }
      g.last = now
      g.moving = true
      g.target = clamp(g.target + d)
      if (!g.raf) g.raf = requestAnimationFrame(tick)
      window.clearTimeout(g.timer)
      // A mouse wheel's step (big and alone) settles straight away; trackpads wait for the momentum.
      g.timer = window.setTimeout(settle, Math.abs(d) >= 50 ? 70 : GESTURE_GAP)
    }

    // Touch screens wide enough for this layout (tablets on their side): drag sideways and the slides
    // follow the finger; up and down swipes turn too, unless they're scrolling the resume.
    let t: { x: number; y: number; p: number; top: number; mode: 'h' | 'v' | null } | null = null
    const onTouchStart = (e: TouchEvent) => {
      if (popupOpen() || e.touches.length !== 1) return void (t = null)
      t = { x: e.touches[0].clientX, y: e.touches[0].clientY, p: p.get(), top: scroller()?.scrollTop ?? 0, mode: null }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!t || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - t.x
      const dy = e.touches[0].clientY - t.y
      if (!t.mode) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) t.mode = 'h'
        else if (Math.abs(dy) > 8) t.mode = 'v'
      }
      if (t.mode === 'h') {
        e.preventDefault()
        stopSnap()
        p.set(clamp(t.p - dx))
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!t) return
      const dx = e.changedTouches[0].clientX - t.x
      const dy = e.changedTouches[0].clientY - t.y
      const from = Math.round(t.p / Math.max(1, W.current))
      if (t.mode === 'h') goTo(-dx > COMMIT_AT ? 1 : dx > COMMIT_AT ? 0 : from)
      else if (t.mode === 'v' && Math.abs(dy) > 50) {
        const box = scroller()
        if (from === 0 && dy < 0) goTo(1)
        else if (from === 1 && dy > 0 && (!box || t.top <= 0)) goTo(0)
      }
      t = null
    }

    // Keys: right / left turn; down, Page Down and Space turn from About and scroll a tall resume;
    // up and Page Up scroll it back and turn back from its top. The page under the panel stays put.
    const onKey = (e: KeyboardEvent) => {
      if (popupOpen() || e.altKey || e.metaKey || e.ctrlKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select, [role="tab"]')) return
      const k = e.key
      const down = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)
      const up = k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)
      if (!(down || up || k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End')) return
      e.preventDefault()
      const box = currentRef.current === 1 ? scroller() : null
      const step = (dir: number) => {
        if (!box) return false
        const can = dir > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0
        if (!can) return false
        const by = k.startsWith('Arrow') ? 60 : box.clientHeight * 0.85
        box.scrollBy({ top: dir * by, behavior: reduce ? 'instant' : 'smooth' })
        return true
      }
      if (k === 'ArrowRight' || k === 'End') goTo(1)
      else if (k === 'ArrowLeft' || k === 'Home') goTo(0)
      else if (down) {
        if (currentRef.current === 0) goTo(1)
        else step(1)
      } else if (up && !step(-1)) goTo(0)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(g.raf)
      window.clearTimeout(g.timer)
    }
  }, [open, goTo, p, reduce])

  // Tabbing into the slide that's off screen brings it in (the panel clips, so the browser can't).
  const onFocusCapture = (e: FocusEvent) => {
    const i = Number((e.target as HTMLElement).closest<HTMLElement>('[data-slide]')?.dataset.slide)
    if (!Number.isNaN(i) && i !== currentRef.current) requestAnimationFrame(() => goTo(i))
  }

  if (!present) return null
  return (
    <motion.div
      data-about-layer=""
      role="region"
      aria-label="About and resume"
      inert={!open}
      onFocusCapture={onFocusCapture}
      style={{ x, width: slideW }}
      className="about-layer absolute top-0 left-0 z-[5] h-screen overflow-clip bg-ink"
    >
      <motion.div style={{ x: trackX }} className="flex h-full w-max will-change-transform">
        <section data-slide="0" aria-label="About" className="h-screen flex-none" style={{ width: slideW }}>
          <AboutIntro />
        </section>
        <section data-slide="1" aria-label="Resume" className="h-screen flex-none" style={{ width: slideW }}>
          <ResumeBoard />
        </section>
      </motion.div>
      {/* The scroll hint from the portfolio's hero: on the about slide, it goes on to the resume. */}
      <motion.button
        type="button"
        onClick={() => goTo(1)}
        aria-label="Next: resume"
        initial={false}
        animate={{ opacity: current === 0 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        tabIndex={current === 0 ? 0 : -1}
        className={`absolute top-1/2 right-[20px] z-10 -translate-y-1/2 cursor-pointer rounded-[8px] py-3 pr-[30px] pl-3 outline-offset-0 focus-visible:outline-2 focus-visible:outline-sand ${current === 0 ? '' : 'pointer-events-none'}`}
      >
        <span className="relative flex h-[50px] w-5 flex-col items-start justify-start rounded-[20px] bg-sand">
          <span className="scroll-ball mt-0.5 ml-0.5 block size-4 rounded-[20px] bg-ink" />
          <span className="scroll-arrow absolute top-[10px] left-[30px] h-0 w-0 border-y-[15px] border-l-[15px] border-y-transparent border-l-sand" />
        </span>
      </motion.button>
    </motion.div>
  )
}

/** Phones and upright screens: About, then the whole resume, one after the other down the page. */
export function AboutStack() {
  return (
    <div>
      <section aria-label="About" className="px-[6%] pt-12 pb-12">
        <AboutIntro stacked />
      </section>
      <section data-about-resume="" aria-label="Resume" className="bg-sand px-[6%] pt-10 pb-14 text-ink">
        <ResumeDocument />
      </section>
    </div>
  )
}
