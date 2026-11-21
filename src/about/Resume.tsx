import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { projectById, site, withBase } from '../content'
import { useCopy } from '../lib/copy'
import { openResume } from '../lib/resume'
import { showProject } from '../lib/viewer'
import { AwardIcon } from './AwardIcon'
import { resume, type Honor, type Job, type SkillItem } from './content'

const pdf = withBase(site.resumeFile)
const pdfName = site.resumeFile.split('/').pop()

/**
 * Desktop: the resume as one sand sheet on the ink page (Jim's mockup), split into sections by ink
 * rules: summary and work experience on the left, honors, skills and education on the right. Work
 * experience has a tab per job, freelance first (its tab is ink, to mark it as the current job).
 * Everything on the PDF is here. Colors come only from Jim's palette (index.css, --color-pal-*).
 */
export function ResumeBoard() {
  const board = useFitText()
  return (
    <div ref={board} className="resume-board">
      <header className="resume-board-head">
        <h2 className="font-ddc text-[1.9em] leading-none tracking-[0.04em] uppercase">Resume</h2>
        <p className="min-w-0 truncate font-text text-[1.05em] font-medium tracking-[0.1em] text-pal-khaki uppercase">
          {resume.name} <span aria-hidden="true">·</span> {resume.title} <span aria-hidden="true">·</span> {resume.tagline}
        </p>
        <PdfButton />
      </header>
      <div className="resume-sheet">
        <Card area="sum" title="Summary">
          <p className="resume-summary">{resume.summary}</p>
        </Card>
        <Card area="work" title="Work experience">
          <WorkTabs />
        </Card>
        <Card area="hon" title="Honors & awards">
          <HonorList columns />
        </Card>
        <Card area="skl" title="Skills & interests">
          <SkillList />
        </Card>
        <Card area="edu" title="Education">
          <EducationList />
        </Card>
      </div>
    </div>
  )
}

/** Text sizes on the board run from here (smallest that's still comfortable) to there. */
const FIT_MIN = 12
const FIT_MAX = 18
/** Text size when the board can't fit one screen and scrolls instead. */
const FLOW_SIZE = 13.5

/**
 * Sizes the board's text to the screen: the largest size (between FIT_MIN and FIT_MAX px, and no more
 * than 1.75% of the screen height) at which every section's contents fit without scrolling. Everything
 * on the board is in ems, so the whole layout scales together. Rechecked when the window resizes.
 * On screens too short for that (most laptops, now that the board has everything), it flows
 * (data-flow): same layout at FLOW_SIZE, as tall as it needs, and the resume slide scrolls down.
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
      const max = Math.max(FIT_MIN, Math.min(FIT_MAX, window.innerHeight * 0.0175))
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
    /** After every fit: things sized to the text (the skill pills that wrap, below) size themselves again. */
    const fitAndTell = () => {
      fit()
      el.dispatchEvent(new Event('resume-fit'))
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fitAndTell)
    }
    fitAndTell()
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
 * Phones and tablets: the whole resume as one column, in the same order as the PDF, on sand. Work
 * experience has the same tabs as on desktop.
 */
export function ResumeDocument() {
  return (
    <div className="resume-doc">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-[3px] border-ink pb-4">
        <div>
          <h2 className="font-ddc text-[2em] leading-none tracking-[0.03em] uppercase">{resume.name}</h2>
          <p className="mt-1.5 font-text text-[0.9em] font-medium tracking-[0.1em] text-pal-char uppercase">
            {resume.title} <span aria-hidden="true">·</span> {resume.tagline}
          </p>
        </div>
        <PdfButton />
      </header>
      <DocSection title="Summary">
        <p className="resume-summary">{resume.summary}</p>
      </DocSection>
      <DocSection title="Work experience">
        <WorkTabs reserve={false} />
      </DocSection>
      <DocSection title="Honors & awards">
        <HonorList />
      </DocSection>
      <DocSection title="Skills & interests">
        <SkillList />
      </DocSection>
      <DocSection title="Education">
        <EducationList />
      </DocSection>
    </div>
  )
}

/** RESUME PDF: opens the "Download my resume" popup (ResumeDialog.tsx), like the typeface's download. */
function PdfButton() {
  return (
    <a
      href={pdf}
      download={pdfName}
      aria-haspopup="dialog"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        openResume()
      }}
      className="resume-pdf group"
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[0.8em] flex-none" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 0v8M2 4.5 6 8.5l4-4M1 11h10" />
      </svg>
      Resume PDF
    </a>
  )
}

