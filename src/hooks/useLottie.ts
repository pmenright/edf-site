import { useEffect, useState, type RefObject } from 'react'
import type { AnimationItem } from 'lottie-web'
import { withBase } from '../content'

type LottieModule = typeof import('lottie-web/build/player/lottie_light')['default']
let lottiePromise: Promise<LottieModule> | undefined

/** lottie-web's SVG-only "light" build, loaded on demand so it never blocks first paint. */
function loadLottie() {
  lottiePromise ??= import('lottie-web/build/player/lottie_light').then((m) => m.default)
  return lottiePromise
}

interface Options {
  path: string
  loop?: boolean
  autoplay?: boolean
}

/** Mounts a Lottie animation into a container element and returns it once loaded. */
export function useLottie(container: RefObject<HTMLElement | null>, { path, loop = false, autoplay = false }: Options) {
  const [anim, setAnim] = useState<AnimationItem | null>(null)

  useEffect(() => {
    let item: AnimationItem | undefined
    let cancelled = false
    loadLottie().then((lottie) => {
      if (cancelled || !container.current) return
      item = lottie.loadAnimation({
        container: container.current,
        renderer: 'svg',
        loop,
        autoplay,
        path: withBase(path),
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      })
      item.addEventListener('DOMLoaded', () => !cancelled && setAnim(item!))
    })
    return () => {
      cancelled = true
      item?.destroy()
      setAnim(null)
    }
  }, [container, path, loop, autoplay])

  return anim
}
