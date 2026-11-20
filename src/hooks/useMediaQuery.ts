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
 * screens at least 5:4 wide. Portrait tablets and monitors get the vertical stack, since their
 * screen-tall square panels would be wider than the screen. Same query as the `strip:` variant in index.css.
 */
export const STRIP_QUERY = '(min-width: 992px) and (min-aspect-ratio: 5/4)'
export const useIsDesktop = () => useMediaQuery(STRIP_QUERY)
