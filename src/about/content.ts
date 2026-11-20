import aboutData from '../content/about.json'
import resumeData from '../content/resume.json'

/** One line of a job: the desktop resume board shows only the `key` ones. */
export interface Bullet {
  text: string
  key?: boolean
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
  /** "Freelance" */
  kind?: string
  location?: string
  title: string
  dates: string
  /** Highlighted as the current job. */
  current?: boolean
  bullets: Bullet[]
  units?: Unit[]
}

export interface Honor {
  title: string
  /** One line for the desktop board. */
  short: string
  /** The full entry, as on the PDF. */
  text: string
  /** Public records of the award (official announcements), or the work itself. */
  links: { label: string; href: string }[]
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
