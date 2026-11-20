import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { site, withBase } from '../content'
import { AwardIcon } from './AwardIcon'
import { resume, type Honor, type Job, type SkillItem } from './content'

const pdf = withBase(site.resumeFile)
const pdfName = site.resumeFile.split('/').pop()

/**
 * Desktop: the resume laid out on one screen like tools knolled on a bench. Each section is a sand
 * card on the ink "table", squared up with even gaps and crop marks at its corners. Column widths
 * run on the golden ratio (1.618 : 1 : 1), and the cards are placed by importance: the summary
 * first (top left, small), work experience the largest, then honors, skills, and education last.
 * The board shows the key lines of each job; the PDF has everything.
 */
export function ResumeBoard() {
  const board = useFitText()
  return (
    <div ref={board} className="resume-board">
      <header className="resume-board-head">
        <h2 className="font-ddc text-[1.9em] leading-none tracking-[0.04em] uppercase">Resume</h2>
        <p className="min-w-0 truncate font-ddc text-[1.05em] tracking-[0.06em] uppercase opacity-80">
          {resume.name} <span aria-hidden="true">·</span> {resume.title} <span aria-hidden="true">·</span> {resume.tagline}
        </p>
        <PdfButton />
      </header>
      <div className="resume-grid">
        <Card area="sum" n={1} title="Summary">
          <p className="resume-summary">{resume.summary}</p>
        </Card>
        <Card area="work" n={2} title="Work experience">
          <WorkList keyOnly />
        </Card>
        <Card area="hon" n={3} title="Honors & awards">
          <HonorList compact />
        </Card>
        <Card area="skl" n={4} title="Skills & interests">
          <SkillList />
        </Card>
        <Card area="edu" n={5} title="Education">
          <EducationList compact />
        </Card>
      </div>
    </div>
  )
}

/** Text sizes on the board run from here (smallest that's still comfortable) to there. */
const FIT_MIN = 11
const FIT_MAX = 17
/** Text size when the board can't fit one screen and scrolls instead. */
const FLOW_SIZE = 13

/**
 * Sizes the board's text to the screen: the largest size (between FIT_MIN and FIT_MAX px, and no more
 * than 1.6% of the screen height) at which every card's contents fit without scrolling. Everything on
 * the board is in ems, so the whole layout scales together. Rechecked when the window resizes.
 * On screens too short for that (small laptops), the board switches to flowing (data-flow): same
 * cards, at FLOW_SIZE, as tall as they need, and the resume slide scrolls down.
 */
function useFitText() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const fits = (size: number) => {
      el.style.fontSize = `${size}px`
      return [...el.querySelectorAll<HTMLElement>('.resume-card-body')].every((b) => b.scrollHeight <= b.clientHeight + 1)
    }
    const fit = () => {
      el.removeAttribute('data-flow')
      const max = Math.max(FIT_MIN, Math.min(FIT_MAX, window.innerHeight * 0.016))
      if (fits(max)) return
      if (!fits(FIT_MIN)) {
        el.setAttribute('data-flow', '')
        el.style.fontSize = `${FLOW_SIZE}px`
        return
      }
      let lo = FIT_MIN
      let hi = max
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }
    fit()
    // Web fonts arriving change the measurements.
    void document.fonts?.ready.then(schedule)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
    }
  }, [])
  return ref
}

/**
 * Phones and tablets: the whole resume as one column, in the same order as the PDF (every line of
 * every job), on the same sand paper as the desktop cards.
 */
export function ResumeDocument() {
  return (
    <div className="resume-doc">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-[3px] border-ink pb-4">
        <div>
          <h2 className="font-ddc text-[2em] leading-none tracking-[0.03em] uppercase">{resume.name}</h2>
          <p className="mt-1.5 font-ddc text-[0.95em] tracking-[0.06em] uppercase opacity-80">
            {resume.title} <span aria-hidden="true">·</span> {resume.tagline}
          </p>
        </div>
        <PdfButton />
      </header>
      <DocSection n={1} title="Summary">
        <p className="resume-summary">{resume.summary}</p>
      </DocSection>
      <DocSection n={2} title="Work experience">
        <WorkList />
      </DocSection>
      <DocSection n={3} title="Honors & awards">
        <HonorList />
      </DocSection>
      <DocSection n={4} title="Skills & interests">
        <SkillList />
      </DocSection>
      <DocSection n={5} title="Education">
        <EducationList />
      </DocSection>
    </div>
  )
}

function PdfButton() {
  return (
    <a href={pdf} download={pdfName} className="resume-pdf group">
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[0.8em] flex-none" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 0v8M2 4.5 6 8.5l4-4M1 11h10" />
      </svg>
      Resume PDF
    </a>
  )
}

const num = (n: number) => String(n).padStart(2, '0')

