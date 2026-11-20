import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type MouseEvent } from 'react'
import { byCategory, resumeProject, type Category, type Project } from '../content'
import { Hero } from './Hero'
import { MobileContactBar, MobileNavRow } from './Nav'
import { ProjectPanel } from './ProjectPanel'

interface GalleryProps {
  category: Category
  onCategory: (c: Category) => void
  onOpen: (p: Project) => void
  /** Open scrolled past the hero to the start of the work (links like "/#video"). */
  startAtWork?: boolean
  /** Open scrolled to this project's panel (links like "/?panel=nsyte"). */
  startAtPanel?: string
}

/**
 * Phones and tablets (under 992px): a normal vertical page.
 * Bar with CONTACT and RESUME, hero, DESIGN / VIDEO row, then full-width square panels.
 * Switching category slides the two columns sideways.
 */
/** The resume, opened by RESUME in the viewer (undefined until its pages exist). */
const resume = resumeProject

export function MobileGallery({ category, onCategory, onOpen, startAtWork, startAtPanel }: GalleryProps) {
  const reduce = useReducedMotion()
  const work = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const panel = startAtPanel && document.querySelector(`.panel[data-project="${CSS.escape(startAtPanel)}"]`)
    if (panel) panel.scrollIntoView({ block: 'center' })
    else if (startAtWork) work.current?.scrollIntoView({ block: 'start' })
  }, [startAtWork, startAtPanel])
  /** Skip link: straight to the first project of the current category. */
  const columns = useRef<HTMLDivElement>(null)
  const skipToWork = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const first = columns.current?.querySelector<HTMLElement>('section:not([inert]) .panel')
    first?.focus({ preventScroll: true })
    first?.scrollIntoView({ block: 'start', behavior: reduce ? 'instant' : 'smooth' })
  }
  return (
    <main className="relative py-5 md:py-0">
      <a
        href="#nav"
        onClick={skipToWork}
        className="sr-only z-50 bg-sand px-4 py-2 font-ddc text-[18px] text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-2 focus:outline-offset-2 focus:outline-sand"
      >
        Skip to work
      </a>
      <MobileContactBar onResume={resume ? () => onOpen(resume) : undefined} />
      <Hero className="h-[95vh] w-full" />
      <div ref={work} aria-hidden="true" />
      <MobileNavRow category={category} onCategory={onCategory} />
      <div ref={columns} className="overflow-hidden">
        <motion.div
          initial={false}
          animate={{ x: category === 'video' ? '-50%' : '0%' }}
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeInOut' }}
          className="flex w-[200%] items-start"
        >
          {(['design', 'video'] as const).map((cat) => (
            <section
              key={cat}
              aria-label={cat === 'design' ? 'Design work' : 'Video work'}
              aria-hidden={cat !== category}
              inert={cat !== category}
              className="flex w-1/2 flex-col"
            >
              {byCategory[cat].map((p) => (
                <ProjectPanel key={p.id} project={p} onOpen={onOpen} className="aspect-square w-full" />
              ))}
            </section>
          ))}
        </motion.div>
      </div>
    </main>
  )
}
