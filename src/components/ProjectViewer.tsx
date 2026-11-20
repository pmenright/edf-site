import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import LiteYouTubeEmbed from 'react-lite-youtube-embed'
import closeX from '../assets/brand/close-x.svg'
import { getAsset, type DocumentMedia, type ImageMedia, type MediaAsset, type Project, type YouTubeMedia, withBase } from '../content'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { holdPage } from '../lib/popup'
import { isMediaReady, isReady, preloadMedia } from '../lib/preload'
import { Picture } from './Picture'

const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'])
// Swapping between a project's main view and its alternate (Watch video / See design).
const SWAP_EASE = [0.22, 1, 0.36, 1] as const
// Scrolling swaps too: the card gives a little (up to PULL_GIVE px), then snaps to the other view once
// the scroll adds up to PULL_WHEEL px of wheel/trackpad travel or PULL_TOUCH px of finger travel.
const PULL_GIVE = 44
const PULL_WHEEL = 160
const PULL_TOUCH = 80
const DOWN_KEYS = new Set(['ArrowDown', 'PageDown'])
const UP_KEYS = new Set(['ArrowUp', 'PageUp'])

interface ViewerProps {
  project: Project
  /** Session-wide: once someone opens the description it stays open between projects. */
  descriptionOpen: boolean
  onDescriptionOpen: (open: boolean) => void
  onClose: () => void
}

/**
 * Full-screen project viewer (replaces the 24 Webflow lightboxes).
 * Native <dialog>: Esc, focus handling and screen-reader semantics come built in.
 * Opens with the artwork sliding up, the backdrop dimming and the buttons sliding in from the right.
 */
