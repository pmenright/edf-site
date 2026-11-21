import { useEffect, useRef, useState } from 'react'

/**
 * COPY for a bit of text (the email address): copies it, and says "Copied" for two seconds.
 * `host` is where the fallback text field goes in older browsers (inside a modal popup, since
 * everything outside one is off limits while it's open); the page itself otherwise.
 */
export function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async (host?: HTMLElement | null) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Older browsers, or the clipboard blocked: copy through a temporary text field.
      const field = document.createElement('textarea')
      field.value = text
      field.setAttribute('readonly', '')
      field.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      ;(host ?? document.body).append(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }
  return { copied, copy }
}
