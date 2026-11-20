import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/**
 * Sand "LOADING" screen, as on the Webflow site: the word fades in after 1s,
 * and half a second after the page finishes loading the panel slides off left.
 */
export function Preloader() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading')

  useEffect(() => {
    let timer: number | undefined
    const done = () => {
      timer = window.setTimeout(() => setPhase('leaving'), 500)
    }
    if (document.readyState === 'complete') done()
    else window.addEventListener('load', done, { once: true })
    return () => {
      window.removeEventListener('load', done)
      window.clearTimeout(timer)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-[42069] flex items-center justify-center bg-sand"
      initial={false}
      animate={phase === 'leaving' ? (reduce ? { opacity: 0 } : { x: '-100vw' }) : { x: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      onAnimationComplete={() => phase === 'leaving' && setPhase('gone')}
    >
      <motion.div
        className="font-ddc text-[72px] leading-5 text-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5, ease: 'easeInOut' }}
      >
        LOADING
      </motion.div>
    </motion.div>
  )
}
