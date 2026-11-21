export type Category = 'design' | 'video'

export interface ImageMedia {
  type: 'image'
  /** Key into media.json, e.g. "design/full/Tempest.png" */
  asset: string
  alt: string
  /**
   * For boards made of two halves side by side: on screens where it shows the board larger
   * (phones, portrait tablets), the viewer stacks the halves. `true` puts the left half on top;
   * "right-first" puts the right half on top.
   */
  split?: true | 'right-first'
  /**
   * A second layout of the same board for tall screens (phones, upright tablets), e.g.
   * "design/full/candescent_full-vertical.png". The viewer shows whichever of the two comes out larger.
   */
  portrait?: string
}

export interface YouTubeMedia {
  type: 'youtube'
  youtubeId: string
  title: string
  /** Which YouTube poster frame exists for this video */
  poster: 'maxresdefault' | 'sddefault' | 'hqdefault'
  /** Start playing this many seconds in. */
  start?: number
}

export type Media = ImageMedia | YouTubeMedia

/** A multi-page document (e.g. a PDF deck), shown as its pages stacked in a scrolling column. */
export interface DocumentMedia {
  type: 'document'
  /** Page images (keys into media.json), in order */
  pages: string[]
  /** Names the document; each page's alt text adds "page N of M" */
  alt: string
}

export type Thumb =
  | { type: 'image'; asset: string; alt: string }
  | { type: 'lottie'; src: string; alt: string }

export interface Project {
  id: string
  category: Category
  order: number
  title: string
  /** Design projects: "Brand Design", "Typeface", ... */
  discipline?: string
  /** Video projects */
  duties?: string
  crewSize?: string
  timeline?: string
  description: string
  thumb: Thumb
  /** What the viewer shows; the first one is used. A document (the resume) shows as scrolling pages. */
  media: Array<Media | DocumentMedia>
  /**
   * Optional button next to DESCRIPTION: a live piece to visit (opens in a new tab), or with
   * `download` set, a file to download (saved under that name) from a small popup headed
   * `downloadTitle`.
   */
  link?: { label: string; href: string; download?: string; downloadTitle?: string }
  /** Optional second view in the viewer (a video, another image or a document), swapped in with its own button. */
  alternate?: { label: string; backLabel: string; media: Media | DocumentMedia }
}

export interface MediaAsset {
  width: number
  height: number
  avif: string
  webp: string
  fallback: string
  blur: string
  animated?: boolean
}
