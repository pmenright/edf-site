import { useCallback, useEffect, useState } from 'react'
import { findProject, resumeProject, type Project } from '../content'

/** Reads "#design/tempest" style links, and "#resume" for the resume. */
function projectFromHash(): Project | undefined {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash === 'resume') return resumeProject
  const [category, id] = hash.split('/')
  return category && id ? findProject(category, id) : undefined
}

const hashFor = (p: Project) => (p === resumeProject ? '#resume' : `#${p.category}/${p.id}`)

/**
 * Keeps the open project in the URL so links can be shared and the browser's
 * back button closes the viewer.
 */
export function useViewerHash() {
  const [open, setOpen] = useState<Project | undefined>(() => projectFromHash())

  useEffect(() => {
    const onPop = () => setOpen(projectFromHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openProject = useCallback((p: Project) => {
    window.history.pushState({ viewer: true }, '', hashFor(p))
    setOpen(p)
  }, [])

  const closeProject = useCallback(() => {
    if (window.history.state?.viewer) {
      window.history.back() // popstate clears `open`
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setOpen(undefined)
    }
  }, [])

  return { open, openProject, closeProject }
}
