import type { ImgHTMLAttributes } from 'react'
import { getAsset, withBase } from '../content'

interface PictureProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  asset: string
  alt: string
  sizes: string
}

/** AVIF with WebP fallback, at several widths, from the optimized media set. */
export function Picture({ asset, alt, sizes, className, ...img }: PictureProps) {
  const a = getAsset(asset)
  return (
    <picture className="contents">
      {a.avif && <source type="image/avif" srcSet={withBase(a.avif)} sizes={sizes} />}
      <source type="image/webp" srcSet={withBase(a.webp)} sizes={sizes} />
      <img
        src={withBase(a.fallback)}
        width={a.width}
        height={a.height}
        alt={alt}
        decoding="async"
        className={className}
        {...img}
      />
    </picture>
  )
}
