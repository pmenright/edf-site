import { useState, type CSSProperties, type PointerEvent } from 'react'
import { buttonArt, buttonFps, type ButtonArtName } from '../content/buttonArt'

/**
 * Timing variables for a hover target (the element with the `art-btn` class): how many frames to
 * run through and how long that takes at the art's frame rate. See `.art-btn` in index.css.
 */
export function artTiming(name: ButtonArtName): CSSProperties {
  const last = buttonArt[name].frames.length - 1
  return { '--art-last': last, '--art-dur': `${last / buttonFps}s` } as CSSProperties
}

/**
 * Hover for button art: a mouse, trackpad or pen pointer over the button plays the frames
 * forward (data-hover), and leaving plays them back. Touch never sets it, so a tap doesn't leave a
 * button stuck halfway. Keyboard focus is handled in CSS (:focus-visible).
 */
export function useArtHover() {
  const [hover, setHover] = useState(false)
  return {
    'data-hover': hover || undefined,
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType !== 'touch') setHover(true)
    },
    onPointerLeave: () => setHover(false),
  }
}
