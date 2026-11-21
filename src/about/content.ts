import aboutData from '../content/about.json'
import resumeData from '../content/resume.json'

/** One line of a job. */
export interface Bullet {
  text: string
}

/** A posting within a job (the Navy's commands). */
export interface Unit {
  org: string
  location?: string
  dates: string
  bullets: Bullet[]
}

export interface Job {
  org: string
  /** Short name on the job's tab (desktop board): "Freelance", "Bowhead"... */
  tab: string
  /** Years under the tab name: "2013 to now" */
  years: string
  /** "Freelance" */
  kind?: string
  location?: string
  title: string
  dates: string
  /** Highlighted as the current job. */
  current?: boolean
  /** An ink banner after the job's lines, with the email address, COPY and EMAIL (freelance). */
  banner?: { title: string; text: string }
  bullets: Bullet[]
  units?: Unit[]
}

export interface Honor {
  title: string
  /** A one-line version (not shown on the site any more; kept for reference). */
  short: string
  /** The full entry, as on the PDF. */
  text: string
  /**
   * Public records of the award (official announcements), or the work itself. With `project`, the
   * link opens that piece in the lightbox (src/content/index.ts); `href` is the fallback.
   */
  links: { label: string; href: string; project?: string }[]
  /** Which of the desktop board's two columns it sits in. */
  column?: 1 | 2
}

/** A skill, or a skill with its parts (Adobe Creative Cloud > Illustrator, InDesign...). */
export type SkillItem = string | { name: string; sub: string[] }

export interface SkillGroup {
  group: string
  items: SkillItem[]
}

export interface School {
  school: string
  note?: string
  credential: string
  dates: string
  honor?: string
}

export interface Resume {
  name: string
  title: string
  tagline: string
  summary: string
  work: Job[]
  honors: Honor[]
  skills: SkillGroup[]
  education: School[]
}

export interface About {
  headline: string
  /** The letter in the box, one entry per paragraph. */
  letter: string[]
  signature: string
  signoff: string
  /** The cutout portrait: a key in media.json (transparent PNG). */
  photo: string
  photoAlt: string
}

export const resume = resumeData as Resume
export const about = aboutData as About
