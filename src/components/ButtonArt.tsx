import { useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { buttonArt, type ButtonArtName } from '../content/buttonArt'
import { artTiming, useArtHover } from '../lib/buttonArt'

interface ButtonArtProps {
  name: ButtonArtName
  /** Show the selected-category frame instead of the hover frames. */
  active?: boolean
  className?: string
}

/**
 * One button's art (built by scripts/build-buttons.mjs from Jim's SVGs): every hover frame stacked
 * in the same spot, with only the one matching --art-frame showing, and the selected frame on top,
 * swapped in instantly. Every frame is drawn the same way at the same size, so nothing shifts
 * between frames. The box keeps the artboard's proportions, so the art is only ever scaled evenly.
 */
export function ButtonArt({ name, active = false, className = '' }: ButtonArtProps) {
  const art = buttonArt[name]
  return (
    <span
      aria-hidden="true"
      data-active={active || undefined}
      className={`art-window ${className}`}
      style={{ aspectRatio: `${art.width} / ${art.height}` }}
    >
      {art.frames.map((src, i) => (
        <img key={i} src={src} alt="" draggable={false} className="art-frame" style={{ '--i': i } as CSSProperties} />
      ))}
      {art.active && <img src={art.active} alt="" draggable={false} className="art-active" />}
    </span>
  )
}

interface ArtButtonProps {
  name: ButtonArtName
  label: string
  active: boolean
  /** A button (DESIGN / VIDEO)... */
  onClick?: () => void
  /** ...or a link. Active then means "this is the current page". */
  href?: string
  /** The button opens a popup (RESUME for now) rather than switching anything on or off. */
  popup?: boolean
  /** Sizes the box the art sits in. */
  boxClassName: string
  /** Sizes the art inside the box. */
  artClassName?: string
  className?: string
  /** Extra layers drawn over the artwork (the desktop rail's square art). */
  children?: ReactNode
}

/**
 * DESIGN / VIDEO / RESUME. Hover (or keyboard focus) plays the frames forward and leaving plays
 * them back from wherever they got to; the selected one shows its active frame. When it stops being
 * selected it releases: it starts from its end frame and plays back down to the resting frame (or
 * holds the end frame if the pointer is still on it).
 */
export function ArtButton({ name, label, active, onClick, href, popup = false, boxClassName, artClassName = 'w-full', className = '', children }: ArtButtonProps) {
  const hover = useArtHover()
  const ref = useRef<HTMLElement | null>(null)
  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el
  }, [])
  const wasActive = useRef(active)

  // Runs before paint, so the active frame is replaced by the end frame with no flash of the start.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && wasActive.current && !active) {
      el.style.transition = 'none'
      el.style.setProperty('--art-frame', getComputedStyle(el).getPropertyValue('--art-last'))
      void getComputedStyle(el).getPropertyValue('--art-frame') // commit the end frame first
      el.style.transition = ''
      el.style.removeProperty('--art-frame') // ...then run back from it
    }
    wasActive.current = active
  }, [active])

  const art = (
    <>
      <span className={`flex items-center justify-center ${boxClassName}`}>
        <ButtonArt name={name} active={active} className={artClassName} />
      </span>
      {children}
    </>
  )
  const shared = {
    ...hover,
    ref: setRef,
    'aria-label': label,
    style: artTiming(name),
    className: `art-btn flex cursor-pointer justify-center outline-offset-4 focus-visible:outline-2 focus-visible:outline-ink ${className}`,
  }
  return href ? (
    <a {...shared} href={href} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {art}
    </a>
  ) : (
    <button {...shared} type="button" aria-pressed={popup ? undefined : active} aria-haspopup={popup ? 'dialog' : undefined} onClick={onClick}>
      {art}
    </button>
  )
}
