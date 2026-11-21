import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { AboutIntro } from './AboutIntro'
import { ResumeBoard, ResumeDocument } from './Resume'

/** 0 = About, 1 = Resume. */
export type AboutSlide = 0 | 1

/** How long About / the resume take to slide in over the work, or back out (seconds). */
export const ABOUT_SLIDE_DURATION = 0.35
const SLIDE_EASE = [0.65, 0, 0.35, 1] as const
/**
 * Desktop: DESIGN / VIDEO from About or the resume push it out the way they push each other (the
 * same timing as DESIGN <-> VIDEO in DesktopGallery.tsx): DESIGN drops in from above and pushes it
 * down, VIDEO rises from below and pushes it up.
 */
export const PUSH_DURATION = 0.25

interface RowProps {
  open: boolean
  /** One slide's width: the screen right of the docked rail. */
  slideW: number
  /** DesktopGallery's nudge, so it holds still on screen when the page scroll jumps as sides switch. */
  shift: MotionValue<number>
  /** Slide in from the right when it appears (not when the page opens straight onto it). */
  appear: boolean
  /** Which way it leaves when it closes: pushed down by DESIGN coming in from above, or up by VIDEO from below. */
  exit: 'up' | 'down'
  rowRef: (el: HTMLDivElement | null) => void
  /** The scroll hint on About: on to the resume. */
  onNext: () => void
}

/**
 * Desktop: About and the resume, side by side, as the strip's third side (DesktopGallery.tsx). RESUME
 * slides them in from the right; DESIGN or VIDEO pushes them out the way those two push each other
 * (DESIGN in from above, pushing them down; VIDEO in from below, pushing them up; see PUSH_DURATION). The page scrolls through them like the work: down or right on to the
 * resume, and back up past About to the nav column and the hero. The rail docks beside them.
 * A strip of ink runs under the rail on their left, so nothing shows through at its edge.
 */
export function AboutRow({ open, slideW, shift, appear, exit, rowRef, onNext }: RowProps) {
  const reduce = useReducedMotion()
  const enter = useMotionValue(open && !appear ? 0 : slideW)
  /** The push out, up or down. */
  const drop = useMotionValue(0)
  const x = useTransform(() => shift.get() + enter.get())
  const width = useRef(slideW)
  const leave = useRef(exit)
  useLayoutEffect(() => {
    width.current = slideW
    leave.current = exit
  })
  useLayoutEffect(() => {
    if (open) {
      // Reopened while it was still being pushed out: come back in from the right as usual.
      if (drop.get() !== 0) {
        drop.set(0)
        enter.set(width.current)
      }
      const a = animate(enter, 0, { duration: reduce ? 0 : ABOUT_SLIDE_DURATION, ease: SLIDE_EASE })
      return () => a.stop()
    }
    const h = window.innerHeight
    const a = animate(drop, leave.current === 'up' ? -h : h, { duration: reduce ? 0 : PUSH_DURATION, ease: 'easeInOut' })
    return () => a.stop()
  }, [open, enter, drop, reduce])
  return (
    <motion.div
      ref={rowRef}
      data-about-layer=""
      role="region"
      aria-label="About and resume"
      inert={!open}
      style={{ x, y: drop, width: 2 * slideW }}
      className="about-layer absolute top-0 left-0 z-[5] flex h-screen bg-ink before:absolute before:inset-y-0 before:right-full before:w-24 before:bg-ink"
    >
      <section data-slide="0" aria-label="About" className="relative h-screen flex-none" style={{ width: slideW }}>
        <AboutIntro />
        {/* The scroll hint from the portfolio's hero: on to the resume. */}
        <button
          type="button"
          onClick={onNext}
          aria-label="Next: resume"
          className="absolute top-1/2 right-[20px] z-10 -translate-y-1/2 cursor-pointer rounded-[8px] py-3 pr-[30px] pl-3 outline-offset-0 focus-visible:outline-2 focus-visible:outline-sand"
        >
          <span className="relative flex h-[50px] w-5 flex-col items-start justify-start rounded-[20px] bg-sand">
            <span className="scroll-ball mt-0.5 ml-0.5 block size-4 rounded-[20px] bg-ink" />
            <span className="scroll-arrow absolute top-[10px] left-[30px] h-0 w-0 border-y-[15px] border-l-[15px] border-y-transparent border-l-sand" />
          </span>
        </button>
      </section>
      <section data-slide="1" aria-label="Resume" className="h-screen flex-none" style={{ width: slideW }}>
        <ResumeBoard />
      </section>
    </motion.div>
  )
}

/**
 * Phones, upright screens, and windows not wide enough for the strip: About, then the whole resume,
 * down the page. Windows lying on their side with room for it (small laptops, squarish windows) keep
 * the desktop About composition in a screen-tall section; phones and upright screens get the portrait,
 * then the letter.
 */
export function AboutStack() {
  const roomy = useMediaQuery('(orientation: landscape) and (min-width: 768px) and (min-height: 540px)')
  return (
    <div>
      {roomy ? (
        <section aria-label="About" className="about-frame">
          <AboutIntro />
        </section>
      ) : (
        // No top padding: the portrait's own space above the head is the gap (under the pinned hero,
        // and under the DESIGN / VIDEO row).
        <section aria-label="About" className="px-[6%] pb-12">
          <AboutIntro stacked />
        </section>
      )}
      <section data-about-resume="" aria-label="Resume" className="about-resume bg-sand pt-10 pb-14 text-ink">
        <ResumeDocument />
      </section>
    </div>
  )
}
