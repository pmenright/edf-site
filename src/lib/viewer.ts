import type { Project } from '../content'

type Listener = (p: Project) => void
const listeners = new Set<Listener>()

/** Open a project in the lightbox from anywhere on the page (App.tsx listens), like the resume's WATCH. */
export function showProject(p: Project) {
  listeners.forEach((f) => f(p))
}

export function onShowProject(f: Listener) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}
