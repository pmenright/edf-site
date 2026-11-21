import { useCallback, useEffect, useRef, useState } from 'react'
import { DesktopGallery } from './components/DesktopGallery'
import { MobileGallery } from './components/MobileGallery'
import { Preloader } from './components/Preloader'
import { ContactDialog } from './components/ContactDialog'
import { ResumeDialog } from './components/ResumeDialog'
import { ProjectViewer } from './components/ProjectViewer'
import { projects, type Category, type Project } from './content'
import { useIsDesktop } from './hooks/useMediaQuery'
import { useAboutHash } from './hooks/useAboutHash'
import { useViewerHash } from './hooks/useViewerHash'
import { closeContact, useContactOpen } from './lib/contact'
import { closeResume, useResumeOpen } from './lib/resume'
import { onShowProject } from './lib/viewer'
import { preload } from './lib/preload'

/** "#design" or "#video" on its own (the Nsyte page's footer links) opens that side of the work. */
function categoryFromHash(): Category | undefined {
  const hash = window.location.hash.replace(/^#/, '')
  return hash === 'design' || hash === 'video' ? hash : undefined
}

/** "?panel=nsyte" (the Nsyte copy's logo) opens the gallery scrolled to that project's panel. */
function panelFromQuery(): Project | undefined {
  const id = new URLSearchParams(window.location.search).get('panel')
  return id ? projects.find((p) => p.id === id) : undefined
}

export default function App() {
  const isDesktop = useIsDesktop()
  const contactOpen = useContactOpen()
  const resumeOpen = useResumeOpen()
  const { open, openProject, closeProject } = useViewerHash()
  const { about, openAbout, closeAbout, setAboutSlide } = useAboutHash()
  const [startPanel] = useState(() => (open ? undefined : panelFromQuery()))
  const [category, setCategory] = useState<Category>(
    () => open?.category ?? startPanel?.category ?? categoryFromHash() ?? 'design',
  )
  const [startAtWork] = useState(() => !open && !startPanel && !!categoryFromHash())

  // Once read, drop ?panel= from the address bar so a reload or a copied link starts normally.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('panel')) return
    url.searchParams.delete('panel')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])

  // Give the full-size image a moment to arrive so the lightbox slides up with it in place.
  // If it takes longer than this, the lightbox opens anyway with a blurred preview.
  const opening = useRef<string | null>(null)
  const handleOpen = useCallback(
    async (p: Project) => {
      if (opening.current === p.id) return
      opening.current = p.id
      await Promise.race([preload(p), new Promise((r) => setTimeout(r, 400))])
      opening.current = null
      openProject(p)
    },
    [openProject],
  )
  useEffect(() => onShowProject(handleOpen), [handleOpen])

  // DESIGN / VIDEO: also closes the about / resume panel if it's open.
  const showCategory = useCallback(
    (c: Category) => {
      closeAbout()
      setCategory(c)
    },
    [closeAbout],
  )

  const Gallery = isDesktop ? DesktopGallery : MobileGallery

  return (
    <>
      <Preloader />
      <Gallery
        category={category}
        onCategory={showCategory}
        onOpen={handleOpen}
        about={about}
        onAbout={openAbout}
        onAboutSlide={setAboutSlide}
        onCloseAbout={closeAbout}
        startAtWork={startAtWork}
        startAtPanel={startPanel?.id}
      />
      {open && (
        <ProjectViewer
          key={open.id}
          project={open}
          onClose={closeProject}
        />
      )}
      {/* Outside the gallery on purpose: see src/lib/popup.ts. */}
      {contactOpen && <ContactDialog onClose={closeContact} />}
      {resumeOpen && <ResumeDialog onClose={closeResume} />}
    </>
  )
}
