import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from 'motion/react'
import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react'
import anvilLogo from '../assets/brand/anvil-logo.svg'
import logotype from '../assets/brand/edf-logotype-lockup.svg'
import { site, withBase, type Category } from '../content'
import { openContact } from '../lib/contact'
import { RAIL_BUTTON_H, RAIL_CLOSE_DELAY, RAIL_COLLAPSED_AT, RAIL_EASE, RAIL_EXPAND_DURATION, RAIL_NARROW, RAIL_OPEN_DELAY } from '../lib/rail'
import { ArtButton, ButtonArt } from './ButtonArt'

interface NavProps {
  category: Category
  onCategory: (c: Category) => void
}

const resumePdf = withBase(site.resumeFile)

interface NavColumnProps extends NavProps {
  /** Pixels the rail is pushed right to stay pinned at the screen's left edge once the strip passes it. */
  pin: MotionValue<number>
  /** Docking: 0 = full column, 1 = slim docked rail with square buttons (see .rail in index.css). */
  squeeze: MotionValue<number>
  slotRef?: Ref<HTMLDivElement>
  /** Receives the rail element (DesktopGallery measures it for keyboard focus). */
  onRail?: (el: HTMLElement | null) => void
  /** Logo click: back to the hero. */
  onHome?: () => void
  /** RESUME: opens the about / resume panel. Without it, RESUME goes to `resumeHref`, or the PDF. */
  onResume?: () => void
  resumeHref?: string
  /** RESUME shows its selected art: the about / resume panel is open. */
  resumeActive?: boolean
  /** DESIGN or VIDEO shows as selected (not while the about / resume panel is open). Default true. */
  categoryActive?: boolean
}

/**
 * Desktop: the sand column between the hero and the work. The slot keeps the column's full width in
 * the strip; the rail inside it pins to the left edge and narrows to a slim docked rail as the strip
 * scrolls past (squeeze, from DesktopGallery). The buttons keep their height and swap to square art.
 *
 * The docked rail opens back up when someone rests the mouse on it (or tabs into it, or taps it on a
 * touch screen), sliding over the work, and closes again when they leave. The buttons can only be
 * clicked in their wide form: while the rail is docked, a click just opens it.
 */
