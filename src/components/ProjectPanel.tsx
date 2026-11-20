import type { Project } from '../content'
import { STRIP_QUERY } from '../hooks/useMediaQuery'
import { preload } from '../lib/preload'
import { LottieLoop } from './Lottie'
import { Picture } from './Picture'

interface ProjectPanelProps {
  project: Project
  onOpen: (p: Project) => void
  /** First couple of panels load right away; the rest wait until they're near the screen. */
  eager?: boolean
  className: string
}

/** One square project tile. Grayscale until hover on desktop (see .thumb in index.css). */
export function ProjectPanel({ project, onOpen, eager = false, className }: ProjectPanelProps) {
  const { thumb } = project
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      onPointerEnter={() => preload(project)}
      onPointerDown={() => preload(project)}
      onFocus={() => preload(project)}
      aria-label={`${project.title}, open project`}
      data-project={project.id}
      className={`panel relative block flex-none cursor-pointer overflow-hidden bg-ink outline-none ${className}`}
    >
      {thumb.type === 'image' ? (
        <Picture
          asset={thumb.asset}
          alt={thumb.alt}
          sizes={`${STRIP_QUERY} 100vh, (orientation: landscape) 50vw, (min-width: 768px) 50vw, 100vw`}
          loading={eager ? 'eager' : 'lazy'}
          className="thumb h-full w-full object-cover"
        />
      ) : (
        <LottieLoop path={thumb.src} className="thumb h-full w-full" />
      )}
    </button>
  )
}