export function ProjectViewer({ project, descriptionOpen, onDescriptionOpen, onClose }: ViewerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const reduce = useReducedMotion()
  const portrait = useMediaQuery('(orientation: portrait)')
  const [descHeight, setDescHeight] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [hiddenForPlayback, setHiddenForPlayback] = useState(false)
  const [showAlternate, setShowAlternate] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const documentScroller = useRef<HTMLDivElement>(null)
  const downloadButton = useRef<HTMLButtonElement>(null)
  const linkAttention = useAttention()
  const alternateAttention = useAttention()
  const media = project.media[0]
  const alternate = project.alternate
  // DESCRIPTION shows a project's title, discipline or video details, and text. The resume has none of
  // those, so it gets no DESCRIPTION button.
  const hasDescription = !!(project.description || project.discipline || project.duties)
  const extraRow = hasDescription ? 'max-sm:order-3 max-sm:mr-2.5' : ''
  const showDescription = descriptionOpen && !hiddenForPlayback && hasDescription
  // On tall screens, lift the artwork into the space above the text instead of covering it.
  const lifted = portrait && showDescription
  const stageBottom = lifted ? Math.max(0, descHeight - 64) : 0
  const stageTop = lifted ? 76 : 0 // clear the DESCRIPTION / close buttons

  useEffect(() => {
    const d = dialog.current!
    if (!d.open) d.showModal()
    heading.current?.focus({ preventScroll: true })

    // Stop the page behind from scrolling while the viewer is up. This deliberately does NOT
    // set overflow: hidden on the page: in Firefox that breaks the sticky gallery and it vanishes.
    // The class only tells the gallery's own wheel/arrow handlers to stand down.
    const release = holdPage()
    // The description text and a document's pages scroll themselves; any other scrolling inside the
    // viewer is either a pull toward the project's other view (pullHandlers) or nothing at all.
    const onWheel = (e: WheelEvent) => pullHandlers.current.wheel(e)
    const onTouchStart = (e: TouchEvent) => pullHandlers.current.touchStart(e)
    const onTouchMove = (e: TouchEvent) => pullHandlers.current.touchMove(e)
    const onTouchEnd = () => pullHandlers.current.touchEnd()
    d.addEventListener('wheel', onWheel, { passive: false })
    d.addEventListener('touchstart', onTouchStart, { passive: true })
    d.addEventListener('touchmove', onTouchMove, { passive: false })
    d.addEventListener('touchend', onTouchEnd)
    d.addEventListener('touchcancel', onTouchEnd)

    // Esc is handled here rather than through the dialog's cancel event. Firefox only lets a page
    // hold a dialog open on Esc once per click, so a second Esc (description, then viewer) used to
    // slam the dialog shut with no exit animation.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      escape.current()
    }
    window.addEventListener('keydown', onEsc, true)
    return () => {
      release()
      d.removeEventListener('wheel', onWheel)
      d.removeEventListener('touchstart', onTouchStart)
      d.removeEventListener('touchmove', onTouchMove)
      d.removeEventListener('touchend', onTouchEnd)
      d.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('keydown', onEsc, true)
    }
  }, [])

  const closedRef = useRef(false)
  const finishClose = () => {
    if (closedRef.current) return
    closedRef.current = true
    dialog.current?.close()
    onClose()
  }
  const close = () => setLeaving(true)

  // Safety net in case the exit animation never reports back (e.g. tab hidden mid-animation).
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(finishClose, 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // Esc closes the description first, then the viewer.
  const escape = useRef(() => {})
  useEffect(() => {
    escape.current = () =>
      downloadOpen ? setDownloadOpen(false) : showDescription ? onDescriptionOpen(false) : close()
  })

  // Fetch the alternate view's image (or video preview frame) now, so it's there when it slides in.
  useEffect(() => {
    if (project.alternate) void preloadMedia(project.alternate.media)
  }, [project])

  // When the download popup closes, put focus back on the button that opened it.
  const wasDownloadOpen = useRef(false)
  useEffect(() => {
    if (wasDownloadOpen.current && !downloadOpen) downloadButton.current?.focus({ preventScroll: true })
    wasDownloadOpen.current = downloadOpen
  }, [downloadOpen])

  const showView = (alt: boolean) => {
    alternateAttention.stop()
    setShowAlternate(alt)
    setDeckScrolled(false)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = 0
    // A video playing on a wide screen hid the description; bring it back with the design.
    setHiddenForPlayback(false)
  }
  const toggleAlternate = () => showView(!showAlternate)

  // Scroll to swap. Scrolling down on the main view pulls the alternate up; scrolling up on the
  // alternate (at the top of a document) pulls the main view back. The card gives a little first,
  // springs back if the scroll stops short, and snaps across once it's far enough.
  const pullY = useMotionValue(0)
  const pull = useRef({ amount: 0, release: 0, locked: false, lockStart: 0, last: 0, native: 0, touchY: 0, touchMode: '' })
  // +1: down pulls the alternate up, -1: up pulls the main view back, 0: nothing to pull to
  const pullDir = alternate && !downloadOpen && !leaving ? (showAlternate ? -1 : 1) : 0
  const giveFor = (amount: number, full: number) =>
    reduce ? 0 : PULL_GIVE * (1 - (1 - Math.min(1, amount / full)) ** 2)
  const springBack = () => {
    pull.current.amount = 0
    animate(pullY, 0, { type: 'spring', stiffness: 500, damping: 34 })
  }
  const pullSwap = (dir: number) => {
    const s = pull.current
    window.clearTimeout(s.release)
    s.amount = 0
    // swallow the rest of this flick (trackpad momentum) so it doesn't scroll or swap again
    s.locked = true
    s.lockStart = s.last = performance.now()
    animate(pullY, 0, swap)
    showView(dir > 0)
  }
  const pullHandlers = useRef({
    wheel: (_e: WheelEvent) => {},
    touchStart: (_e: TouchEvent) => {},
    touchMove: (_e: TouchEvent) => {},
    touchEnd: () => {},
  })
  useEffect(() => {
    const s = pull.current
    pullHandlers.current = {
      wheel: (e) => {
        const now = performance.now()
        if (s.locked) {
          if (now - s.last < 220 && now - s.lockStart < 1500) {
            s.last = now
            e.preventDefault()
            return
          }
          s.locked = false
        }
        const t = e.target instanceof Element ? e.target : null
        if (t?.closest('#project-description')) return
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1)
        const deck = t?.closest<HTMLElement>('[data-viewer-scroll]')
        if (deck) {
          // The pages scroll themselves. Only a fresh upward scroll at the very top pulls the design
          // back: momentum that carries a fast scroll up to the top doesn't count.
          if (dy >= 0 || deck.scrollTop > 0 || now - s.native < 250) {
            s.native = now
            return
          }
        }
        e.preventDefault()
        if (!pullDir || dy === 0) return
        s.amount = Math.max(0, s.amount + (Math.sign(dy) === pullDir ? Math.abs(dy) : -Math.abs(dy)))
        if (s.amount >= PULL_WHEEL) return pullSwap(pullDir)
        pullY.set(-pullDir * giveFor(s.amount, PULL_WHEEL))
        window.clearTimeout(s.release)
        s.release = window.setTimeout(springBack, 160)
      },
      touchStart: (e) => {
        s.touchY = e.touches[0].clientY
        s.touchMode = ''
        s.amount = 0
      },
      touchMove: (e) => {
        if (e.touches.length > 1) return // two fingers: the browser's pinch-zoom, not a swipe
        const t = e.target instanceof Element ? e.target : null
        if (t?.closest('#project-description')) return
        const dy = s.touchY - e.touches[0].clientY // finger moving up = scrolling down
        const deck = t?.closest<HTMLElement>('[data-viewer-scroll]')
        if (deck) {
          if (!s.touchMode) s.touchMode = dy < 0 && deck.scrollTop <= 0 ? 'pull' : 'native'
          if (s.touchMode === 'native') return
        }
        e.preventDefault()
        if (s.touchMode === 'done' || !pullDir || e.touches.length > 1) return
        s.amount = Math.max(0, pullDir * dy)
        if (s.amount >= PULL_TOUCH) {
          s.touchMode = 'done'
          return pullSwap(pullDir)
        }
        pullY.set(-pullDir * giveFor(s.amount, PULL_TOUCH))
      },
      touchEnd: () => {
        if (s.touchMode !== 'done' && s.amount > 0) springBack()
      },
    }
  })

  // The presentation's scroll hint: shows after the pages slide in, leaves once they're scrolled.
  const [deckScrolled, setDeckScrolled] = useState(false)
  const hintTimer = useRef(0)
  const onDeckScroll = () => {
    if (!hintTimer.current) hintTimer.current = window.setTimeout(() => {
      hintTimer.current = 0
      setDeckScrolled(true)
    }, 400)
  }
  // What's on screen: the main view or the alternate.
  const shown = showAlternate && alternate ? alternate.media : media
  const showDeckHint = shown.type === 'document' && !deckScrolled && !leaving
  const onVideoPlay = () => {
    // A playing video sits under the text on wide screens; get out of the way.
    if (!portrait) setHiddenForPlayback(true)
  }
  const swap = { duration: reduce ? 0 : 0.4, ease: SWAP_EASE }

  const toggleDescription = () => {
    if (showDescription) onDescriptionOpen(false)
    else {
      setHiddenForPlayback(false)
      onDescriptionOpen(true)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="viewer"
      aria-label={project.title}
      onCancel={(e) => {
        // Other close requests (e.g. the Android back gesture) go the same way as Esc.
        e.preventDefault()
        escape.current()
      }}
      onClose={() => {
        // If the browser closed the dialog by itself, tidy up straight away.
        if (closedRef.current) return
        closedRef.current = true
        onClose()
      }}
      onKeyDown={(e) => {
        if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey && !downloadOpen && hasDescription) toggleDescription()
        const target = e.target as HTMLElement
        if (SCROLL_KEYS.has(e.key) && !target.closest('#project-description')) {
          if (e.key === ' ' && target.closest('button')) return // space still presses buttons
          const down = DOWN_KEYS.has(e.key) || (e.key === ' ' && !e.shiftKey)
          const up = UP_KEYS.has(e.key) || (e.key === ' ' && e.shiftKey)
          const deck = shown.type === 'document' ? documentScroller.current : null
          if (deck) {
            // A document scrolls with the keys wherever focus is; going up past its top returns to the design.
            if (up && deck.scrollTop <= 0 && pullDir === -1) {
              e.preventDefault()
              pullSwap(-1)
            } else if (!target.closest('[data-viewer-scroll]')) {
              e.preventDefault()
              scrollByKey(deck, e.key, e.shiftKey, !!reduce)
            }
            return
          }
          e.preventDefault()
          if ((pullDir === 1 && down) || (pullDir === -1 && up)) pullSwap(pullDir)
        }
      }}
    >
      {/* Three layers move together on one clock (CSS animations in index.css, so the browser runs
          them on the compositor and image loading or React work can't make them stutter):
          the backdrop dims in place, the artwork slides up from the bottom, the buttons slide in
          from the right. Closing plays the same thing in reverse. */}
      <div
        className="viewer-backdrop absolute inset-0 bg-black/80"
        data-leaving={leaving || undefined}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && leaving) finishClose()
        }}
      />

      <h2 ref={heading} tabIndex={-1} className="sr-only">
        {project.title}
      </h2>

      <div className="viewer-slide absolute inset-0" data-leaving={leaving || undefined} inert={downloadOpen}>
        <motion.div
          className="absolute inset-x-0 [container-type:size]"
          style={{ top: 0, bottom: 0 }}
          initial={false}
          animate={{ top: stageTop, bottom: stageBottom }}
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeInOut' }}
        >
          {/* Watch video: the design slides up and away while the video slides up into its place.
              See design reverses it. The view that leaves is removed, which also stops the video.
              The outer layer is the scroll-to-swap "give" (pullY). */}
          <motion.div className="absolute inset-0" style={{ y: pullY }}>
          <AnimatePresence initial={false}>
            {showAlternate && alternate ? (
              <motion.div
                key="alternate"
                className="absolute inset-0"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                exit={{ y: '110%' }}
                transition={swap}
              >
                {alternate.media.type === 'image' ? (
                  <ImageStage media={alternate.media} preloaded={isMediaReady(alternate.media)} onClose={close} />
                ) : alternate.media.type === 'document' ? (
                  <DocumentStage media={alternate.media} onClose={close} scroller={documentScroller} onScroll={onDeckScroll} />
                ) : (
                  <VideoStage media={alternate.media} onBackdrop={close} onPlay={onVideoPlay} />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="main"
                className="absolute inset-0"
                initial={{ y: '-110%' }}
                animate={{ y: 0 }}
                exit={{ y: '-110%' }}
                transition={swap}
              >
                {media.type === 'image' ? (
                  <ImageStage media={media} preloaded={isReady(project)} onClose={close} />
                ) : media.type === 'document' ? (
                  <DocumentStage media={media} onClose={close} scroller={documentScroller} onScroll={onDeckScroll} />
                ) : (
                  <VideoStage media={media} onBackdrop={close} onPlay={onVideoPlay} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* The text rides in with the artwork when it was already open from the last project. */}
        <AnimatePresence initial={false}>
          {showDescription && <Description project={project} onHeight={setDescHeight} />}
        </AnimatePresence>
      </div>

      <div
        className="viewer-controls absolute top-[30px] right-[30px] z-10 flex items-center gap-3 max-sm:pointer-events-none max-sm:left-3 max-sm:right-3 max-sm:flex-wrap max-sm:justify-end max-sm:gap-x-2 max-sm:gap-y-0 max-sm:*:pointer-events-auto"
        data-leaving={leaving || undefined}
        inert={downloadOpen}
      >
        {/* On phones a project's extra button (Visit site, Watch video...) drops to its own row,
            right under DESCRIPTION and close, so long labels never push them off the screen. With
            no DESCRIPTION (the resume) it stays beside close. */}
        {(project.link || alternate) && hasDescription && <div aria-hidden="true" className="hidden h-0 basis-full max-sm:order-2 max-sm:block" />}
        {project.link &&
          (project.link.download ? (
            // A file to download: opens a small popup with the actual download button.
            <button
              ref={downloadButton}
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                linkAttention.stop()
                setDownloadOpen(true)
              }}
              className={`group grid h-11 cursor-pointer place-items-center outline-none ${extraRow}`}
              onPointerEnter={linkAttention.stop}
            >
              <span
                className={`${linkAttention.on ? 'viewer-attention ' : ''}block ${EXTRA_BUTTON}`}
                onAnimationEnd={linkAttention.stop}
              >
                {project.link.label}
              </span>
            </button>
          ) : (
            <a
              href={withBase(project.link.href)}
              target="_blank"
              rel="noopener"
              aria-label={`${project.link.label} (opens in a new tab)`}
              className={`group grid h-11 cursor-pointer place-items-center outline-none ${extraRow}`}
              onPointerEnter={linkAttention.stop}
            >
              <span
                className={`${linkAttention.on ? 'viewer-attention ' : ''}block ${EXTRA_BUTTON}`}
                onAnimationEnd={linkAttention.stop}
              >
                {project.link.label}
              </span>
            </a>
          ))}
        {alternate && (
          <button
            type="button"
            onClick={toggleAlternate}
            className={`group grid h-11 cursor-pointer place-items-center outline-none ${extraRow}`}
            onPointerEnter={alternateAttention.stop}
          >
            <span
              className={`${alternateAttention.on ? 'viewer-attention ' : ''}block ${EXTRA_BUTTON}`}
              onAnimationEnd={alternateAttention.stop}
            >
              {showAlternate ? alternate.backLabel : alternate.label}
            </span>
          </button>
        )}
        {hasDescription && (
          <button
            type="button"
            onClick={toggleDescription}
            aria-expanded={showDescription}
            aria-controls="project-description"
            className="group grid h-11 cursor-pointer place-items-center outline-none"
          >
            <span
              className={`block h-[30px] border-2 border-sand px-3 max-sm:px-2 font-ddc text-[14px] leading-[26px] tracking-[0.08em] max-sm:text-[12px] max-sm:tracking-[0.05em] uppercase transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-sand ${
                showDescription ? 'bg-sand text-ink' : 'bg-ink/40 text-sand group-hover:bg-sand/15'
              }`}
            >
              Description
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="group grid size-11 cursor-pointer place-items-center outline-none"
        >
          <img
            src={closeX}
            alt=""
            className="size-[25px] rounded-full transition-transform duration-200 ease-in-out group-hover:scale-130 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-sand"
          />
        </button>
      </div>

      <AnimatePresence>{showDeckHint && <ScrollHint reduce={!!reduce} />}</AnimatePresence>

      <AnimatePresence>
        {downloadOpen && project.link?.download && (
          <DownloadPopup
            title={project.link.downloadTitle ?? project.link.label}
            href={withBase(project.link.href)}
            file={project.link.download}
            reduce={!!reduce}
            onClose={() => setDownloadOpen(false)}
          />
        )}
      </AnimatePresence>
    </dialog>
  )
}

/**
 * Small popup over the viewer for a project's download (the Miami typeface): headline, DOWNLOAD
 * button, close. Esc, the close button or a click outside the panel closes it; so does downloading.
 */
function DownloadPopup({
  title,
  href,
  file,
  reduce,
  onClose,
}: {
  title: string
  href: string
  file: string
  reduce: boolean
  onClose: () => void
}) {
  const download = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    download.current?.focus({ preventScroll: true })
  }, [])
  const timing = { duration: reduce ? 0 : 0.25, ease: SWAP_EASE }
  return (
    <motion.div
      className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={timing}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
        className="relative w-full max-w-[520px] border-2 border-sand bg-ink px-8 pt-12 pb-9 text-center font-ddc text-sand"
        initial={{ y: reduce ? 0 : 24 }}
        animate={{ y: 0 }}
        exit={{ y: reduce ? 0 : 24 }}
        transition={timing}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="group absolute top-2 right-2 grid size-11 cursor-pointer place-items-center outline-none"
        >
          <img
            src={closeX}
            alt=""
            className="size-[22px] rounded-full transition-transform duration-200 ease-in-out group-hover:scale-130 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-sand"
          />
        </button>
        <h2 id="download-title" className="text-[24px] leading-[1.3] text-balance">
          {title}
        </h2>
        <a
          ref={download}
          href={href}
          download={file}
          aria-label={`Download ${file}`}
          // the download has started; give it a beat, then step back to the viewer
          onClick={() => window.setTimeout(onClose, 200)}
          className="group mt-7 inline-grid cursor-pointer place-items-center outline-none"
        >
          <span className="block h-[40px] border-2 border-sand bg-sand px-6 text-[16px] leading-[36px] tracking-[0.08em] text-ink uppercase transition-colors group-hover:bg-transparent group-hover:text-sand group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-sand">
            Download
          </span>
        </a>
      </motion.div>
    </motion.div>
  )
}

/** Look of a project's extra buttons (Visit site, Watch video): like DESCRIPTION, filling in on hover. */
const EXTRA_BUTTON =
  'h-[30px] border-2 border-sand bg-ink/40 px-3 max-sm:px-2 font-ddc text-[14px] leading-[26px] tracking-[0.08em] max-sm:text-[12px] max-sm:tracking-[0.05em] whitespace-nowrap text-sand uppercase transition-colors group-hover:bg-sand group-hover:text-ink group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-sand'

/**
 * A button's one-time call for attention (the .viewer-attention flash in index.css). It plays once,
 * right after the viewer slides in. Hovering or pressing the button ends it, and once it has ended it
 * doesn't come back while the viewer stays open. (Not ended on focus: Firefox's showModal focuses the
 * first button for a moment while the viewer opens, which would cancel it before it starts.)
 */
function useAttention() {
  const [on, setOn] = useState(true)
  return { on, stop: () => setOn(false) }
}

/**
 * Click-to-close that ignores drags (like selecting text), so finishing a selection
 * never closes the viewer. A press that moves more than a few pixels isn't a click.
 */
function useClickToClose(onClose: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: PointerEvent) => {
      down.current = { x: e.clientX, y: e.clientY }
    },
    onClick: (e: MouseEvent) => {
      const d = down.current
      down.current = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
      window.getSelection()?.removeAllRanges()
      onClose()
    },
  }
}

