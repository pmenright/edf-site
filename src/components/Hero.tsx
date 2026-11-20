import heroLockup from '../assets/brand/hero-lockup.svg'

interface HeroProps {
  /** Desktop only: scroll hint at the right edge. */
  onScrollHint?: () => void
  className?: string
}

/** Full-screen lockup: "Enright Design Foundry, Hand Made, Austin Based, Veteran Owned". */
export function Hero({ onScrollHint, className = '' }: HeroProps) {
  return (
    <section
      className={`relative flex flex-none items-center justify-center px-[5%] pt-12 pb-5 short:pt-10 short:pb-3 strip:p-0 ${className}`}
    >
      <h1 className="sr-only">Enright Design Foundry: graphic design and videography. Austin based, veteran owned.</h1>
      <img
        src={heroLockup}
        alt=""
        fetchPriority="high"
        className="h-full w-full max-w-[1000px] object-contain strip:h-auto strip:w-[60%] strip:max-w-none"
      />
      {onScrollHint && (
        // The button is a larger, invisible hit area (62 x 74) around the 20 x 50 pill; the pill and arrow sit where they always did.
        <button
          type="button"
          onClick={onScrollHint}
          aria-label="Scroll to the work"
          className="absolute top-1/2 right-[20px] -translate-y-1/2 cursor-pointer rounded-[8px] py-3 pr-[30px] pl-3 outline-offset-0 focus-visible:outline-2 focus-visible:outline-sand"
        >
          <span className="relative flex h-[50px] w-5 flex-col items-start justify-start rounded-[20px] bg-sand">
            <span className="scroll-ball mt-0.5 ml-0.5 block size-4 rounded-[20px] bg-ink" />
            <span className="scroll-arrow absolute top-[10px] left-[30px] h-0 w-0 border-y-[15px] border-l-[15px] border-y-transparent border-l-sand" />
          </span>
        </button>
      )}
    </section>
  )
}
