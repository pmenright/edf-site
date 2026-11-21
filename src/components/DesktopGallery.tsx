import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  type AnimationPlaybackControls,
} from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { AboutRow, ABOUT_SLIDE_DURATION, PUSH_DURATION, type AboutSlide } from '../about/AboutLayer'
import { byCategory, type Category, type Project } from '../content'
import type { AboutState } from '../hooks/useAboutHash'
import { Hero } from './Hero'
import { RAIL_EASE, RAIL_EXPAND_DURATION, RAIL_NARROW, RAIL_TRIGGER_SLACK } from '../lib/rail'
import { NavColumn } from './Nav'
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
  /** RESUME pressed: open the panel on this slide. */
  onAbout: (s: AboutSlide) => void
  onAboutSlide: (s: AboutSlide) => void
  /** (Phones only; on desktop DESIGN / VIDEO close it.) */
  onCloseAbout?: () => void
}

interface Dims {
  /** How far the strip slides: its width minus one screen */
  travel: number
  /** Page height that drives the slide */
  height: number
  /** Where the nav column starts in the strip (the hero's width) */
  navLeft: number
  /** Full nav column width; the docked rail is RAIL_NARROW of it */
  navW: number
  /** Visible page width */
  vw: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** What the strip shows after the nav column: a side of the work, or the about / resume slides. */
type Side = Category | 'about'

/** A scroll this far (strip px) from About toward the resume, or back, carries on to it when it stops. */
const ABOUT_COMMIT = 40
/** The scroll has stopped once it's been this quiet (ms): the about / resume slides settle then. */
const SETTLE_AFTER = 140

/** About's strip position for these measurements (see aboutStart in DesktopGallery). */
function aboutStartFor({ navLeft, navW, travel, height }: Dims) {
  const range = height - window.innerHeight
  const step = range > 0 ? travel / range : 1 // strip px per px of page scroll
  return Math.min(travel, navLeft + navW * (1 - RAIL_NARROW) + Math.ceil(step) + 1)
}

/**
 * Visible page width. Not window width or 100vw: those include a classic (always-shown) scrollbar,
 * and anything that wide gives the page a sideways scroll that keyboard focus can nudge.
 */
const viewWidth = () => document.documentElement.clientWidth

/**
 * Desktop (992px+ and wide enough for a whole panel beside the docked rail): vertical scrolling
 * slides one long strip sideways.
 * Strip = hero (one screen wide) | nav column | square panels (one screen tall each).
 *
 * Matches the Webflow interaction: the page is (strip travel - one screen width) tall,
 * and scroll position maps linearly onto the strip's travel.
 *
 * The nav column rides along until it reaches the left edge, then pins there; the first panel slides
 * under it, and when that panel reaches the docked rail's edge the column collapses to the slim rail
 * (see .rail in index.css). Panels then slide under the rail.
 */
export function DesktopGallery({
  category,
  onCategory,
  onOpen,
  startAtWork,
  startAtPanel,
  about,
  onAbout,
  onAboutSlide,
}: GalleryProps) {
  const frame = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  // Each side's row of panels. The strip is as long as the side that's showing, so DESIGN and VIDEO
  // can each have any number of projects without the shorter side ending in empty space.
  const rows = useRef<Record<Side, HTMLElement | null>>({ design: null, video: null, about: null })
  /*
    RESUME makes the about / resume slides the strip's third side (AboutLayer.tsx): they slide in from
    the right where DESIGN and VIDEO slide in from above and below, and the page scrolls through them
    the same way, back past the nav column to the hero. Between About and the resume it settles on
    one or the other when the scroll stops.
  */
  const side: Side = about.open ? 'about' : category
  const sideRef = useRef(side)
  const rail = useRef<HTMLElement | null>(null)
  const setRail = useCallback((el: HTMLElement | null) => {
    rail.current = el
  }, [])
  const [dims, setDims] = useState<Dims>({ travel: 0, height: 0, navLeft: 0, navW: 0, vw: 0 })
  const { scrollY } = useScroll()
  const x = useMotionValue(0)
  const pin = useMotionValue(0)
  const squeeze = useMotionValue(0)
  const reduce = useReducedMotion()

  /** The strip is gliding on to About as it opens from nearer the hero (the page scroll already jumped). */
  const gliding = useRef<AnimationPlaybackControls | null>(null)
  /** The resume slide: it scrolls on its own (when it's taller than the screen) only once it's fully in. */
  const resumeSlide = useRef<HTMLElement | null>(null)

  // Docked or not. The rail collapses on a trigger rather than following the scroll: it stays full
  // width while the first panel slides under it, and when the panel reaches the spot where the docked
  // rail's edge will be, it collapses with the same timing as the hover open (and opens again when
  // scrolled back past that spot). null = not decided yet (first measure: jump, don't animate).
  const docked = useRef<boolean | null>(null)

  /*
    The latest measurements, and (in update) the live page scroll. Placing the strip always reads
    these, never a render's copy or the scroll motion value, which only catches up on the next scroll
    event: when a side switch jumps the page scroll, re-placing from either stale number put the strip
    hundreds of pixels off for a frame (a sideways flash).
  */
  const dimsRef = useRef(dims)
  useLayoutEffect(() => {
    dimsRef.current = dims
  }, [dims])

  /** Put the strip at `offset` pixels along (and pin / dock the rail to match). */
  const place = useCallback((offset: number) => {
    const dims = dimsRef.current
    x.set(-offset)
    resumeSlide.current?.toggleAttribute('data-settled', offset >= dims.travel - 1)
    // Past the nav column's own position: hold it at the left edge.
    const past = offset - dims.navLeft
    pin.set(Math.max(0, past))
    if (dims.navW <= 0) return
    const point = dims.navW * (1 - RAIL_NARROW)
    const want = docked.current ? past > point - RAIL_TRIGGER_SLACK : past >= point
    if (want === docked.current) return
    const first = docked.current === null
    docked.current = want
    if (first) squeeze.set(want ? 1 : 0)
    else animate(squeeze, want ? 1 : 0, { duration: reduce ? 0 : RAIL_EXPAND_DURATION, ease: RAIL_EASE })
  }, [x, pin, squeeze, reduce])

  const update = useCallback(() => {
    if (gliding.current) return
    const { height, travel } = dimsRef.current
    const range = height - window.innerHeight
    const progress = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0
    place(progress * travel)
  }, [place])

  useMotionValueEvent(scrollY, 'change', update)
  // Re-placed whenever the measurements change too.
  useLayoutEffect(update, [update, dims])

  /** Pixels of page scroll per pixel the strip moves. */
  const ratio = useCallback(() => {
    const { travel, height } = dimsRef.current
    return travel > 0 ? (height - window.innerHeight) / travel : 1
  }, [])

  /** Slide the strip so it sits `offset` pixels along (0 = hero, travel = the end). */
  const goTo = useCallback(
    (offset: number, smooth: boolean) => {
      const { travel } = dimsRef.current
      window.scrollTo({ top: clamp(offset, 0, travel) * ratio(), behavior: smooth && !reduce ? 'smooth' : 'instant' })
    },
    [ratio, reduce],
  )

  /** An element's left edge and width within the strip (unaffected by the strip's current position). */
  const inStrip = (el: Element) => {
    const f = frame.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { left: r.left - f.left, width: r.width }
  }

  /** The strip position that shows a panel whole: centered in the space right of the docked rail. */
  const panelOffset = useCallback((panel: Element) => {
    const { navW } = dimsRef.current
    const vw = viewWidth()
    const railW = navW * RAIL_NARROW
    const { left, width } = inStrip(panel)
    const room = vw - railW
    return width < room ? left - railW - (room - width) / 2 : left - railW
  }, [])

  /**
   * Keyboard focus: bring whatever was focused into view. The strip container clips its overflow
   * (overflow: clip), so the browser can no longer scroll it sideways on its own; this moves the
   * page scroll instead, which keeps the strip and the scrollbar in sync.
   */
  const reveal = useCallback(
    (el: HTMLElement) => {
      if (!frame.current || dimsRef.current.travel <= 0) return
      const vw = viewWidth()
      const r = el.getBoundingClientRect()
      if (rail.current?.contains(el)) {
        // The docked rail is always on screen; before it docks, bring the column to the left edge.
        const box = rail.current.getBoundingClientRect()
        if (box.left < 0 || box.right > vw) goTo(dimsRef.current.navLeft, true)
        return
      }
      // About and the resume: tabbing into one brings it in.
      const slideEl = el.closest<HTMLElement>('[data-about-layer] [data-slide]')
      if (slideEl) {
        goTo(slideEl.dataset.slide === '1' ? dimsRef.current.travel : aboutStart(), true)
        return
      }
      const panel = el.closest('.panel')
      if (panel) {
        const box = panel.getBoundingClientRect()
        const railRight = Math.max(0, rail.current?.getBoundingClientRect().right ?? 0)
        if (box.left >= railRight - 1 && box.right <= vw + 1) return
        goTo(panelOffset(panel), true)
        return
      }
      // Anything else (the hero's scroll hint): back to the hero if it isn't fully on screen.
      if (r.left < 0 || r.right > vw) goTo(0, true)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goTo, panelOffset],
  )

  const onFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    let keyboard = true
    try {
      keyboard = el.matches(':focus-visible')
    } catch {
      // very old browsers: treat all focus as keyboard focus
    }
    // Next frame: Safari runs its own (here, empty) focus scroll after this event, which cancels a
    // smooth scroll started inside it.
    if (keyboard) requestAnimationFrame(() => reveal(el))
  }