/**
 * Boards made of two halves (media.split): stack the left half above the right half when that shows
 * the board noticeably larger than fitting it whole, which is the case on phones and portrait tablets.
 * Rechecked whenever the stage changes size (rotation, the description opening).
 */
function useSplitLayout(stage: RefObject<HTMLDivElement | null>, asset: MediaAsset | null) {
  const [split, setSplit] = useState(false)
  useLayoutEffect(() => {
    const el = stage.current
    if (!asset || !el) return
    const check = () => {
      const { width: cw, height: ch } = el.getBoundingClientRect()
      if (!cw || !ch) return
      const whole = Math.min(cw / asset.width, ch / asset.height)
      const halves = Math.min(cw / (asset.width / 2), ch / (asset.height * 2))
      setSplit(halves > whole * 1.15)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [stage, asset])
  return split
}

/**
 * Boards with a portrait layout too (media.portrait): use it when it comes out larger on this screen
 * than the wide one, which is the case on phones and upright tablets. Rechecked when the stage
 * changes size (rotation). Starts from the screen's orientation so the right file loads first.
 */
function usePortraitLayout(stage: RefObject<HTMLDivElement | null>, wide: MediaAsset, tall: MediaAsset | null) {
  const [portrait, setPortrait] = useState(() => !!tall && window.matchMedia('(orientation: portrait)').matches)
  useLayoutEffect(() => {
    const el = stage.current
    if (!tall || !el) return
    const check = () => {
      const { width: cw, height: ch } = el.getBoundingClientRect()
      if (!cw || !ch) return
      const area = (a: MediaAsset) => Math.min(cw / a.width, ch / a.height) ** 2 * a.width * a.height
      setPortrait(area(tall) > area(wide))
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [stage, wide, tall])
  return portrait
}

function ImageStage({ media: board, preloaded, onClose }: { media: ImageMedia; preloaded: boolean; onClose: () => void }) {
  // Decided once, when the viewer opens.
  const [instant] = useState(preloaded)
  const [loaded, setLoaded] = useState(preloaded)
  const clickToClose = useClickToClose(onClose)
  const stage = useRef<HTMLDivElement>(null)
  // The board as shown: its wide layout, or its portrait layout on a tall screen (see above).
  const portrait = usePortraitLayout(stage, getAsset(board.asset), board.portrait ? getAsset(board.portrait) : null)
  const media = portrait && board.portrait ? { ...board, asset: board.portrait } : board
  const asset = getAsset(media.asset)
  const split = useSplitLayout(stage, media.split ? asset : null)
  // Shape of what's shown: the whole board, or its two halves stacked (half as wide, twice as tall).
  const ratio = split ? asset.width / 2 / (asset.height * 2) : asset.width / asset.height
  const box = { aspectRatio: `${ratio}`, width: `min(100cqw, 100cqh * ${ratio})` }
  const fade = instant ? '' : `transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`
  // Each half is a window onto the full image at twice the window's width, stacked in `split` order.
  const [top, bottom] = media.split === 'right-first' ? (['right', 'left'] as const) : (['left', 'right'] as const)
  const halves = (render: (side: 'left' | 'right') => ReactNode) => (
    <>
      <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">{render(top)}</div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden">{render(bottom)}</div>
    </>
  )
  return (
    // Clicking anywhere on the artwork (or the dark space around it) closes the viewer.
    <div ref={stage} className="absolute inset-0 cursor-zoom-out" {...clickToClose}>
      {!loaded && (
        // Same box the real image will fill (exact aspect ratio), so nothing shifts when it arrives.
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center overflow-hidden">
          <div className="relative blur-sm" style={split ? box : { ...box, backgroundImage: `url(${asset.blur})`, backgroundSize: '100% 100%' }}>
            {split &&
              halves((side) => (
                <div
                  className="h-full w-full"
                  style={{ backgroundImage: `url(${asset.blur})`, backgroundSize: '200% 100%', backgroundPosition: side }}
                />
              ))}
          </div>
        </div>
      )}
      {split ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className={`relative ${fade}`} style={box}>
            {halves((side) => (
              <Picture
                asset={media.asset}
                alt={side === top ? media.alt : ''}
                aria-hidden={side === bottom || undefined}
                sizes="200vw"
                onLoad={side === top ? () => setLoaded(true) : undefined}
                decoding={instant ? 'sync' : 'async'}
                className={`absolute top-0 h-full w-[200%] max-w-none ${side === 'left' ? 'left-0' : 'right-0'}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <Picture
          asset={media.asset}
          alt={media.alt}
          sizes="100vw"
          onLoad={() => setLoaded(true)}
          decoding={instant ? 'sync' : 'async'}
          className={`absolute inset-0 h-full w-full object-contain ${fade}`}
        />
      )}
    </div>
  )
}

/**
 * A document (e.g. a PDF deck turned into page images) as one scrolling column of pages.
 * Landscape pages (slides) are sized to fit the screen; portrait pages (letter-size layouts with
 * small text) run at a reading width, up to 1000px, and scroll like a PDF viewer at fit-width.
 * Clicking the dark space beside the pages closes; clicking a page doesn't.
 */
function DocumentStage({
  media,
  onClose,
  scroller,
  onScroll,
}: {
  media: DocumentMedia
  onClose: () => void
  scroller: RefObject<HTMLDivElement | null>
  onScroll: () => void
}) {
  const clickToClose = useClickToClose(onClose)
  const first = getAsset(media.pages[0])
  const aspect = first.width / first.height
  const width = aspect >= 1 ? `min(90cqw, (100cqh - 120px) * ${aspect})` : 'min(90cqw, 1000px)'
  const n = media.pages.length
  return (
    <div
      ref={scroller}
      data-viewer-scroll=""
      tabIndex={-1}
      aria-label={media.alt}
      role="region"
      className="absolute inset-0 cursor-zoom-out overflow-y-auto overscroll-contain outline-none"
      onScroll={onScroll}
      {...clickToClose}
    >
      <div
        className="mx-auto flex flex-col gap-6 pt-[88px] pb-16"
        style={{ width }}
      >
        {media.pages.map((key, i) => (
          <Picture
            key={key}
            asset={key}
            alt={`${media.alt}, page ${i + 1} of ${n}`}
            sizes={aspect >= 1 ? '90vw' : '(max-width: 1111px) 90vw, 1000px'}
            loading={i < 2 ? 'eager' : 'lazy'}
            className="block h-auto w-full cursor-auto"
            onClick={(e) => e.stopPropagation()}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * "Scroll down" hint for a document: the hero's scroll cue (the pill with the dropping ball, same
 * animations) in a circle of the hero's ink color with the buttons' sand outline, its arrow turned to point down. It slides up from the bottom a
 * moment after the pages arrive and slides back down once they're scrolled.
 */
function ScrollHint({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-8 z-10 mx-auto grid size-24 place-items-center rounded-full border-2 border-sand bg-ink shadow-[0_4px_16px_rgb(0_0_0/0.35)]"
      initial={{ y: reduce ? 0 : 160, opacity: reduce ? 0 : 1 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.9, duration: reduce ? 0.2 : 0.5, ease: SWAP_EASE } }}
      exit={{ y: reduce ? 0 : 160, opacity: reduce ? 0 : 1, transition: { duration: reduce ? 0.2 : 0.4, ease: [0.32, 0, 0.67, 0] } }}
    >
      <span className="relative block h-[50px] w-[57px]">
        <span className="absolute top-0 left-0 flex h-[50px] w-5 flex-col items-start rounded-[20px] bg-sand">
          <span className="scroll-ball mt-0.5 ml-0.5 block size-4 rounded-[20px] bg-ink" />
        </span>
        {/* the hero's arrow, turned 90 degrees clockwise; its nudge turns with it */}
        <span className="absolute top-[10px] left-[34px] block h-[30px] w-[15px] rotate-90">
          <span className="scroll-arrow block h-0 w-0 border-y-[15px] border-l-[15px] border-y-transparent border-l-sand" />
        </span>
      </span>
    </motion.div>
  )
}

function scrollByKey(el: HTMLElement, key: string, shift: boolean, reduce: boolean) {
  const behavior = reduce ? 'auto' : 'smooth'
  const page = el.clientHeight * 0.9
  if (key === 'Home') el.scrollTo({ top: 0, behavior })
  else if (key === 'End') el.scrollTo({ top: el.scrollHeight, behavior })
  else {
    const by: Record<string, number> = { ArrowDown: 80, ArrowUp: -80, PageDown: page, PageUp: -page, ' ': shift ? -page : page }
    el.scrollBy({ top: by[key] ?? 0, behavior })
  }
}

function VideoStage({ media, onBackdrop, onPlay }: { media: YouTubeMedia; onBackdrop: () => void; onPlay: () => void }) {
  const clickToClose = useClickToClose(onBackdrop)
  return (
    // Clicking anywhere around the video closes, as on the original site.
    <div className="absolute inset-0 grid cursor-zoom-out place-items-center" {...clickToClose}>
      <div
        className="aspect-video w-[min(90cqw,calc((100cqh-120px)*16/9))]"
        onClick={(e) => e.stopPropagation()}
      >
        <LiteYouTubeEmbed
          id={media.youtubeId}
          title={media.title}
          noCookie
          poster={media.poster}
          webp
          params="rel=0"
          onIframeAdded={onPlay}
        />
      </div>
    </div>
  )
}

function Description({ project, onHeight }: { project: Project; onHeight: (h: number) => void }) {
  const isVideo = project.category === 'video'
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight])
  return (
    <motion.section
      ref={ref}
      id="project-description"
      aria-label={`About ${project.title}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-x-0 bottom-0 max-h-[45dvh] overflow-y-auto px-6 pt-20 pb-8 lg:px-10 lg:pb-10"
      style={{
        background:
          'linear-gradient(to top, rgb(29 38 44 / 0.92) 0%, rgb(29 38 44 / 0.85) 55%, rgb(29 38 44 / 0) 100%)',
      }}
    >
      <div className="pointer-events-auto max-w-[640px] cursor-text font-ddc text-[15px] leading-[1.6] text-sand select-text [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
        <h2 className="text-[20px] leading-[1.4]">{project.title}</h2>
        {isVideo ? (
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
            <dt className="opacity-75">Duties</dt>
            <dd>{project.duties}</dd>
            <dt className="opacity-75">Crew size</dt>
            <dd>{project.crewSize}</dd>
            <dt className="opacity-75">Timeline</dt>
            <dd>{project.timeline}</dd>
          </dl>
        ) : (
          <p>{project.discipline}</p>
        )}
        {project.description && <p className="mt-3">{project.description}</p>}
      </div>
    </motion.section>
  )
}