export function NavColumn({
  category,
  onCategory,
  pin,
  squeeze,
  slotRef,
  onRail,
  onHome,
  onResume,
  resumeHref,
  resumeActive = false,
  categoryActive = true,
}: NavColumnProps) {
  const reduce = useReducedMotion()
  const nav = useRef<HTMLElement | null>(null)

  // 0 = docked as the scroll says, 1 = opened all the way by hover / focus / tap.
  const expand = useMotionValue(0)
  const shown = useTransform(() => squeeze.get() * (1 - expand.get()))
  const isOpen = useRef(false)

  // Opened while docked: the wording grows to the buttons' width (80% of the column) and becomes the
  // logotype lockup. Over the first half the anvil and the logo's "design foundry" fade out as the
  // lockup fades in; ENRIGHT is the same in both files, so it stays solid (the logo's copy sits under
  // the lockup until the lockup is fully in). The logo itself is RAIL_BUTTON_H wide once docked.
  const words = useTransform(() => squeeze.get() * expand.get())
  const lockupOpacity = useTransform(words, [0, 0.5], [0, 1])
  const markOpacity = useTransform(lockupOpacity, (v) => 1 - v)
  const enrightOpacity = useTransform(lockupOpacity, (v) => (v >= 1 ? 0 : 1))
  const wordsScale = useTransform(() => {
    const logoW = 0.8 - (0.8 - RAIL_BUTTON_H) * squeeze.get()
    return 1 + (0.8 / logoW - 1) * words.get()
  })
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)

  const setNav = useCallback(
    (el: HTMLElement | null) => {
      nav.current = el
      onRail?.(el)
    },
    [onRail],
  )

  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    openTimer.current = closeTimer.current = undefined
  }
  const setOpen = useCallback(
    (open: boolean) => {
      if (isOpen.current === open) return
      isOpen.current = open
      animate(expand, open ? 1 : 0, { duration: reduce ? 0 : RAIL_EXPAND_DURATION, ease: RAIL_EASE })
    },
    [expand, reduce],
  )

  // Buttons only take clicks once the wide art is fully back (see .rail[data-collapsed] in index.css).
  useMotionValueEvent(shown, 'change', (v) => {
    nav.current?.toggleAttribute('data-collapsed', v > RAIL_COLLAPSED_AT)
  })

  // Real mouse movement only: when the page scrolls under a still cursor, browsers send pointer
  // events at the same screen position, and those shouldn't open the rail.
  const moved = useRef(false)
  useEffect(() => {
    let last: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      moved.current = !last || last.x !== e.screenX || last.y !== e.screenY
      last = { x: e.screenX, y: e.screenY }
    }
    // A tap or click anywhere else closes a rail that was opened by tapping it.
    const onDown = (e: PointerEvent) => {
      if (isOpen.current && nav.current && !nav.current.contains(e.target as Node)) {
        clearTimers()
        setOpen(false)
      }
    }
    window.addEventListener('pointermove', onMove, { capture: true, passive: true })
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pointerdown', onDown, { capture: true })
      clearTimers()
    }
  }, [setOpen])

  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch' || !moved.current) return
    window.clearTimeout(closeTimer.current)
    closeTimer.current = undefined
    if (isOpen.current || openTimer.current !== undefined || squeeze.get() === 0) return
    openTimer.current = window.setTimeout(() => {
      openTimer.current = undefined
      setOpen(true)
    }, RAIL_OPEN_DELAY)
  }
  const onPointerLeave = () => {
    window.clearTimeout(openTimer.current)
    openTimer.current = undefined
    if (isOpen.current && closeTimer.current === undefined) {
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = undefined
        setOpen(false)
      }, RAIL_CLOSE_DELAY)
    }
  }
  // A click or tap on the docked rail opens it straight away (the buttons ignore it until then).
  const onPointerDown = () => {
    if (shown.get() > RAIL_COLLAPSED_AT) {
      clearTimers()
      setOpen(true)
    }
  }
  // Keyboard: tabbing into the rail opens it; tabbing out closes it. Only keyboard focus counts: when
  // the contact popup is closed with the mouse, the browser hands focus back to CONTACT, and that
  // shouldn't open a docked rail.
  const onFocus = (e: ReactFocusEvent) => {
    try {
      if (!(e.target as Element).matches(':focus-visible')) return
    } catch {
      // very old browsers: treat all focus as keyboard focus
    }
    clearTimers()
    setOpen(true)
  }
  const onBlur = (e: ReactFocusEvent) => {
    if (nav.current?.contains(e.relatedTarget as Node | null)) return
    if (nav.current?.matches(':hover')) return
    clearTimers()
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined
      setOpen(false)
    }, RAIL_CLOSE_DELAY)
  }

  return (
    <div
      ref={slotRef}
      className="rail-slot relative z-10 h-screen flex-none"
      style={{ '--btn-h': RAIL_BUTTON_H, '--rail-narrow': RAIL_NARROW } as CSSProperties}
    >
      <motion.nav
        ref={setNav}
        id="nav"
        aria-label="Work categories and contact"
        style={{ x: pin, '--squeeze': shown, '--scroll-squeeze': squeeze, '--words': words } as MotionStyle}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className="rail absolute inset-y-0 left-0 flex flex-col items-center bg-sand font-ddc wide:pb-10"
      >
        {/* The logo's size follows the scroll only: full size beside the hero, small once docked, so the
            buttons below never move when the docked rail opens. Opening it shows the logotype lockup at
            the buttons' width: the anvil fades out, and the wording grows upward from its bottom edge,
            turning into the lockup (see .logo-words in index.css). It goes back to the hero. */}
        <a
          href={withBase('/')}
          aria-label="Enright Design Foundry"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault()
            clearTimers()
            setOpen(false)
            onHome?.()
          }}
          className="rail-home rail-logo relative block flex-none outline-offset-4 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <motion.img src={anvilLogo} alt="" draggable={false} className="logo-mark block w-full" style={{ opacity: markOpacity }} />
          <motion.span className="logo-words absolute inset-0 block" style={{ scale: wordsScale }}>
            <motion.img
              src={anvilLogo}
              alt=""
              draggable={false}
              className="logo-enright absolute top-0 left-0 block w-full"
              style={{ opacity: enrightOpacity }}
            />
            <motion.img
              src={anvilLogo}
              alt=""
              draggable={false}
              className="logo-foundry absolute top-0 left-0 block w-full"
              style={{ opacity: markOpacity }}
            />
            <motion.img src={logotype} alt="" draggable={false} className="logo-lockup absolute block" style={{ opacity: lockupOpacity }} />
          </motion.span>
        </a>
        {/* Rule under the logo, matching the one over CONTACT. The logo is optically centered
            between the top of the rail and this rule (see .rail-logo-rule), and DESIGN's ink starts 19px
            below the rule, like RESUME's ink above the bottom rule. */}
        <div aria-hidden="true" className="rail-logo-rule mx-[10px] flex-none self-stretch border-t-[3px] border-ink" />
        <ArtButton
          name="design-wide"
          label="Design"
          active={categoryActive && category === 'design'}
          onClick={() => onCategory('design')}
          className="relative mt-[18px] w-full"
          boxClassName="rail-btn mb-[6px]"
          artClassName="rail-art rail-wide"
        >
          <ButtonArt
            name="design-square"
            active={categoryActive && category === 'design'}
            className="rail-square-art rail-square pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
          />
        </ArtButton>
        <ArtButton
          name="video-wide"
          label="Video"
          active={categoryActive && category === 'video'}
          onClick={() => onCategory('video')}
          className="relative mt-[5px] w-full"
          boxClassName="rail-btn mb-[6px]"
          artClassName="rail-art rail-wide"
        >
          <ButtonArt
            name="video-square"
            active={categoryActive && category === 'video'}
            className="rail-square-art rail-square pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
          />
        </ArtButton>
        {/* Bottom of the rail: RESUME, then the rule over CONTACT. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <ArtButton
            name="resume-wide"
            label="Resume"
            onClick={onResume}
            href={onResume ? undefined : (resumeHref ?? resumePdf)}
            active={resumeActive}
            className="relative mb-[10px] w-full"
            boxClassName="rail-btn mb-[6px]"
            artClassName="rail-art rail-wide"
          >
            <ButtonArt
              name="resume-square"
              active={resumeActive}
              className="rail-square-art rail-square pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
            />
          </ArtButton>
          {/* CONTACT: full size in the wide rail, shrinking to the square buttons' width when docked. The line
              height stays the same, so RESUME above it never moves. It opens the contact popup
              (ContactDialog.tsx, drawn by App.tsx). */}
          <div className="mx-[10px] flex items-center justify-center self-stretch border-t-[3px] border-ink py-[10px] leading-8 whitespace-nowrap">
            {/* Padding with matching negative margin: a 44px-tall hit area without moving the text. */}
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={openContact}
              className="rail-contact -mt-[6px] -mb-[3px] cursor-pointer py-[6px] text-ink outline-offset-0 focus-visible:outline-2 focus-visible:outline-ink"
            >
              Contact
            </button>
          </div>
        </div>
      </motion.nav>
    </div>
  )
}

