import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { byCategory, withBase, type Category, type Project } from '../content'
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
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Visible page width. Not window width or 100vw: those include a classic (always-shown) scrollbar,
 * and anything that wide gives the page a sideways scroll that keyboard focus can nudge.
 */
const viewWidth = () => document.documentElement.clientWidth

/**
 * Desktop (992px+ and landscape): vertical scrolling slides one long strip sideways.
 * Strip = hero (one screen wide) | nav column | square panels (one screen tall each).
 *
 * Matches the Webflow interaction: the page is (strip travel - one screen width) tall,
 * and scroll position maps linearly onto the strip's travel.
 *
 * The nav column rides along until it reaches the left edge, then pins there; the first panel slides
 * under it, and when that panel reaches the docked rail's edge the column collapses to the slim rail
 * (see .rail in index.css). Panels then slide under the rail.
 */
export function DesktopGallery({ category, onCategory, onOpen, startAtWork, startAtPanel }: GalleryProps) {
  const frame = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLElement | null>(null)
  const setRail = useCallback((el: HTMLElement | null) => {
    rail.current = el
  }, [])
  const [dims, setDims] = useState<Dims>({ travel: 0, height: 0, navLeft: 0, navW: 0 })
  const { scrollY } = useScroll()
  const x = useMotionValue(0)
  const pin = useMotionValue(0)
  const squeeze = useMotionValue(0)
  const reduce = useReducedMotion()

  // Docked or not. The rail collapses on a trigger rather than following the scroll: it stays full
  // width while the first panel slides under it, and when the panel reaches the spot where the docked
  // rail's edge will be, it collapses with the same timing as the hover open (and opens again when
  // scrolled back past that spot). null = not decided yet (first measure: jump, don't animate).
  const docked = useRef<boolean | null>(null)

  /** Put the strip at `offset` pixels along (and pin / dock the rail to match). */
  const place = useCallback((offset: number) => {
    x.set(-offset)
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
  }, [dims, x, pin, squeeze, reduce])

  const update = useCallback(() => {
    const range = dims.height - window.innerHeight
    const progress = range > 0 ? Math.min(1, Math.max(0, scrollY.get() / range)) : 0
    place(progress * dims.travel)
  }, [dims, scrollY, place])

  useMotionValueEvent(scrollY, 'change', update)
  useLayoutEffect(update, [update])

  const dimsRef = useRef(dims)
  useLayoutEffect(() => {
    dimsRef.current = dims
  }, [dims])

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
  }, [goTo, ratio, x])

  useLayoutEffect(() => {
    const measure = () => {
      if (!frame.current || !slot.current) return
      const vw = viewWidth()
      const travel = frame.current.getBoundingClientRect().width - vw
      setDims({
        travel,
        height: Math.max(travel - vw, window.innerHeight * 2),
        navLeft: slot.current.offsetLeft,
        navW: slot.current.offsetWidth,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame.current!)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  /*
    Switching DESIGN / VIDEO starts the new side at its beginning: the full nav column at the left
    edge with the first panel just to its right, the same spot as scrolling away from the hero, so
    scrolling on from there plays the same hold-then-collapse. Nothing on screen jumps: in the same
    frame as the switch, the page scroll goes back to that start and the side being left is nudged
    sideways by the same amount, so it still shows what it showed; then it slides away as usual while
    the new side slides in at its first panel (and the rail opens back to full width). Once it's out
    of sight its nudge is removed. Nearer the start than that, nothing changes.
  */
  const shiftDesign = useMotionValue(0)
  const shiftVideo = useMotionValue(0)
  const prevCategory = useRef(category)
  const settle = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    const prev = prevCategory.current
    prevCategory.current = category
    if (prev === category || dimsRef.current.travel <= 0) return
    const shift = (c: Category) => (c === 'design' ? shiftDesign : shiftVideo)
    const incoming = shift(category)
    const outgoing = shift(prev)
    window.clearTimeout(settle.current)
    // Switched back mid-slide: glide the returning side home along with the slide.
    if (incoming.get() !== 0) animate(incoming, 0, { duration: reduce ? 0 : 0.25, ease: 'easeInOut' })
    const { navLeft, travel, height } = dimsRef.current
    const start = navLeft
    const offset = -x.get()
    if (offset > start + 1) {
      window.scrollTo({ top: start * ratio(), behavior: 'instant' })
      const range = height - window.innerHeight
      const landed = range > 0 ? (window.scrollY / range) * travel : start
      outgoing.set(outgoing.get() - (offset - landed))
      place(landed)
    }
    settle.current = window.setTimeout(() => outgoing.set(0), reduce ? 0 : 300)
  }, [category, place, ratio, reduce, shiftDesign, shiftVideo, x])
  useEffect(() => () => window.clearTimeout(settle.current), [])

  /** Scroll hint: glide to where the nav column reaches the left edge. */
  const scrollToWork = () => goTo(dims.navLeft, true)

  // Links like "/#video" land on the work, not the hero, and "/?panel=nsyte" lands on that project
  // (once, as soon as the strip is measured).
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || dims.travel <= 0 || !(startAtWork || startAtPanel)) return
    landed.current = true
    const panel = startAtPanel && frame.current?.querySelector(`.panel[data-project="${CSS.escape(startAtPanel)}"]`)
    goTo(panel ? panelOffset(panel) : dims.navLeft, false)
  }, [startAtWork, startAtPanel, dims, goTo, panelOffset])

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
            onHome={() => goTo(0, true)}
            resumeHref={withBase('/about/')}
          />
          <div className="h-screen flex-none overflow-visible">
            <motion.div
              initial={false}
              animate={{ y: category === 'video' ? '-100vh' : '0vh' }}
              transition={{ duration: reduce ? 0 : 0.25, ease: 'easeInOut' }}
              className="flex flex-col"
            >
              {(['design', 'video'] as const).map((cat) => (
                <motion.section
                  key={cat}
                  aria-label={cat === 'design' ? 'Design work' : 'Video work'}
                  aria-hidden={cat !== category}
                  inert={cat !== category}
                  style={{ x: cat === 'design' ? shiftDesign : shiftVideo }}
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
          </div>
        </motion.div>
      </div>
    </main>
  )
}
