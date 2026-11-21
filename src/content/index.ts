import mediaData from './media.json'
import projectsData from './projects.json'
import siteData from './site.json'
import type { Category, MediaAsset, Project } from './types'

export type * from './types'

export const site: Omit<typeof siteData, 'resumePages'> & { resumePages: string[] } = siteData
export const projects = projectsData as Project[]
const media = mediaData as Record<string, MediaAsset>

export const byCategory: Record<Category, Project[]> = {
  design: projects.filter((p) => p.category === 'design').sort((a, b) => a.order - b.order),
  video: projects.filter((p) => p.category === 'video').sort((a, b) => a.order - b.order),
}

/**
 * Lightbox-only pieces: not in the gallery, opened from elsewhere on the site. "boot-camp" is the
 * resume's WATCH (the Emmy-nominated documentary), starting at 50:18.
 */
export const extraProjects: Project[] = [
  {
    id: 'boot-camp',
    category: 'video',
    order: 0,
    title: 'Boot Camp: Making a Sailor',
    discipline: 'Documentary',
    description: '',
    thumb: { type: 'image', asset: 'about/headshot.png', alt: '' },
    media: [{ type: 'youtube', youtubeId: 'pDwLsrmDBF0', title: 'Boot Camp: Making a Sailor', poster: 'sddefault', start: 3018 }],
    link: { label: 'View on YouTube', href: 'https://www.youtube.com/watch?v=pDwLsrmDBF0&t=3018s' },
  },
]

export function findProject(category: string, id: string): Project | undefined {
  return [...projects, ...extraProjects].find((p) => p.category === category && p.id === id)
}

export const projectById = (id: string) => [...projects, ...extraProjects].find((p) => p.id === id)

/** Prefix site-root paths with Vite's base so the build also works from a sub-folder. */
export function withBase(pathOrSrcset: string): string {
  const base = import.meta.env.BASE_URL
  return pathOrSrcset.replace(/(^|,\s*)\//g, `$1${base}`)
}

export function getAsset(key: string): MediaAsset {
  const asset = media[key]
  if (!asset) throw new Error(`Missing media asset "${key}". Run "npm run media".`)
  return asset
}

/**
 * The resume, opened in the project viewer like the AFC presentation (its pages scroll), from the
 * resume popup's VIEW. Its pages are images rendered from the PDF (`resumePages` in site.json, keys
 * into media.json); until they exist there's nothing to view and VIEW stays hidden. DOWNLOAD in the
 * viewer opens the same "Download my resume" popup as the font download.
 */
export const resumeProject: Project | undefined = site.resumePages.length
  ? {
      id: 'resume',
      category: 'design',
      order: 0,
      title: 'Resume',
      description: '',
      thumb: { type: 'image', asset: site.resumePages[0], alt: 'Resume' },
      media: [{ type: 'document', alt: 'Resume', pages: site.resumePages }],
      link: {
        label: 'Download',
        href: site.resumeFile,
        download: site.resumeFile.split('/').pop(),
        downloadTitle: 'Download my resume',
      },
    }
  : undefined
