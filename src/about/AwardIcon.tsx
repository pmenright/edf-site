import award from '../assets/about/award.svg'

/**
 * Jim's award icon (src/assets/about/award.svg, used exactly as drawn: ink #1d262c). Every award on
 * the resume uses this one component. Decorative: the award's title says what it is.
 */
export function AwardIcon({ className = '' }: { className?: string }) {
  return <img src={award} alt="" aria-hidden="true" draggable={false} className={className} />
}
