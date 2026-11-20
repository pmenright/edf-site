import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import closeX from '../assets/brand/close-x.svg'
import { holdPage } from '../lib/popup'

// Keys that would scroll the page behind the popup.
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'])

interface PopupProps {
  /** id of the popup's heading, which names it for screen readers. */
  labelledBy: string
  /** id of the text that describes it, if any. */
  describedBy?: string
  /** What gets focus when it opens. */
  initialFocus: RefObject<HTMLElement | null>
  /** Sizes and pads the box. */
  panelClassName: string
  onClose: () => void
  /** The box's contents. `close` plays the closing animation, then calls onClose. */
  children: (close: () => void) => ReactNode
}

/**
 * The site's popups (contact, resume): a box with a sand outline on ink over a dimmed page, like the
 * project viewer's download popup. A native <dialog>, so focus trapping and screen-reader semantics
 * come built in; Esc, the close button or a click outside the box closes it. The backdrop fades and
 * the box rises in (.popup-* in index.css); closing plays that in reverse. While it's open the page
 * behind doesn't scroll.
 */
export function Popup({ labelledBy, describedBy, initialFocus, panelClassName, onClose, children }: PopupProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const d = dialog.current!
    if (!d.open) d.showModal()
    initialFocus.current?.focus({ preventScroll: true })

    // Keep the page behind still: the gallery's own wheel / arrow-key handlers stand down while this
    // class is on (same as the project viewer), and wheel turns over the popup are swallowed unless
    // the box itself has something to scroll (only on very short screens).
    const release = holdPage()
    const onWheel = (e: WheelEvent) => {
      const box = panel.current
      if (box && box.contains(e.target as Node) && box.scrollHeight > box.clientHeight) return
      e.preventDefault()
    }
    d.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      release()
      d.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closed = useRef(false)
  const finishClose = () => {
    if (closed.current) return
    closed.current = true
    dialog.current?.close()
    onClose()
  }
  const close = () => setLeaving(true)

  // Safety net in case the exit animation never reports back (e.g. the tab was hidden mid-animation).
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(finishClose, 600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  return (
    <dialog
      ref={dialog}
      className="popup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(e) => {
        // Esc (and other close requests) play the closing animation first.
        e.preventDefault()
        close()
      }}
      onClose={() => {
        // If the browser closed the dialog by itself, tidy up straight away.
        if (closed.current) return
        closed.current = true
        onClose()
      }}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement
        if (!SCROLL_KEYS.has(e.key)) return
        if (e.key === ' ' && target.closest('button, a')) return // space still presses buttons
        if (panel.current && panel.current.scrollHeight > panel.current.clientHeight) return
        e.preventDefault()
      }}
    >
      <div
        className="popup-backdrop absolute inset-0 bg-black/60"
        data-leaving={leaving || undefined}
        onClick={close}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && leaving) finishClose()
        }}
      />
      <div
        ref={panel}
        className={`popup-panel relative w-full border-2 border-sand bg-ink text-center text-sand ${panelClassName}`}
        data-leaving={leaving || undefined}
      >
        {children(close)}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="group absolute top-2 right-2 grid size-11 cursor-pointer place-items-center outline-none"
        >
          <img
            src={closeX}
            alt=""
            className="size-[22px] rounded-full transition-transform duration-200 ease-in-out group-hover:scale-130 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-sand"
          />
        </button>
      </div>
    </dialog>
  )
}

