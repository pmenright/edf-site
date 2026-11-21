import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/**
 * The horizontal-scroll layout starts at the same 992px breakpoint as the Webflow site, but only on
 * screens wide enough to show one whole square panel beside the docked rail: at least as wide as
 * the screen is tall, plus the docked rail. The rail is 20% of the screen's height at full width and
 * docks to 407/1153 of that (the button art's shape, RAIL_NARROW in src/lib/rail.ts), so that's a
 * width of 1.0706 times the height. Narrower screens (portrait tablets and monitors, squarish
 * windows) get the vertical page. Same query as the `strip:` variant in index.css.
 */
export const STRIP_QUERY = '(min-width: 992px) and (min-aspect-ratio: 10706/10000)'
export const useIsDesktop = () => useMediaQuery(STRIP_QUERY)