function Card({ area, n, title, children }: { area: string; n: number; title: string; children: ReactNode }) {
  const id = `resume-${area}`
  return (
    <section className="resume-card" style={{ gridArea: area }} aria-labelledby={id}>
      <h3 id={id} className="resume-card-head">
        <span className="resume-num">{num(n)}</span>
        {title}
      </h3>
      <div className="resume-card-body">{children}</div>
    </section>
  )
}

function DocSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first-of-type:mt-0">
      <h3 className="resume-card-head">
        <span className="resume-num">{num(n)}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Jobs, newest first. The current one (freelance) is set in reverse, ink on sand, with a NOW tag. */
function WorkList({ keyOnly = false }: { keyOnly?: boolean }) {
  return (
    <div className="resume-jobs">
      {resume.work.map((job) => (
        <JobEntry key={job.org} job={job} keyOnly={keyOnly} />
      ))}
    </div>
  )
}

function JobEntry({ job, keyOnly }: { job: Job; keyOnly: boolean }) {
  const pick = (b: { key?: boolean }) => !keyOnly || b.key
  const units = (job.units ?? []).map((u) => ({ ...u, bullets: u.bullets.filter(pick) }))
  return (
    <article className="resume-job" data-current={job.current || undefined}>
      <header className="resume-job-head">
        <div className="min-w-0">
          <h4 className="resume-job-org">
            {job.org}
            {job.kind && <span className="resume-job-kind">{job.kind}</span>}
            {job.current && <span className="resume-now">Now</span>}
          </h4>
          <p className="resume-job-title">
            {job.title}
            {job.location && <span className="opacity-75">, {job.location}</span>}
          </p>
        </div>
        <p className="resume-dates">{job.dates}</p>
      </header>
      <Bullets items={job.bullets.filter(pick)} />
      {units.map((u) => (
        <div key={u.org} className="resume-unit">
          <p className="resume-unit-head">
            <span>
              <strong className="font-semibold">{u.org}</strong>
              {u.location && <span className="opacity-75">, {u.location}</span>}
            </span>
            <span className="resume-dates">{u.dates}</span>
          </p>
          <Bullets items={u.bullets} />
        </div>
      ))}
    </article>
  )
}

function Bullets({ items }: { items: { text: string }[] }) {
  if (!items.length) return null
  return (
    <ul className="resume-bullets">
      {items.map((b) => (
        <li key={b.text}>{b.text}</li>
      ))}
    </ul>
  )
}

/** Each award with its (placeholder) icon and links to the public record. */
function HonorList({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="resume-honors">
      {resume.honors.map((h) => (
        <HonorEntry key={h.title} honor={h} compact={compact} />
      ))}
    </ul>
  )
}

function HonorEntry({ honor, compact }: { honor: Honor; compact: boolean }) {
  return (
    <li className="resume-honor">
      <AwardIcon className="resume-honor-icon" />
      <div className="min-w-0">
        <p className="resume-honor-title">{honor.title}</p>
        <p className="resume-honor-text">{compact ? honor.short : honor.text}</p>
        {honor.links.length > 0 && (
          <p className="resume-records">
            {honor.links.map((l) => (
              <a
                key={l.label + l.href}
                href={l.href}
                target="_blank"
                rel="noopener"
                aria-label={`${honor.title}: ${/^\d{4}$/.test(l.label) ? `${l.label} results` : l.label} (opens in a new tab)`}
                className="resume-record"
              >
                {l.label}
                <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[0.62em]" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 1h8v8M11 1 1 11" />
                </svg>
              </a>
            ))}
          </p>
        )}
      </div>
    </li>
  )
}

/** Skills as pills, by group. A skill with parts is a darker pill holding lighter, smaller ones. */
function SkillList() {
  return (
    <div className="resume-skills">
      {resume.skills.map((g) => (
        <div key={g.group} className="resume-skill-group">
          <h4 className="resume-skill-label">{g.group}</h4>
          <ul className="resume-pills" aria-label={g.group}>
            {g.items.map((item) => (
              <Pill key={typeof item === 'string' ? item : item.name} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Pill({ item }: { item: SkillItem }) {
  if (typeof item === 'string') return <li className="pill">{item}</li>
  return (
    <li className="pill pill-parent">
      <span className="pill-name">{item.name}</span>
      <ul className="contents" aria-label={`${item.name}:`}>
        {item.sub.map((s) => (
          <li key={s} className="pill pill-sub">
            {s}
          </li>
        ))}
      </ul>
    </li>
  )
}

/** Schools. On the board (compact) each one is two lines: the school, then what and when. */
function EducationList({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="resume-schools">
      {resume.education.map((s) => (
        <li key={s.school} className="resume-school">
          <p className="resume-school-name">{s.school}</p>
          {s.note && !compact && <p className="text-[0.85em] opacity-70">{s.note}</p>}
          <p>
            {s.credential}
            {compact && <span className="resume-dates">, {s.dates}</span>}
          </p>
          {!compact && <p className="resume-dates">{s.dates}</p>}
          {s.honor && <p className="mt-0.5 text-[0.9em] italic">{s.honor}</p>}
        </li>
      ))}
    </ul>
  )
}
