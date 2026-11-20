import { useCallback, useEffect, useRef, useState } from 'react'
import type { AboutSlide } from '../about/AboutLayer'

/** "#about" opens the about / resume panel on About, "#about/resume" on the resume. */
function slideFromHash(): AboutSlide | null {
  const hash = window.location.hash
  return hash === '#about' ? 0 : hash === '#about/resume' ? 1 : null
}
const hashFor = (s: AboutSlide) => (s === 1 ? '#about/resume' : '#about')

export interface AboutState {
  open: boolean
  /** The slide it opens on (or was last asked to show). */
  slide: AboutSlide
  /** Bumped on every request to show a slide, so asking for the same one again still goes there. */
  seq: number
}

/**
 * The about / resume panel's state, kept in the address bar so links open it ("/#about",
 * "/#about/resume"; the old "/about/" page forwards there). Opening it adds a history entry, so the
 * browser's back button closes it again. Turning between the slides just updates the address.
 */
export function useAboutHash() {
  const [state, setState] = useState<AboutState>(() => {
    const s = slideFromHash()
    return { open: s !== null, slide: s ?? 0, seq: 0 }
  })
  const openRef = useRef(state.open)
  useEffect(() => {
    openRef.current = state.open
  }, [state.open])

  useEffect(() => {
    const onPop = () => {
      const s = slideFromHash()
      if (s === null) window.history.scrollRestoration = 'auto'
      openRef.current = s !== null
      setState((st) => (s === null ? (st.open ? { ...st, open: false } : st) : { open: true, slide: s, seq: st.seq + 1 }))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openAbout = useCallback((slide: AboutSlide) => {
    if (window.history.state?.about) window.history.replaceState(window.history.state, '', hashFor(slide))
    else {
      // Going back from this entry (closing the panel) shouldn't put the page back where it was when
      // the panel opened: the galleries place the work themselves (a DESIGN / VIDEO switch starts that
      // side from its beginning). New entries copy this setting, so both ends of the step are manual.
      window.history.scrollRestoration = 'manual'
      window.history.pushState({ about: true }, '', hashFor(slide))
    }
    openRef.current = true
    setState((st) => ({ open: true, slide, seq: st.seq + 1 }))
  }, [])

  const closeAbout = useCallback(() => {
    if (!openRef.current) return
    openRef.current = false
    setState((st) => ({ ...st, open: false }))
    if (window.history.state?.about) window.history.back()
    else window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  /** The panel settled on a slide: keep the address in step, so a copied link opens the same one. */
  const setSlide = useCallback((slide: AboutSlide) => {
    if (!openRef.current || slideFromHash() === slide) return
    window.history.replaceState(window.history.state, '', hashFor(slide))
  }, [])

  return { about: state, openAbout, closeAbout, setAboutSlide: setSlide }
}
