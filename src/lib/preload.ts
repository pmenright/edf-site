import { getAsset, withBase, type DocumentMedia, type Media, type Project } from '../content'

/**
 * Loads and decodes a project's viewer image (or YouTube preview frame) ahead of time,
 * so the lightbox can slide up with the picture already in it.
 *
 * Started when the pointer rests on a thumbnail, when a finger touches it, or when it
 * gets keyboard focus; the click then waits briefly for it to finish.
 */

const ready = new Set<string>()
const inflight = new Map<string, Promise<void>>()

function keyFor(m: Media): string {
  return m.type === 'image' ? m.asset : `yt:${m.youtubeId}`
}

/**
 * What the viewer will show first: a document's first page, or on a tall screen a board's portrait
 * layout if it has one (the viewer makes the exact call by size; this is the likely one).
 */
const firstPage = (m: Media | DocumentMedia): Media => {
  if (m.type === 'document') return { type: 'image', asset: m.pages[0], alt: '' }
  if (m.type === 'image' && m.portrait && window.matchMedia('(orientation: portrait)').matches) return { ...m, asset: m.portrait }
  return m
}

export function isReady(p: Project): boolean {
  return isMediaReady(p.media[0])
}

export function preload(p: Project): Promise<void> {
  return preloadMedia(p.media[0])
}

/** Same as above for any one piece of media (e.g. a project's alternate view). */
export function isMediaReady(media: Media | DocumentMedia): boolean {
  return ready.has(keyFor(firstPage(media)))
}

export function preloadMedia(media: Media | DocumentMedia): Promise<void> {
  const m = firstPage(media)
  const key = keyFor(m)
  if (ready.has(key)) return Promise.resolve()
  const existing = inflight.get(key)
  if (existing) return existing

  let img: HTMLImageElement
  if (m.type === 'image') {
    // Same <picture> markup the viewer uses, so the browser picks the same file and caches it.
    const a = getAsset(m.asset)
    const picture = document.createElement('picture')
    if (a.avif) picture.append(source('image/avif', withBase(a.avif)))
    picture.append(source('image/webp', withBase(a.webp)))
    img = document.createElement('img')
    img.sizes = '100vw'
    picture.append(img)
    img.src = withBase(a.fallback)
  } else {
    // react-lite-youtube-embed's poster URL format (with webp on).
    img = new Image()
    img.src = `https://i.ytimg.com/vi_webp/${m.youtubeId}/${m.poster}.webp`
  }

  const job = img
    .decode()
    .then(() => {
      ready.add(key)
    })
    .catch(() => {
      /* fall back to loading inside the viewer */
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, job)
  return job
}

function source(type: string, srcset: string) {
  const s = document.createElement('source')
  s.type = type
  s.srcset = srcset
  s.sizes = '100vw'
  return s
}
