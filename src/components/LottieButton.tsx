import { useEffect, useRef, type ReactNode } from 'react'
import { useLottie } from '../hooks/useLottie'

interface LottieButtonProps {
  path: string
  label: string
  active: boolean
  onClick: () => void
  /** Sizes the Lottie box (the button artwork). */
  artClassName: string
  className?: string
  /** Extra layers drawn over the artwork (the desktop rail's square placeholder). */
  children?: ReactNode
}

/**
 * DESIGN / VIDEO buttons. The Lottie is a 5-frame "press" animation:
 * hover plays it forward, leaving plays it back (same as Webflow).
 * New: the active category stays pressed.
 */
export function LottieButton({ path, label, active, onClick, artClassName, className = '', children }: LottieButtonProps) {
  const art = useRef<HTMLDivElement>(null)
  const anim = useLottie(art, { path })
  const hovered = useRef(false)
  const activeRef = useRef(active)

  const press = (down: boolean) => {
    if (!anim) return
    anim.setDirection(down ? 1 : -1)
    anim.play()
  }

  // Jump straight to the right frame once loaded, then animate on changes.
  useEffect(() => {
    if (!anim) return
    anim.goToAndStop(activeRef.current ? anim.totalFrames - 1 : 0, true)
  }, [anim])

  useEffect(() => {
    activeRef.current = active
    if (active) press(true)
    else if (!hovered.current) press(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        hovered.current = true
        press(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return
        hovered.current = false
        if (!activeRef.current) press(false)
      }}
      className={`flex cursor-pointer justify-center outline-offset-4 focus-visible:outline-2 focus-visible:outline-ink ${className}`}
    >
      <div ref={art} className={artClassName} aria-hidden="true" />
      {children}
    </button>
  )
}