function Card({ area, title, children }: { area: string; title: string; children: ReactNode }) {
  const id = `resume-${area}`
  return (
    <section className="resume-card" style={{ gridArea: area }} aria-labelledby={id}>
      <h3 id={id} className="resume-card-head">
        {title}
      </h3>
      <div className="resume-card-body">{children}</div>
    </section>
  )
}

function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first-of-type:mt-0">
      <h3 className="resume-card-head">{title}</h3>
      <div>{children}</div>
    </section>
  )
}

/**
 * Work experience: a tab per job, in resume.json's order. Freelance's tab is ink (the current job).
 * The open tab sits down on the rule over the job, joined to it like a folder tab; the others float
 * just above it. On the desktop board (`reserve`) every job's panel stays in the layout (only the
 * open one shows), so the section is always as tall as the longest job and nothing jumps when
 * switching; on phones only the open job takes up room.
 * Keyboard: arrow keys (and Home / End) move between tabs.
 */
function WorkTabs({ reserve = true }: { reserve?: boolean }) {
  const [open, setOpen] = useState(0)
  const id = useId()
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = resume.work.length - 1
    const to =
      e.key === 'ArrowRight' ? (open === last ? 0 : open + 1)
      : e.key === 'ArrowLeft' ? (open === 0 ? last : open - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (to === null) return
    e.preventDefault()
    e.stopPropagation() // not a page turn (AboutLayer listens for arrow keys)
    setOpen(to)
    tabs.current[to]?.focus()
  }
  return (
    <div className="job-tabs-box" data-reserve={reserve || undefined}>
      <div role="tablist" aria-label="Jobs" className="job-tabs" onKeyDown={onKeyDown}>
        {resume.work.map((job, i) => (
          <button
            key={job.org}
            ref={(el) => {
              tabs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={open === i}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={open === i ? 0 : -1}
            data-current={job.current || undefined}
            onClick={() => setOpen(i)}
            className="job-tab"
          >
            <span className="job-tab-name">{job.tab}</span>
            <span className="job-tab-years">{job.years}</span>
          </button>
        ))}
      </div>
      <div className="job-panels">
        {resume.work.map((job, i) => (
          <div
            key={job.org}
            role="tabpanel"
            id={`${id}-panel-${i}`}
            aria-labelledby={`${id}-tab-${i}`}
            data-open={open === i || undefined}
            inert={open !== i}
            hidden={!reserve && open !== i}
            className="job-panel"
          >
            <JobEntry job={job} />
          </div>
        ))}
      </div>
    </div>
  )
}

function JobEntry({ job }: { job: Job }) {
  return (
    <article className="resume-job">
      <header className="resume-job-head">
        <div className="min-w-0">
          <h4 className="resume-job-org">
            {job.org}
            {job.kind && <span className="resume-job-kind">{job.kind}</span>}
          </h4>
          <p className="resume-job-title">
            {job.title}
            {job.location && <span className="resume-quiet">, {job.location}</span>}
          </p>
        </div>
        <p className="resume-dates">{job.dates}</p>
      </header>
      <Bullets items={job.bullets} />
      {job.banner && <ClientBanner title={job.banner.title} text={job.banner.text} />}
      {(job.units ?? []).map((u) => (
        <div key={u.org} className="resume-unit">
          <p className="resume-unit-head">
            <span>
              <strong className="font-semibold">{u.org}</strong>
              {u.location && <span className="resume-quiet">, {u.location}</span>}
            </span>
            <span className="resume-dates">{u.dates}</span>
          </p>
          <Bullets items={u.bullets} />
        </div>
      ))}
    </article>
  )
}

const mail = `mailto:${site.email}`

/**
 * The freelance tab's ink banner (Jim's mockup): OPEN FOR NEW CLIENTS!, a line, then the email
 * address (a mail link), COPY and EMAIL, like the contact popup.
 */
function ClientBanner({ title, text }: { title: string; text: string }) {
  const { copied, copy } = useCopy(site.email)
  const id = useId()
  return (
    <aside className="resume-banner" aria-labelledby={id}>
      <h5 id={id} className="resume-banner-title">
        {title}
      </h5>
      <p className="resume-banner-text">{text}</p>
      <div className="resume-banner-actions">
        <a href={mail} className="resume-banner-email">
          {site.email}
        </a>
        <div className="flex gap-[0.7em]">
          <button type="button" onClick={() => copy()} aria-label="Copy email address" className="resume-banner-button">
            {/* Both words in the same spot, so the button keeps its width when the label changes. */}
            <span className="grid">
              <span className={`col-start-1 row-start-1 ${copied ? 'invisible' : ''}`}>Copy</span>
              <span className={`col-start-1 row-start-1 ${copied ? '' : 'invisible'}`} aria-hidden="true">
                Copied
              </span>
            </span>
          </button>
          <a href={mail} aria-label={`Email ${site.email}`} className="resume-banner-button" data-filled="">
            <span>Email</span>
          </a>
        </div>
      </div>
      <p role="status" className="sr-only">
        {copied ? 'Email address copied' : ''}
      </p>
    </aside>
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

/**
 * Each award with Jim's award icon and links to the public record. On the board (`columns`) they sit
 * in two columns, each award in the column its `column` names; on phones, one list in order.
 */
function HonorList({ columns = false }: { columns?: boolean }) {
  const list = (honors: Honor[]) => (
    <ul className="resume-honors">
      {honors.map((h) => (
        <HonorEntry key={h.title} honor={h} />
      ))}
    </ul>
  )
  if (!columns) return list(resume.honors)
  return (
    <div className="resume-honor-cols">
      {list(resume.honors.filter((h) => (h.column ?? 1) === 1))}
      {list(resume.honors.filter((h) => h.column === 2))}
    </div>
  )
}

function HonorEntry({ honor }: { honor: Honor }) {
  return (
    <li className="resume-honor">
      <AwardIcon className="resume-honor-icon" />
      <div className="min-w-0">
        <p className="resume-honor-title">{honor.title}</p>
        <p className="resume-honor-text">{honor.text}</p>
        {honor.links.length > 0 && (
          <p className="resume-records">
            {honor.links.map((l) => {
              // WATCH: the piece itself, in the lightbox (a plain click; others open the link).
              const piece = l.project ? projectById(l.project) : undefined
              return (
              <a
                key={l.label + l.href}
                href={l.href}
                target="_blank"
                rel="noopener"
                onClick={(e) => {
                  if (!piece || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                  e.preventDefault()
                  showProject(piece)
                }}
                aria-label={
                  piece
                    ? `${l.label}: ${piece.title}`
                    : `${honor.title}: ${/^\d{4}$/.test(l.label) ? `${l.label} results` : l.label} (opens in a new tab)`
                }
                aria-haspopup={piece ? 'dialog' : undefined}
                className="resume-record"
              >
                {l.label}
                {piece ? (
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[0.62em]" fill="currentColor">
                    <path d="M2 0.8v10.4L11 6z" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[0.62em]" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 1h8v8M11 1 1 11" />
                  </svg>
                )}
              </a>
              )
            })}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Skills as pills, by group. A skill with parts is a darker pill holding lighter, smaller ones, in
 * the same gap above, below and to their right. When the parts run onto more lines, the pill is sized
 * to the longest line, so that gap holds on the right too (a box can't shrink to wrapped contents
 * on its own; this measures them, after every resize and every fit of the board's text).
 */
function SkillList() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let frame = 0
    const hug = () => {
      for (const pill of root.querySelectorAll<HTMLElement>('.pill-parent')) {
        pill.style.width = ''
        const parts = [...pill.querySelectorAll<HTMLElement>('.pill-sub')]
        if (parts.length < 2 || parts[parts.length - 1].offsetTop === parts[0].offsetTop) continue
        const box = pill.getBoundingClientRect()
        const right = Math.max(...parts.map((p) => p.getBoundingClientRect().right))
        const style = getComputedStyle(pill)
        // In ems, so it scales with the board's text as that's refitted.
        pill.style.width = `${(right - box.left + parseFloat(style.paddingRight) + 0.5) / parseFloat(style.fontSize)}em`
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(hug)
    }
    hug()
    void document.fonts?.ready.then(schedule)
    const board = root.closest('.resume-board')
    board?.addEventListener('resume-fit', hug)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      board?.removeEventListener('resume-fit', hug)
      window.removeEventListener('resize', schedule)
    }
  }, [])
  return (
    <div ref={ref} className="resume-skills">
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
      <ul className="pill-subs" aria-label={`${item.name}:`}>
        {item.sub.map((s) => (
          <li key={s} className="pill pill-sub">
            {s}
          </li>
        ))}
      </ul>
    </li>
  )
}

/** Schools: name, any note (former name, location), what, when, and any honor. */
function EducationList() {
  return (
    <ul className="resume-schools">
      {resume.education.map((s) => (
        <li key={s.school} className="resume-school">
          <p className="resume-school-name">{s.school}</p>
          {s.note && <p className="resume-quiet text-[0.88em]">{s.note}</p>}
          <p className="mt-0.5">
            {s.credential}
            <span className="resume-dates">, {s.dates}</span>
          </p>
          {s.honor && <p className="mt-0.5 italic">{s.honor}</p>}
        </li>
      ))}
    </ul>
  )
}
