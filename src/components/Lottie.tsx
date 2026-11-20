import { useEffect, useRef } from 'react'
import { useLottie } from '../hooks/useLottie'

/** A looping Lottie that only plays while it's on screen (used for the Nsyte thumbnail). */
export function LottieLoop({ path, className }: { path: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const anim = useLottie(ref, { path, loop: true, autoplay: false })

  useEffect(() => {
    if (!anim || !ref.current) return
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? anim.play() : anim.pause()))
    io.observe(ref.current)
    return () => io.disconnect()
  }, [anim])

  return <div ref={ref} className={className} aria-hidden="true" />
}
