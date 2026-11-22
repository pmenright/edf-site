import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
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
  onClose: () => void
}

/**
 * Full-screen project viewer (replaces the 24 Webflow lightboxes).
 * Native <dialog>: Esc, focus handling and screen-reader semantics come built in.
 * Opens with the artwork sliding up, the backdrop dimming and the buttons sliding in from the right.
 */
export function ProjectViewer({ project, onClose }: ViewerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const reduce = useReducedMotion()
  const portrait = useMediaQuery('(orientation: portrait)')
  // Short screens: phones turned sideways (the `short` variant in index.css, max-height 500px).
  const shortScreen = useMediaQuery('(max-height: 500px)')
  const sheetW = useSheetWidth()
  const [barH, setBarH] = useState(0)
  const [sheetH, setSheetH] = useState(0)
  const [leaving, setLeaving] = useState(false)
  // The description starts closed every time the viewer opens (each opening is a new viewer).
  const [descriptionOpen, onDescriptionOpen] = useState(false)
  const [showAlternate, setShowAlternate] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const documentScroller = useRef<HTMLDivElement>(null)
  const downloadButton = useRef<HTMLButtonElement>(null)
  const media = project.media[0]
  const alternate = project.alternate
  // DESCRIPTION only for projects that have description text (Phantom 5, Hands and the resume don't).
  const hasDescription = !!project.description?.trim()
  const showDescription = descriptionOpen && hasDescription
  /*
    Nothing ever sits on top of the artwork. The caption bar (title, DESCRIPTION, the project's extra
    buttons) has its own strip under it. The description opens as a sheet beside it on screens lying
    on their side, and as a drawer under the caption bar on tall screens; either way the artwork
    re-fits into the space that's left. On tall screens it also keeps clear of the close button.
  */
  const side = !portrait && showDescription
  const drawer = portrait && showDescription ? sheetH : 0
  // Pictures and videos keep clear of the close button above them and stand off the caption bar
  // below (and the sides, on screens lying on their side). Documents scroll the full height, with
  // their first page clear of the close button.
  const isDocument = (showAlternate && alternate ? alternate.media : media).type === 'document'
  // A phone turned sideways has little height to spare, so the artwork doesn't sit under a band
  // for the close button: it uses the full height, centered, and keeps clear of the X (tucked into
  // the corner) at both sides. With the description open the X sits over the description instead.
  const sideways = !portrait && shortScreen
  const inset = isDocument || portrait ? 0 : sideways && !side ? SIDEWAYS_CLEAR : STAGE_INSET
  const stageTop = portrait ? TOP_BAND : isDocument ? 0 : sideways ? SIDEWAYS_TOP : TOP_BAND_WIDE
  const stageBottom = barH + drawer + (isDocument ? 0 : sideways ? SIDEWAYS_GAP : STAGE_GAP)
  const stageRight = side ? sheetW : 0
  const sheetMotion: Transition = { duration: reduce ? 0 : 0.3, ease: SWAP_EASE }

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
    // Safari: never let a pinch zoom the page behind or the viewer's buttons.
    const noPageZoom = (e: Event) => e.preventDefault()
    d.addEventListener('gesturestart', noPageZoom)
    d.addEventListener('gesturechange', noPageZoom)

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
      d.removeEventListener('gesturestart', noPageZoom)
      d.removeEventListener('gesturechange', noPageZoom)
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
    setZoomScale(1)
    setShowAlternate(alt)
    setDeckScrolled(false)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = 0
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
        // A trackpad pinch outside the artwork: don't zoom the page.
        if (e.ctrlKey) return e.preventDefault()
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
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1)
        // The description scrolls itself, but a scroll it can't use (short text, or already at the
        // end) stops there instead of moving the page behind the viewer.
        const desc = t?.closest<HTMLElement>('#project-description')
        if (desc) {
          if (!canScroll(desc, dy)) e.preventDefault()
          return
        }
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
        if (e.touches.length > 1) return e.preventDefault() // two fingers: a pinch (the artwork handles it), never a swipe
        const t = e.target instanceof Element ? e.target : null
        const dy = s.touchY - e.touches[0].clientY // finger moving up = scrolling down
        // The description scrolls itself, but never hands the scroll on to the page behind (phones
        // used to scroll the gallery under the viewer): a swipe it can't use, because the text is
        // short or already at its end, is held.
        const desc = t?.closest<HTMLElement>('#project-description')
        if (desc) {
          if (!s.touchMode && dy !== 0) s.touchMode = canScroll(desc, dy) ? 'native' : 'held'
          if (s.touchMode !== 'native') e.preventDefault()
          return
        }
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
  const swap = { duration: reduce ? 0 : 0.4, ease: SWAP_EASE }

  const toggleDescription = () => onDescriptionOpen(!showDescription)

  // + / fit / - (touch screens): drive whichever view is showing (the one leaving in a swap lets go).
  const touch = useMediaQuery('(pointer: coarse)')
  const zoomControls = useRef<ZoomControls | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const zoomLink = useMemo<ZoomLink>(
    () => ({
      register: (c) => {
        zoomControls.current = c
      },
      unregister: (c) => {
        if (zoomControls.current === c) zoomControls.current = null
      },
      onScale: setZoomScale,
    }),
    [],
  )
  const zoomable = touch && (shown.type === 'image' || shown.type === 'document')
  // The magnifying lens in the top left corner opens + / fit / - (closed each time the viewer opens).
  const [zoomOpen, setZoomOpen] = useState(false)


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
          className="absolute [container-type:size]"
          style={{ top: 0, bottom: 0, left: 0, right: 0 }}
          initial={false}
          animate={{ top: stageTop, bottom: stageBottom, left: inset, right: stageRight + inset }}
          transition={sheetMotion}
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
                  <ImageStage media={alternate.media} preloaded={isMediaReady(alternate.media)} onClose={close} zoomLink={zoomLink} />
                ) : alternate.media.type === 'document' ? (
                  <DocumentStage
                    media={alternate.media}
                    onClose={close}
                    scroller={documentScroller}
                    onScroll={onDeckScroll}
                    clearTop={!portrait}
                    zoomLink={zoomLink}
                  />
                ) : (
                  <VideoStage media={alternate.media} onBackdrop={close} />
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
                  <ImageStage media={media} preloaded={isReady(project)} onClose={close} zoomLink={zoomLink} />
                ) : media.type === 'document' ? (
                  <DocumentStage
                    media={media}
                    onClose={close}
                    scroller={documentScroller}
                    onScroll={onDeckScroll}
                    clearTop={!portrait}
                    zoomLink={zoomLink}
                  />
                ) : (
                  <VideoStage media={media} onBackdrop={close} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* The caption bar: the project's name, DESCRIPTION, and its extra buttons, in their own strip
            under the artwork (it slides up with it). On tall screens the description opens as a drawer
            under it and pushes it up; on wide ones it opens beside the artwork and the bar re-centers
            under what's left. */}
        <motion.div
          className="absolute left-0"
          style={{ bottom: 0, right: 0 }}
          initial={false}
          animate={{ bottom: drawer, right: stageRight }}
          transition={sheetMotion}
        >
          <CaptionBar project={project} onHeight={setBarH}>
            {hasDescription && (
              <button
                type="button"
                onClick={toggleDescription}
                aria-expanded={showDescription}
                aria-controls="project-description"
                aria-keyshortcuts="D"
                className={`${BAR_BUTTON} ${showDescription ? 'bg-sand text-ink' : 'bg-ink text-sand hover:bg-sand hover:text-ink'}`}
              >
                <PlusMinus open={showDescription} />
                Description
              </button>
            )}
            {project.link &&
              (project.link.download ? (
                // A file to download: opens a small popup with the actual download button.
                <button
                  ref={downloadButton}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setDownloadOpen(true)}
                  className={`${BAR_BUTTON} ${EXTRA_BUTTON}`}
                >
                  <DownloadIcon />
                  {project.link.label}
                </button>
              ) : (
                <a
                  href={withBase(project.link.href)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${project.link.label} (opens in a new tab)`}
                  className={`${BAR_BUTTON} ${EXTRA_BUTTON}`}
                >
                  {project.link.label}
                  <ExternalIcon />
                </a>
              ))}
            {alternate && (
              <button
                type="button"
                onClick={toggleAlternate}
                className={`${BAR_BUTTON} ${EXTRA_BUTTON}`}
              >
                {showAlternate ? alternate.backLabel : alternate.label}
              </button>
            )}
          </CaptionBar>
        </motion.div>

        {/* The text rides in with the artwork when it was already open from the last project. */}
        <AnimatePresence initial={false}>
          {showDescription && (
            <DescriptionSheet
              key={portrait ? 'drawer' : 'side'}
              project={project}
              side={!portrait}
              width={sheetW}
              onHeight={setSheetH}
              transition={sheetMotion}
            />
          )}
        </AnimatePresence>
      </div>

      <div
        className="viewer-controls absolute top-3 right-3 z-10 sm:top-6 sm:right-6 short:top-3 short:right-3"
        data-leaving={leaving || undefined}
        inert={downloadOpen}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="group grid size-11 cursor-pointer place-items-center outline-none"
        >
          <img
            src={closeX}
            alt=""
            className="size-[25px] rounded-full transition-transform duration-200 ease-in-out group-hover:scale-130 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-sand sm:size-[28px]"
          />
        </button>
      </div>

      {zoomable && (
        <ZoomCorner
          open={zoomOpen}
          onToggle={() => setZoomOpen(!zoomOpen)}
          down={sideways}
          leaving={leaving}
          inert={downloadOpen}
          scale={zoomScale}
          onIn={() => zoomControls.current?.zoomBy(ZOOM_STEP)}
          onFit={() => zoomControls.current?.reset()}
          onOut={() => zoomControls.current?.zoomBy(1 / ZOOM_STEP)}
        />
      )}

      <AnimatePresence>
        {showDeckHint && barH > 0 && (
          <ScrollHint reduce={!!reduce} bottom={barH + drawer + (shortScreen ? 12 : 20)} right={stageRight} transition={sheetMotion} />
        )}
      </AnimatePresence>

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

/**
 * The caption bar's buttons: DESCRIPTION and a project's extras (Visit site, Watch video...). Solid,
 * with a sand outline, on the dark strip under the artwork, so they read the same on every board.
 * 44px tall for fingers, 40px with a mouse, and a little larger on very wide screens.
 */
const BAR_BUTTON =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 border-2 border-sand px-4 font-ddc text-[15px] leading-none tracking-[0.08em] whitespace-nowrap uppercase outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand pointer-fine:h-10 wide:h-12 wide:px-5 wide:text-[17px] max-sm:h-auto max-sm:min-h-11 max-sm:flex-1 max-sm:basis-0 max-sm:px-2.5 max-sm:py-1.5 max-sm:text-center max-sm:text-[13px] max-sm:leading-[1.2] max-sm:tracking-[0.05em] max-sm:whitespace-normal short:h-10 short:px-3 short:text-[13px]'
/** Extras look like DESCRIPTION when it's closed, and fill in on hover. */
const EXTRA_BUTTON = 'bg-ink text-sand hover:bg-sand hover:text-ink'

/** On tall screens the artwork keeps clear of the close button in the top corner. */
const TOP_BAND = 64
/** Elsewhere, the space over pictures and videos: the close button, and room under it. */
const TOP_BAND_WIDE = 80
/** Space between a picture or video and the caption bar under it. */
const STAGE_GAP = 20
/** Space at the sides of a picture or video on screens lying on their side. */
const STAGE_INSET = 24
/** Phones turned sideways: the artwork starts this close to the top (the X is beside it, not above). */
const SIDEWAYS_TOP = 12
/** ...and keeps this far in from both sides, clear of the X in the corner (12px in, 44px wide). */
const SIDEWAYS_CLEAR = 68
/** ...and this far above the caption bar. */
const SIDEWAYS_GAP = 12

/** Width of the description sheet beside the artwork on screens lying on their side. */
function useSheetWidth() {
  const measure = () => {
    const w = window.innerWidth
    return window.innerHeight <= 500
      ? Math.round(Math.min(380, Math.max(260, w * 0.42)))
      : Math.round(Math.min(480, Math.max(320, w * 0.32)))
  }
  const [width, setWidth] = useState(measure)
  useEffect(() => {
    const onResize = () => setWidth(measure())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

/** On touch screens, how long a tap waits to see whether a second one makes it a double tap (ms). */
const DOUBLE_TAP_MS = 280

/**
 * The artwork's tap / click handling: like useClickToClose (a click closes, drags don't, and nothing
 * closes while zoomed in), plus double tap on touch screens. A tap waits DOUBLE_TAP_MS for a second
 * one; if it comes, close by, the double tap zooms in on that spot (or back to fitted), and nothing
 * closes. A mouse click still closes straight away.
 */
function useTapToClose(onClose: () => void, isZoomed: () => boolean, onDoubleTap: (x: number, y: number) => void) {
  const down = useRef<{ x: number; y: number; touch: boolean } | null>(null)
  const pending = useRef<{ x: number; y: number; timer: number } | null>(null)
  useEffect(() => () => window.clearTimeout(pending.current?.timer), [])
  return {
    onPointerDown: (e: PointerEvent) => {
      down.current = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' || e.pointerType === 'pen' }
    },
    onClick: (e: MouseEvent) => {
      const d = down.current
      down.current = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
      if (!d.touch) {
        if (isZoomed()) return
        window.getSelection()?.removeAllRanges()
        onClose()
        return
      }
      const first = pending.current
      if (first && Math.hypot(e.clientX - first.x, e.clientY - first.y) < 40) {
        window.clearTimeout(first.timer)
        pending.current = null
        onDoubleTap(e.clientX, e.clientY)
        return
      }
      if (first) window.clearTimeout(first.timer)
      pending.current = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          pending.current = null
          if (!isZoomed()) onClose()
        }, DOUBLE_TAP_MS),
      }
    },
  }
}

/**
 * Click-to-close that ignores drags (like selecting text), so finishing a selection
 * never closes the viewer. A press that moves more than a few pixels isn't a click.
 */
function useClickToClose(onClose: () => void, blocked?: () => boolean) {
  const down = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: PointerEvent) => {
      down.current = { x: e.clientX, y: e.clientY }
    },
    onClick: (e: MouseEvent) => {
      const d = down.current
      down.current = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || blocked?.()) return
      window.getSelection()?.removeAllRanges()
      onClose()
    },
  }
}

/**
 * Boards made of two halves (media.split): stack the two halves on any screen taller than it is wide
 * (phones and tablets held upright), as long as that doesn't show the board smaller. On wider spaces,
 * only when stacking shows it noticeably larger. Rechecked whenever the stage changes size (rotation,
 * the description opening).
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
      setSplit(ch > cw ? halves >= whole : halves > whole * 1.15)
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

function ImageStage({
  media: board,
  preloaded,
  onClose,
  zoomLink,
}: {
  media: ImageMedia
  preloaded: boolean
  onClose: () => void
  /** Set while this is the view showing: the + / fit / - buttons drive its zoom. */
  zoomLink?: ZoomLink
}) {
  // Decided once, when the viewer opens.
  const [instant] = useState(preloaded)
  const [loaded, setLoaded] = useState(preloaded)
  const stage = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const zoom = usePinchZoom(stage, layer, zoomLink)
  // Zoomed in, a tap doesn't close (it's easy to brush the artwork while looking around it). On touch
  // screens a double tap zooms in on that spot (or back out), and a single tap still closes.
  const clickToClose = useTapToClose(onClose, zoom.isZoomed, zoom.toggleAt)
  // The board as shown: its wide layout, or its portrait layout on a tall screen (see above).
  const portrait = usePortraitLayout(stage, getAsset(board.asset), board.portrait ? getAsset(board.portrait) : null)
  const media = portrait && board.portrait ? { ...board, asset: board.portrait } : board
  const asset = getAsset(media.asset)
  const split = useSplitLayout(stage, media.split ? asset : null)
  // Shape of what's shown: the whole board, or its two halves stacked (half as wide, twice as tall).
  const ratio = split ? asset.width / 2 / (asset.height * 2) : asset.width / asset.height
  const box = { aspectRatio: `${ratio}`, width: `min(100cqw, 100cqh * ${ratio})` }
  const fade = instant ? '' : `transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`
  const place = 'place-items-center'
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
    <div ref={stage} className="absolute inset-0 overflow-hidden data-zoomed:cursor-grab" {...clickToClose}>
      <div ref={layer} className="absolute inset-0 origin-top-left will-change-transform">
      {!loaded && (
        // Same box the real image will fill (exact aspect ratio), so nothing shifts when it arrives.
        <div aria-hidden="true" className={`absolute inset-0 grid overflow-hidden ${place}`}>
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
        <div className={`absolute inset-0 grid ${place}`}>
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
    </div>
  )
}

const ZOOM_MAX = 5
const ZOOM_SETTLE = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Zooms the artwork, and only the artwork: two fingers pinch around the point between them (or a
 * trackpad pinch around the pointer), while the page, the backdrop and the viewer's buttons stay at
 * their size. Zoomed in, one finger, a mouse drag or a two-finger trackpad scroll moves around the
 * artwork, which can't be dragged off past its edges. Pinched smaller than it started, it springs
 * back. `frame` gets data-zoomed while zoomed in (the viewer's swipe-to-swap and click-to-close
 * stand down then).
 */
function usePinchZoom(frame: RefObject<HTMLElement | null>, layer: RefObject<HTMLElement | null>, zoom?: ZoomLink) {
  const zoomed = useRef(false)
  const api = useRef<ZoomControls | null>(null)
  const report = useRef(zoom?.onScale)
  useLayoutEffect(() => {
    report.current = zoom?.onScale
  })
  useEffect(() => {
    const el = frame.current
    const content = layer.current
    if (!el || !content) return
    let s = 1
    let tx = 0
    let ty = 0
    const apply = (settle = false) => {
      content.style.transition = settle ? ZOOM_SETTLE : ''
      content.style.transform = s === 1 ? '' : `translate3d(${tx}px, ${ty}px, 0) scale(${s})`
      zoomed.current = s > 1.001
      el.toggleAttribute('data-zoomed', zoomed.current)
      report.current?.(s)
    }
    // Keep the zoomed artwork covering its box: no dragging it off past an edge.
    const clampPan = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      tx = Math.min(0, Math.max(w - w * s, tx))
      ty = Math.min(0, Math.max(h - h * s, ty))
    }
    /** Scale to `next`, keeping the point (x, y) of the box where it is. */
    const zoomAt = (x: number, y: number, next: number) => {
      next = Math.min(ZOOM_MAX, Math.max(0.6, next))
      tx = x - (x - tx) * (next / s)
      ty = y - (y - ty) * (next / s)
      s = next
    }
    const settle = () => {
      if (s <= 1) {
        s = 1
        tx = ty = 0
      } else clampPan()
      apply(true)
    }
    const local = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      return [cx - r.left, cy - r.top] as const
    }
    // The + / fit / - buttons: step around the middle of what's on screen, or back to the whole board.
    api.current = {
      zoomBy: (f) => {
        zoomAt(el.clientWidth / 2, el.clientHeight / 2, s * f)
        if (s < 1.05) {
          s = 1
          tx = ty = 0
        } else clampPan()
        apply(true)
      },
      reset: () => {
        s = 1
        tx = ty = 0
        apply(true)
      },
      toggleAt: (cx, cy) => {
        if (s > 1.001) {
          s = 1
          tx = ty = 0
        } else {
          const [x, y] = local(cx, cy)
          zoomAt(x, y, DOUBLE_TAP_ZOOM)
          clampPan()
        }
        apply(true)
      },
    }

    // Touch: two fingers zoom (and move with the fingers); zoomed in, one finger pans.
    let pinch: { d: number; x: number; y: number } | null = null
    let pan: { x: number; y: number } | null = null
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const middle = (t: TouchList) => local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [x, y] = middle(e.touches)
        pinch = { d: spread(e.touches), x, y }
        pan = null
        e.stopPropagation()
      } else if (e.touches.length === 1 && zoomed.current) {
        pan = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        e.stopPropagation()
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (pinch && e.touches.length >= 2) {
        e.preventDefault()
        e.stopPropagation()
        const d = spread(e.touches)
        const [x, y] = middle(e.touches)
        tx += x - pinch.x
        ty += y - pinch.y
        zoomAt(x, y, (s * d) / pinch.d)
        pinch = { d, x, y }
        apply()
      } else if (pan && e.touches.length === 1) {
        e.preventDefault()
        e.stopPropagation()
        tx += e.touches[0].clientX - pan.x
        ty += e.touches[0].clientY - pan.y
        pan = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        clampPan()
        apply()
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        pinch = null
        settle()
        // One finger still down after a pinch: carry on panning with it.
        pan = e.touches.length === 1 && zoomed.current ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
        e.stopPropagation()
      } else if (pan && e.touches.length === 0) {
        pan = null
        e.stopPropagation()
      }
    }

    // Trackpads: a pinch arrives as ctrl + wheel (Chrome, Firefox); zoomed in, scrolling pans.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        const [x, y] = local(e.clientX, e.clientY)
        zoomAt(x, y, s * Math.exp(-e.deltaY * 0.01))
        if (s <= 1) {
          s = 1
          tx = ty = 0
        } else clampPan()
        apply()
      } else if (zoomed.current) {
        e.preventDefault()
        e.stopPropagation()
        tx -= e.deltaX
        ty -= e.deltaY
        clampPan()
        apply()
      }
    }
    // Safari on a Mac pinches with its own gesture events (on iPhones and iPads touch handles it).
    let gestureFrom = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureFrom = s
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      if (pinch) return
      const g = e as Event & { scale: number; clientX: number; clientY: number }
      const [x, y] = local(g.clientX, g.clientY)
      zoomAt(x, y, gestureFrom * g.scale)
      apply()
    }
    const onGestureEnd = (e: Event) => {
      e.preventDefault()
      if (!pinch) settle()
    }

    // Mouse: zoomed in (by a trackpad pinch), drag to look around.
    let drag: { x: number; y: number } | null = null
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (e.pointerType === 'touch' || !zoomed.current || e.button !== 0) return
      drag = { x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (!drag) return
      tx += e.clientX - drag.x
      ty += e.clientY - drag.y
      drag = { x: e.clientX, y: e.clientY }
      clampPan()
      apply()
    }
    const onPointerUp = () => {
      drag = null
    }

    const opts = { passive: false } as const
    el.addEventListener('touchstart', onTouchStart, opts)
    el.addEventListener('touchmove', onTouchMove, opts)
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('wheel', onWheel, opts)
    el.addEventListener('gesturestart', onGestureStart, opts)
    el.addEventListener('gesturechange', onGestureChange, opts)
    el.addEventListener('gestureend', onGestureEnd, opts)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      api.current = null
    }
  }, [frame, layer])
  useZoomControls(api, zoom)
  return { isZoomed: () => zoomed.current, toggleAt: (x: number, y: number) => api.current?.toggleAt?.(x, y) }
}

/** What the viewer's + / fit / - buttons call on the artwork that's showing. */
interface ZoomControls {
  /** Zoom in (f > 1) or out (f < 1) around the middle of the view. */
  zoomBy: (f: number) => void
  /** Back to the whole thing, fitted to the screen. */
  reset: () => void
  /** Double tap: zoom in on that point of the screen, or back to fitted if zoomed in. */
  toggleAt?: (clientX: number, clientY: number) => void
}

/** A double tap zooms in this far. */
const DOUBLE_TAP_ZOOM = 2.5

/** Wiring between a stage's zoom and the viewer's buttons: the stage hands over its controls and reports its scale. */
interface ZoomLink {
  register: (c: ZoomControls) => void
  unregister: (c: ZoomControls) => void
  onScale: (s: number) => void
}

/** Hands a stage's zoom to the buttons while that stage is the one showing. */
function useZoomControls(api: RefObject<ZoomControls | null>, link?: ZoomLink) {
  useEffect(() => {
    if (!link) return
    const mine: ZoomControls = {
      zoomBy: (f) => api.current?.zoomBy(f),
      reset: () => api.current?.reset(),
    }
    link.register(mine)
    return () => link.unregister(mine)
  }, [api, link])
}

/**
 * Zoom for a document's pages (the resume, the AFC presentation): pinching makes the column of pages
 * wider (up to ZOOM_MAX times), keeping the point between the fingers in place, and the pages then
 * scroll both ways on their own. Pinched back past their normal width, they settle at it.
 */
function useDocumentZoom(
  scroller: RefObject<HTMLElement | null>,
  column: RefObject<HTMLElement | null>,
  baseWidth: string,
  zoom?: ZoomLink,
) {
  const api = useRef<ZoomControls | null>(null)
  const report = useRef(zoom?.onScale)
  useLayoutEffect(() => {
    report.current = zoom?.onScale
  })
  useEffect(() => {
    const box = scroller.current
    const col = column.current
    if (!box || !col) return
    let z = 1
    const setZoom = (next: number, x: number, y: number) => {
      next = Math.min(ZOOM_MAX, Math.max(0.7, next))
      const before = col.getBoundingClientRect()
      const r = box.getBoundingClientRect()
      // The point under (x, y), as a fraction of the column
      const fx = (x + r.left - before.left) / before.width
      const fy = (y + r.top - before.top) / before.height
      z = next
      col.style.width = z === 1 ? '' : `calc(${baseWidth} * ${z})`
      col.style.maxWidth = z === 1 ? '' : 'none'
      col.style.marginInline = z > 1 ? '0' : ''
      const after = col.getBoundingClientRect()
      box.scrollLeft += after.left + fx * after.width - (r.left + x)
      box.scrollTop += after.top + fy * after.height - (r.top + y)
      report.current?.(z)
    }
    // The + / fit / - buttons: around the middle of what's on screen.
    api.current = {
      zoomBy: (f) => {
        const next = z * f
        setZoom(next < 1.05 ? 1 : next, box.clientWidth / 2, box.clientHeight / 2)
      },
      reset: () => setZoom(1, box.clientWidth / 2, box.clientHeight / 2),
    }
    const local = (cx: number, cy: number) => {
      const r = box.getBoundingClientRect()
      return [cx - r.left, cy - r.top] as const
    }
    let pinch: { d: number } | null = null
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      pinch = { d: spread(e.touches) }
      e.stopPropagation()
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length < 2) return
      e.preventDefault()
      e.stopPropagation()
      const d = spread(e.touches)
      const [x, y] = local((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2)
      setZoom((z * d) / pinch.d, x, y)
      pinch = { d }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!pinch || e.touches.length >= 2) return
      pinch = null
      if (z < 1) setZoom(1, box.clientWidth / 2, box.clientHeight / 2)
      e.stopPropagation()
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      const [x, y] = local(e.clientX, e.clientY)
      setZoom(Math.max(1, z * Math.exp(-e.deltaY * 0.01)), x, y)
    }
    let gestureFrom = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureFrom = z
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      if (pinch) return
      const g = e as Event & { scale: number; clientX: number; clientY: number }
      const [x, y] = local(g.clientX, g.clientY)
      setZoom(Math.max(1, gestureFrom * g.scale), x, y)
    }
    const opts = { passive: false } as const
    box.addEventListener('touchstart', onTouchStart, opts)
    box.addEventListener('touchmove', onTouchMove, opts)
    box.addEventListener('touchend', onTouchEnd)
    box.addEventListener('touchcancel', onTouchEnd)
    box.addEventListener('wheel', onWheel, opts)
    box.addEventListener('gesturestart', onGestureStart, opts)
    box.addEventListener('gesturechange', onGestureChange, opts)
    return () => {
      box.removeEventListener('touchstart', onTouchStart)
      box.removeEventListener('touchmove', onTouchMove)
      box.removeEventListener('touchend', onTouchEnd)
      box.removeEventListener('touchcancel', onTouchEnd)
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('gesturestart', onGestureStart)
      box.removeEventListener('gesturechange', onGestureChange)
      api.current = null
    }
  }, [scroller, column, baseWidth])
  useZoomControls(api, zoom)
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
  clearTop,
  zoomLink,
}: {
  media: DocumentMedia
  onClose: () => void
  scroller: RefObject<HTMLDivElement | null>
  onScroll: () => void
  /** Start the pages below the close button (when the stage itself reaches the top of the screen). */
  clearTop: boolean
  /** Set while this is the view showing: the + / fit / - buttons drive its zoom. */
  zoomLink?: ZoomLink
}) {
  const clickToClose = useClickToClose(onClose)
  const first = getAsset(media.pages[0])
  const aspect = first.width / first.height
  const width = aspect >= 1 ? `min(90cqw, (100cqh - 120px) * ${aspect})` : 'min(90cqw, 1000px)'
  const n = media.pages.length
  const column = useRef<HTMLDivElement>(null)
  useDocumentZoom(scroller, column, width, zoomLink)
  return (
    <div
      ref={scroller}
      data-viewer-scroll=""
      tabIndex={-1}
      aria-label={media.alt}
      role="region"
      className="absolute inset-0 overflow-auto overscroll-contain outline-none"
      onScroll={onScroll}
      {...clickToClose}
    >
      <div
        ref={column}
        className={`mx-auto flex flex-col gap-6 pb-10 ${clearTop ? 'pt-[76px]' : 'pt-2'}`}
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
 * animations) in a circle of the hero's ink color with the buttons' sand outline, its arrow turned
 * to point down. It waits below the bottom edge of the screen, rises into place a moment after the
 * pages arrive, and drops back off the bottom once they're scrolled. `bottom` is its resting place
 * (above the caption bar); it starts that far down plus its own height, so it's always fully off
 * the screen first, whatever the screen size.
 */
function ScrollHint({ reduce, bottom, right, transition }: { reduce: boolean; bottom: number; right: number; transition: Transition }) {
  // Measured once it's there, so the start is below the edge on short screens too (it's smaller there).
  const offscreen = bottom + HINT_SIZE + 24
  return (
    <motion.div
      aria-hidden="true"
      style={{ right }}
      className="pointer-events-none absolute left-0 z-10 mx-auto grid size-24 place-items-center rounded-full border-2 border-sand bg-ink shadow-[0_4px_16px_rgb(0_0_0/0.35)] short:size-[72px]"
      initial={{ bottom, y: reduce ? 0 : offscreen, opacity: reduce ? 0 : 1 }}
      animate={{
        bottom,
        y: 0,
        opacity: 1,
        transition: { bottom: transition, default: { delay: 0.9, duration: reduce ? 0.2 : 0.5, ease: SWAP_EASE } },
      }}
      exit={{ y: reduce ? 0 : offscreen, opacity: reduce ? 0 : 1, transition: { duration: reduce ? 0.2 : 0.4, ease: [0.32, 0, 0.67, 0] } }}
    >
      <span className="relative block h-[50px] w-[57px] short:scale-[0.75]">
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
/** The hint's size (size-24), the larger of its two sizes. */
const HINT_SIZE = 96

/** Whether `el` can scroll any further in the direction of `dy` (positive: down). */
function canScroll(el: HTMLElement, dy: number) {
  if (dy > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1
  if (dy < 0) return el.scrollTop > 0
  return false
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

function VideoStage({ media, onBackdrop }: { media: YouTubeMedia; onBackdrop: () => void }) {
  const clickToClose = useClickToClose(onBackdrop)
  return (
    // Clicking anywhere around the video closes, as on the original site.
    <div className="absolute inset-0 grid place-items-center" {...clickToClose}>
      <div
        className="aspect-video w-[min(100cqw,calc(100cqh*16/9))]"
        onClick={(e) => e.stopPropagation()}
      >
        <LiteYouTubeEmbed
          id={media.youtubeId}
          title={media.title}
          noCookie
          poster={media.poster}
          webp
          params={media.start ? `rel=0&start=${media.start}` : 'rel=0'}
        />
      </div>
    </div>
  )
}

/** Each + or - is this much closer or further. */
const ZOOM_STEP = 1.6

/**
 * Touch screens: zoom, in the top left corner level with the close button and drawn like it (a sand
 * disc with a navy mark). The magnifying lens opens out into + / fit / - beside it, so people find
 * out the artwork zooms (pinching works too); the lens closes them again. They open sideways along
 * the strip above the artwork, or, on a phone turned sideways (no strip above the artwork there),
 * downward along the free margin at the left, so they never cover the artwork. Fit puts it back to
 * the whole board; - and fit sit dimmed while it's already fitted, + at the most it zooms.
 */
function ZoomCorner({
  open,
  onToggle,
  down,
  leaving,
  inert,
  scale,
  onIn,
  onFit,
  onOut,
}: {
  open: boolean
  onToggle: () => void
  /** Open downward (phones turned sideways) instead of to the right. */
  down: boolean
  leaving: boolean
  inert: boolean
  scale: number
  onIn: () => void
  onFit: () => void
  onOut: () => void
}) {
  const fitted = scale <= 1.001
  const reduce = useReducedMotion()
  // The disc matches the close button's: 25px on phones, 28px from 480px wide (sm).
  const disc = useMediaQuery('(min-width: 480px)') ? 28 : 25
  const slot =
    'relative grid size-11 flex-none cursor-pointer place-items-center text-[#1b2747] outline-none disabled:cursor-default'
  const mark = 'transition-transform duration-200 ease-in-out group-hover:scale-130 group-disabled:scale-100'
  const extra = `${slot} group disabled:opacity-35`
  // The sand behind the buttons: the lens's disc, which stretches into a pill when it opens (three
  // more 44px slots).
  const length = open ? disc + 132 : disc
  return (
    <div
      role="group"
      aria-label="Zoom"
      className="viewer-zoom absolute top-3 left-3 z-10 sm:top-6 sm:left-6 short:top-3 short:left-3"
      data-leaving={leaving || undefined}
      inert={inert}
    >
      <motion.span
        aria-hidden="true"
        className="absolute rounded-full bg-sand"
        style={{ top: (44 - disc) / 2, left: (44 - disc) / 2 }}
        initial={false}
        animate={down ? { width: disc, height: length } : { width: length, height: disc }}
        transition={{ duration: reduce ? 0 : 0.25, ease: SWAP_EASE }}
      />
      <div className={`relative flex ${down ? 'flex-col' : 'flex-row'}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="viewer-zoom-tools"
          aria-label={open ? 'Hide zoom' : 'Zoom'}
          className={`${slot} group focus-visible:[&>span]:outline-2 focus-visible:[&>span]:outline-offset-4 focus-visible:[&>span]:outline-sand`}
        >
          {/* a magnifying lens: the glass and its handle */}
          <span className={`grid size-[25px] place-items-center rounded-full sm:size-[28px] ${mark}`}>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[15px] sm:size-[17px]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.6 12.6 5 5" />
            </svg>
          </span>
        </button>
        {/* Hidden (and out of reach) while closed; they fade in as the pill opens. */}
        <div
          id="viewer-zoom-tools"
          className={`flex transition-opacity duration-200 ${down ? 'flex-col' : 'flex-row'} ${open ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0'}`}
          inert={!open}
        >
          <button type="button" aria-label="Zoom in" onClick={onIn} disabled={scale >= ZOOM_MAX - 0.01} className={extra}>
            <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-[14px] sm:size-[16px] ${mark}`} fill="none" stroke="currentColor" strokeWidth="2.8">
              <path d="M10 3v14M3 10h14" />
            </svg>
          </button>
          <button type="button" aria-label="Fit to screen" onClick={onFit} disabled={fitted} className={extra}>
            {/* Corner brackets around a page: fit the whole thing on screen. */}
            <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-[15px] sm:size-[17px] ${mark}`} fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M2 7V2h5M13 2h5v5M18 13v5h-5M7 18H2v-5" />
              <rect x="6.5" y="6.5" width="7" height="7" />
            </svg>
          </button>
          <button type="button" aria-label="Zoom out" onClick={onOut} disabled={fitted} className={extra}>
            <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-[14px] sm:size-[16px] ${mark}`} fill="none" stroke="currentColor" strokeWidth="2.8">
              <path d="M3 10h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/** What the caption bar says under the title: a design's discipline, or that it's a video. */
const subtitle = (p: Project) => p.discipline ?? (p.category === 'video' ? 'Video' : '')

/**
 * The strip under the artwork: the project's name (and discipline), then its buttons. One row where
 * there's room; on phones the name sits above a full-width row of buttons, within thumb's reach.
 * Reports its height so the artwork can fit above it. (Zoom lives in the top left corner.)
 */
function CaptionBar({
  project,
  onHeight,
  children,
}: {
  project: Project
  onHeight: (h: number) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    const report = () => onHeight(el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight])
  const sub = subtitle(project)
  return (
    <div
      ref={ref}
      className="viewer-caption flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] font-ddc text-sand sm:px-6 md:pb-5 short:gap-x-4 short:gap-y-2 short:pt-2 short:pb-2"
    >
      <div className="flex min-w-0 items-center gap-3 max-sm:w-full">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="truncate text-[18px] leading-tight sm:text-[20px] wide:text-[24px] short:text-[17px]">{project.title}</p>
          {sub && <p className="mt-0.5 truncate text-[12px] leading-tight tracking-[0.08em] uppercase opacity-70 wide:text-[14px]">{sub}</p>}
        </div>
      </div>
      {children && <div className="flex gap-2 max-sm:w-full sm:gap-3">{children}</div>}
    </div>
  )
}

/**
 * The description. Wide screens: a solid panel down the right side, beside the artwork. Tall
 * screens: a drawer under the caption bar (up to about 40% of the screen; longer text scrolls in it).
 * It never covers the artwork, so it can stay open while a video plays.
 */
function DescriptionSheet({
  project,
  side,
  width,
  onHeight,
  transition,
}: {
  project: Project
  side: boolean
  width: number
  onHeight: (h: number) => void
  transition: Transition
}) {
  const isVideo = project.category === 'video'
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    const report = () => onHeight(side ? 0 : el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight, side])
  const motionProps = side
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  return (
    <motion.section
      ref={ref}
      id="project-description"
      aria-label={`About ${project.title}`}
      {...motionProps}
      transition={transition}
      style={side ? { width } : undefined}
      className={`absolute bottom-0 overflow-y-auto bg-ink font-ddc text-sand ${
        side
          ? 'top-0 right-0 border-l-2 border-sand/25 px-8 pt-[88px] pb-10 short:px-5 short:pt-[60px] wide:px-10'
          : 'inset-x-0 max-h-[40dvh] border-t-2 border-sand/25 px-6 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] md:px-10'
      }`}
    >
      {/* Same hierarchy as the resume: the name in DDC Hardware, small tracked DDC labels, and the
          reading text in League Spartan. */}
      <div className="cursor-text select-text">
        {side && <h2 className="text-[24px] leading-[1.2] tracking-[0.03em] wide:text-[30px]">{project.title}</h2>}
        {side && !isVideo && project.discipline && <p className={`mt-1.5 ${DESC_LABEL}`}>{project.discipline}</p>}
        {side && <div aria-hidden="true" className="mt-3 border-t-2 border-sand/80" />}
        {isVideo && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5">
            <dt className={DESC_LABEL}>Duties</dt>
            <dd className={DESC_DETAIL}>{project.duties}</dd>
            <dt className={DESC_LABEL}>Crew size</dt>
            <dd className={DESC_DETAIL}>{project.crewSize}</dd>
            <dt className={DESC_LABEL}>Timeline</dt>
            <dd className={DESC_DETAIL}>{project.timeline}</dd>
          </dl>
        )}
        {project.description && (
          <p className="mt-4 max-w-[62ch] font-text text-[17px] leading-[1.55] text-pretty first:mt-0 wide:text-[19px]">
            {project.description}
          </p>
        )}
      </div>
    </motion.section>
  )
}

/** The description's small labels (discipline, Duties...), like the resume's section labels. */
const DESC_LABEL = 'font-ddc text-[12px] leading-tight tracking-[0.14em] uppercase opacity-65 wide:text-[13px]'
/** The video details next to those labels. */
const DESC_DETAIL = 'font-text text-[15px] leading-[1.45] wide:text-[16px]'

/** DESCRIPTION's open / closed mark: a plus whose upright stroke turns flat to make a minus. */
function PlusMinus({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="relative block size-[11px] flex-none">
      <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-current" />
      <span
        className={`absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-current transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      />
    </span>
  )
}

/** Opens in a new tab. */
function ExternalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[11px] flex-none" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 1h8v8M11 1 1 11" />
    </svg>
  )
}

/** A file to download. */
function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[11px] flex-none" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 0v8M2 4.5 6 8.5l4-4M1 11h10" />
    </svg>
  )
}