  // Sideways input moves the strip too: swipe/scroll right (or down) goes forward,
  // left (or up) goes back. Trackpad swipes, Shift + mouse wheel, and arrow keys.
  useEffect(() => {
    const viewerOpen = () => document.documentElement.classList.contains('viewer-open')

    const onWheel = (e: WheelEvent) => {
      if (viewerOpen() || e.ctrlKey) return // ctrlKey = pinch-zoom on trackpads
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return // mostly vertical: native scroll handles it
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewWidth() : 1
      window.scrollBy({ top: e.deltaX * unit * ratio(), behavior: 'instant' })
    }

    // Left / right arrows step one stop at a time: hero, nav column, then each panel
    // (lined up against the docked rail), then the end of the strip.
    let pending: { offset: number; at: number } | null = null
    const onKey = (e: KeyboardEvent) => {
      if (viewerOpen() || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!frame.current) return
      e.preventDefault()
      const { travel, navLeft, navW } = dimsRef.current
      const stops = [0, navLeft, travel]
      frame.current.querySelectorAll('section:not([inert]) .panel').forEach((p) => {
        stops.push(inStrip(p).left - navW * RAIL_NARROW)
      })
      if (sideRef.current === 'about') stops.push(aboutStart())
      const sorted = [...new Set(stops.map((s) => Math.round(clamp(s, 0, travel))))].sort((a, b) => a - b)
      // While a smooth step is still gliding, step on from where it's headed, not from mid-glide.
      const now = performance.now()
      const from = pending && now - pending.at < 700 ? pending.offset : -x.get()
      const next =
        e.key === 'ArrowRight' ? sorted.find((s) => s > from + 2) : [...sorted].reverse().find((s) => s < from - 2)
      if (next === undefined) return
      pending = { offset: next, at: now }
      goTo(next, true)
    }

    // The page itself never scrolls sideways (only the strip moves). If anything ever nudges it,
    // put it back, or the pinned rail would slide part-way off the left edge.
    const onScroll = () => {
      if (window.scrollX !== 0) window.scrollTo({ left: 0, behavior: 'instant' })
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo, ratio, x])

  /**
    Where About sits: the rail just docked, About right beside it. A little past the exact docking
    point (more than one step of the page scroll), so the rail is sure to be docked there.
  */
  const aboutStart = useCallback(() => aboutStartFor(dimsRef.current), [])

  /** The strip's measurements with `cat` showing. */
  /** After a resize on About / the resume: the slide to put back on screen. */
  const resnap = useRef<AboutSlide | null>(null)
  useLayoutEffect(() => {
    if (resnap.current === null || sideRef.current !== 'about') return
    const to = resnap.current === 1 ? dims.travel : aboutStartFor(dims)
    resnap.current = null
    window.scrollTo({ top: to * ratio(), behavior: 'instant' })
  }, [dims, ratio])

  const measureFor = useCallback((s: Side): Dims | null => {
    const row = rows.current[s]
    if (!frame.current || !slot.current || (!row && s !== 'about')) return null
    const vw = viewWidth()
    const navLeft = slot.current.offsetLeft
    const navW = slot.current.offsetWidth
    // The about / resume slides are each a screen wide less the docked rail (worked out, not
    // measured: they may not be on the page yet, and they follow the screen size).
    const rowW = s === 'about' ? 2 * Math.round(vw - navW * RAIL_NARROW) : row!.offsetWidth
    // hero + nav column + this side's panels (the other sides' rows may be longer or shorter)
    const travel = Math.max(0, navLeft + navW + rowW - vw)
    return { travel, height: Math.max(travel - vw, window.innerHeight * 2), navLeft, navW, vw }
  }, [])

  useLayoutEffect(() => {
    const measure = () => {
      const before = dimsRef.current
      const at = -x.get()
      const next = measureFor(sideRef.current)
      if (!next) return
      dimsRef.current = next
      setDims(next)
      // Resized on the about / resume slides: stay on the same slide (the page scroll maps onto a
      // different length now, so it's set again).
      if (sideRef.current === 'about' && before.travel > 0 && !gliding.current) {
        const startWas = aboutStartFor(before)
        // (Applied once the page has its new height, below: until then the scroll can't reach it.)
        if (at >= startWas - 2) resnap.current = at - startWas > (before.travel - startWas) / 2 ? 1 : 0
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame.current!)
    for (const row of Object.values(rows.current)) if (row) ro.observe(row)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureFor, ratio])

  /*
    Switching sides. DESIGN / VIDEO start the new side at its beginning: the full nav column at the
    left edge with the first panel just to its right, the same spot as scrolling away from the hero,
    so scrolling on from there plays the same hold-then-collapse. RESUME starts on About, the rail
    docked beside it (or on the resume, from a "#about/resume" link). Nothing on screen jumps: in the
    same frame as the switch, the page scroll goes to that start and the side being left is nudged
    sideways by the same amount, so it still shows what it showed; then it slides away as the new
    side slides in (from below or above, or from the right for About). Once it's out of sight its
    nudge is removed. From nearer the hero than that start, nothing moves for DESIGN / VIDEO, and for
    About the strip glides on to it while it slides in. Leaving About or the resume, DESIGN / VIDEO
    push it out like they push each other: DESIGN drops in from above (pushing it down), VIDEO rises
    from below (pushing it up), the new row's own y (dropDesign / dropVideo) against the About row's.
  */
  const shiftDesign = useMotionValue(0)
  const shiftVideo = useMotionValue(0)
  const shiftAbout = useMotionValue(0)
  const dropDesign = useMotionValue(0)
  const dropVideo = useMotionValue(0)
  const prevSide = useRef(side)
  /** The page opened straight onto About ("/#about"): it's just there, it doesn't slide in. */
  const openedOnAbout = useRef(side === 'about')
  const settle = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    const prev = prevSide.current
    prevSide.current = side
    sideRef.current = side
    if (prev === side || dimsRef.current.travel <= 0) return
    openedOnAbout.current = false
    const shift = (c: Side) => (c === 'design' ? shiftDesign : c === 'video' ? shiftVideo : shiftAbout)
    const incoming = shift(side)
    const outgoing = shift(prev)
    window.clearTimeout(settle.current)
    gliding.current?.stop()
    gliding.current = null
    // Switched back mid-slide: glide the returning side home along with the slide.
    if (incoming.get() !== 0) animate(incoming, 0, { duration: reduce ? 0 : 0.25, ease: 'easeInOut' })
    // Leaving About / the resume: the new row pushes in from above (DESIGN) or below (VIDEO).
    if (prev === 'about' && side !== 'about') {
      const drop = side === 'design' ? dropDesign : dropVideo
      drop.set(side === 'design' ? -window.innerHeight : window.innerHeight)
      animate(drop, 0, { duration: reduce ? 0 : PUSH_DURATION, ease: 'easeInOut' })
    }
    const offset = -x.get()
    // The new side has its own length: measure it now, before working out any scroll position, so
    // the page height and the scroll-to-strip mapping are the new side's from this frame on.
    const next = measureFor(side)
    if (next) {
      dimsRef.current = next
      setDims(next)
    }
    const { travel, height } = dimsRef.current
    const start = side === 'about' ? (about.slide === 1 ? travel : aboutStart()) : dimsRef.current.navLeft
    const range = height - window.innerHeight
    if (offset > start + 1) {
      window.scrollTo({ top: start * ratio(), behavior: 'instant' })
      const landed = range > 0 ? (window.scrollY / range) * travel : start
      outgoing.set(outgoing.get() - (offset - landed))
      place(landed)
    } else if (side === 'about' && offset < start - 1) {
      window.scrollTo({ top: start * ratio(), behavior: 'instant' })
      const to = range > 0 ? (window.scrollY / range) * travel : start
      const glide = animate(offset, to, {
        duration: reduce ? 0 : ABOUT_SLIDE_DURATION + 0.1,
        ease: [0.65, 0, 0.35, 1],
        onUpdate: place,
      })
      gliding.current = glide
      void glide.then(() => {
        if (gliding.current === glide) gliding.current = null
      })
    } else {
      // Near the start nothing moves: keep the strip exactly where it is under the new mapping.
      window.scrollTo({ top: offset * ratio(), behavior: 'instant' })
      place(offset)
    }
    settle.current = window.setTimeout(() => outgoing.set(0), reduce ? 0 : ABOUT_SLIDE_DURATION * 1000 + 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, measureFor, place, ratio, reduce, shiftDesign, shiftVideo, shiftAbout, dropDesign, dropVideo, x])
  useEffect(() => () => gliding.current?.stop(), [])

  // RESUME pressed (or a link followed) while the about / resume slides are already showing: glide
  // to the slide asked for.
  const aboutSeq = useRef(about.seq)
  useEffect(() => {
    if (aboutSeq.current === about.seq) return
    aboutSeq.current = about.seq
    if (side === 'about' && prevSide.current === 'about') goTo(about.slide === 1 ? dimsRef.current.travel : aboutStart(), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about.seq])

  // Between About and the resume, a scroll that stops part-way carries on to the slide it was heading
  // for (ABOUT_COMMIT is enough), or goes back to the one it started from. Nearer the hero than About
  // the strip stays wherever it's left, like the work.
  useEffect(() => {
    let timer = 0
    /** Where the strip last came to rest: a scroll's direction is measured from there. */
    let rest: number | null = null
    const offsetNow = () => {
      const range = dimsRef.current.height - window.innerHeight
      return range > 0 ? clamp(window.scrollY / range, 0, 1) * dimsRef.current.travel : 0
    }
    const onScroll = () => {
      if (sideRef.current !== 'about' || gliding.current) {
        rest = null
        return
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const now = offsetNow()
        const began = rest ?? now
        rest = now
        if (sideRef.current !== 'about') return
        const a = aboutStart()
        const r = dimsRef.current.travel
        if (now < a - 1) return onAboutSlide(0)
        if (now >= r - 1) return onAboutSlide(1)
        if (now <= a + 1) return onAboutSlide(0)
        const moved = now - began
        const toResume =
          moved > ABOUT_COMMIT ? true : moved < -ABOUT_COMMIT ? false : Math.abs(began - r) < Math.abs(began - a)
        rest = toResume ? r : a
        onAboutSlide(toResume ? 1 : 0)
        goTo(rest, true)
      }, SETTLE_AFTER)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo, onAboutSlide])
  useEffect(() => () => window.clearTimeout(settle.current), [])

  /** Scroll hint: glide to where the nav column reaches the left edge. */
  const scrollToWork = () => goTo(dims.navLeft, true)

  // Links like "/#video" land on the work, not the hero, "/?panel=nsyte" lands on that project, and
  // "/#about" opens with the rail docked beside the about / resume panel (once, as soon as the strip
  // is measured).
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || dims.travel <= 0 || !(startAtWork || startAtPanel || sideRef.current === 'about')) return
    landed.current = true
    if (sideRef.current === 'about') {
      goTo(about.slide === 1 ? dims.travel : aboutStart(), false)
      return
    }
    const panel = startAtPanel && frame.current?.querySelector(`.panel[data-project="${CSS.escape(startAtPanel)}"]`)
    goTo(panel ? panelOffset(panel) : dims.navLeft, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAtWork, startAtPanel, dims, goTo, panelOffset])