/**
 * Phones and upright tablets: the bar across the top of the page. CONTACT opens the contact popup;
 * RESUME opens the about / resume panel at the resume (or, without `onResume`, the PDF).
 */
export function MobileContactBar({ onResume }: { onResume?: () => void }) {
  // pb-3 makes each one a 44px-tall target; the extra hangs invisibly below the bar.
  const link =
    'block w-full cursor-pointer pb-3 text-center font-ddc text-[clamp(16px,5vw,22px)] leading-8 text-sand outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-sand md:text-[18px]'
  const cell = 'h-[35px] w-1/2 bg-ink sm:h-[31px] sm:w-[25vw] sm:max-w-[240px]'
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[33px] items-end justify-center bg-sand sm:h-[31px] sm:bg-transparent">
      <div className={cell}>
        <button type="button" aria-haspopup="dialog" onClick={openContact} className={link}>
          Contact
        </button>
      </div>
      <div className={cell}>
        {onResume ? (
          <button type="button" onClick={onResume} className={link}>
            Resume
          </button>
        ) : (
          <a href={resumePdf} className={link}>
            Resume
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * Mobile and tablet: the DESIGN / VIDEO row under the hero. Once scrolled to, it sticks to the top of
 * the screen, so switching sides never means scrolling back up (and from the about / resume panel,
 * either one goes back to the work). Its height is --mnav-h (index.css).
 */
export function MobileNavRow({ category, onCategory, categoryActive = true }: NavProps & { categoryActive?: boolean }) {
  const art = 'h-[35px] w-[99px] sm:h-[40px] sm:w-[113px] md:h-[46px] md:w-[130px] short:h-[35px] short:w-[99px]'
  const button = 'min-h-[44px] w-1/2 items-center sm:w-[160px]'
  return (
    <nav
      id="nav"
      aria-label="Work categories"
      className="sticky top-0 z-20 flex h-[var(--mnav-h)] items-center justify-center gap-[50px] bg-sand shadow-[0_1px_0_rgb(29_38_44/0.25)]"
    >
      <ArtButton
        name="design-wide"
        label="Design"
        active={categoryActive && category === 'design'}
        onClick={() => onCategory('design')}
        className={button}
        boxClassName={art}
      />
      <ArtButton
        name="video-wide"
        label="Video"
        active={categoryActive && category === 'video'}
        onClick={() => onCategory('video')}
        className={button}
        boxClassName={art}
      />
    </nav>
  )
}
