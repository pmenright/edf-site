import { useSyncExternalStore } from 'react'

/**
 * Open / closed state for one of the site's popups (contact, resume). The state lives outside the
 * components that have the buttons, so each popup can be drawn once at the top of the app
 * (App.tsx), outside the sliding gallery: focus inside a popup then never makes the gallery
 * scroll, and the rail never reacts to it.
 */
export function createPopupState() {
  let isOpen = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return {
    open() {
      if (isOpen) return
      isOpen = true
      emit()
    },
    close() {
      if (!isOpen) return
      isOpen = false
      emit()
    },
    useIsOpen() {
      return useSyncExternalStore(subscribe, () => isOpen)
    },
  }
}

let holds = 0
/**
 * While a popup or the project viewer is open, the gallery's own wheel / arrow-key scrolling stands
 * down (DesktopGallery checks the `viewer-open` class). Counted, so a popup closing under the viewer
 * (RESUME's VIEW) doesn't switch it back on early. Returns the release.
 */
export function holdPage() {
  holds++
  document.documentElement.classList.add('viewer-open')
  let released = false
  return () => {
    if (released) return
    released = true
    holds--
    if (holds === 0) document.documentElement.classList.remove('viewer-open')
  }
}

/** Look of a popup's buttons: filled (the main action, hollows out on hover) or outlined (fills in). */
export const POPUP_BUTTON =
  'block h-[40px] border-2 border-sand text-[16px] leading-[36px] tracking-[0.08em] uppercase transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-sand'
export const POPUP_BUTTON_FILLED = 'bg-sand text-ink group-hover:bg-transparent group-hover:text-sand'
export const POPUP_BUTTON_OUTLINED = 'bg-transparent text-sand group-hover:bg-sand group-hover:text-ink'