  /** Logo: back to the hero. From About / the resume it scrolls back the way it came, like the work. */
  const goHome = () => goTo(0, true)

  /** RESUME: the about / resume slides, on About (or, if they're showing, back to About). */
  const openAbout = () => onAbout(0)

  // The about / resume slides are on the page while they show, and while they slide away. (Read
  // during render on purpose: on the render that closes them, the switch effect hasn't run yet, so
  // prevSide still says "about" and they stay for their slide out.)
  const [keepAbout, setKeepAbout] = useState(false)
  const showAbout = side === 'about' || prevSide.current === 'about' || keepAbout
  useLayoutEffect(() => {
    if (side === 'about') return setKeepAbout(false)
    setKeepAbout(true)
    const t = window.setTimeout(() => setKeepAbout(false), ABOUT_SLIDE_DURATION * 1000 + 100)
    return () => window.clearTimeout(t)
  }, [side])
  // A DESIGN / VIDEO switch made from About (it closes it) happens out of sight, under the slides as
  // they slide away, so the rows swap without their own slide.
  const underPanel = showAbout

  const slideW = Math.max(0, Math.round(dims.vw - dims.navW * RAIL_NARROW))

  /** Skip link: straight to the first project of the current category. */
  const skipToWork = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const first = frame.current?.querySelector<HTMLElement>('section:not([inert]) .panel')
    if (!first) return
    first.focus({ preventScroll: true })
    goTo(panelOffset(first), true)
  }

  return (
    <main style={{ height: dims.height || '100vh' }}>
      <a
        href="#nav"
        onClick={skipToWork}
        className="sr-only z-50 bg-sand px-4 py-2 font-ddc text-[18px] text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-2 focus:outline-offset-2 focus:outline-sand"
      >
        Skip to work
      </a>
      {/* overflow-clip, not hidden: a hidden box can still be scrolled by the browser (keyboard focus did exactly that).
          w-full, not w-screen: 100vw includes a classic scrollbar. The hero is one container width (100cqw). */}
      <div className="sticky top-0 h-screen w-full overflow-clip [container-type:inline-size]">
        <motion.div
          ref={frame}
          style={{ x }}
          onFocusCapture={onFocusCapture}
          className="flex h-full w-max will-change-transform"
        >
          <Hero onScrollHint={scrollToWork} className="h-screen w-[100cqw]" />
          <NavColumn
            category={category}
            onCategory={onCategory}
            pin={pin}
            squeeze={squeeze}
            slotRef={slot}
            onRail={setRail}
            onHome={goHome}
            onResume={openAbout}
            resumeActive={about.open}
            categoryActive={!about.open}
          />
          <div className="relative h-screen flex-none overflow-visible">
            <motion.div
              initial={false}
              animate={{ y: category === 'video' ? '-100vh' : '0vh' }}
              transition={{ duration: reduce || underPanel ? 0 : 0.25, ease: 'easeInOut' }}
              inert={about.open}
              className="flex flex-col items-start"
            >
              {(['design', 'video'] as const).map((cat) => (
                <motion.section
                  key={cat}
                  ref={(el: HTMLElement | null) => {
                    rows.current[cat] = el
                  }}
                  aria-label={cat === 'design' ? 'Design work' : 'Video work'}
                  aria-hidden={cat !== category}
                  inert={cat !== category}
                  style={{ x: cat === 'design' ? shiftDesign : shiftVideo, y: cat === 'design' ? dropDesign : dropVideo }}
                  className="flex h-screen"
                >
                  {byCategory[cat].map((p, i) => (
                    <ProjectPanel
                      key={p.id}
                      project={p}
                      onOpen={onOpen}
                      eager={cat === 'design' && i < 2}
                      className="h-screen w-[100vh]"
                    />
                  ))}
                </motion.section>
              ))}
            </motion.div>
            {showAbout && (
              <AboutRow
                open={about.open}
                slideW={slideW}
                shift={shiftAbout}
                appear={!openedOnAbout.current}
                exit={category === 'video' ? 'up' : 'down'}
                rowRef={(el) => {
                  rows.current.about = el
                  resumeSlide.current = el?.querySelector<HTMLElement>('[data-slide="1"]') ?? null
                }}
                onNext={() => goTo(dimsRef.current.travel, true)}
              />
            )}
          </div>
        </motion.div>
      </div>
    </main>
  )
}
