/**
 * PLACEHOLDER award icon, one color (it draws in the text color): a medal on a ribbon. Swap in the
 * real icon here once it's drawn; every award on the page uses this one component.
 */
export function AwardIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 40" className={className} fill="currentColor">
      {/* ribbon */}
      <path d="M8 0h7l3 9-5 6-5-6z M17 0h7l-3 9-3.5 4.2z" />
      {/* medal with a star cut out */}
      <path
        fillRule="evenodd"
        d="M16 12a14 14 0 1 1 0 28 14 14 0 0 1 0-28Zm0 6.2 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"
      />
    </svg>
  )
}
