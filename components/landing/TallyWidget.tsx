'use client'

import { useEffect } from 'react'

export function TallyWidget() {
  useEffect(() => {
    const scriptId = 'tally-js'
    const src = 'https://tally.so/widgets/embed.js'

    const loadEmbeds = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tally = (window as any).Tally
      if (typeof tally !== 'undefined') {
        tally.loadEmbeds()
      } else {
        document
          .querySelectorAll<HTMLIFrameElement>('iframe[data-tally-src]:not([src])')
          .forEach(el => {
            el.src = el.dataset.tallySrc ?? ''
          })
      }
    }

    if (document.getElementById(scriptId)) {
      loadEmbeds()
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = src
    script.onload = loadEmbeds
    script.onerror = loadEmbeds
    document.body.appendChild(script)
  }, [])

  return (
    <iframe
      data-tally-src="https://tally.so/embed/J9M8kJ?hideTitle=1&transparentBackground=1"
      loading="lazy"
      width="100%"
      height="380"
      frameBorder={0}
      marginHeight={0}
      marginWidth={0}
      style={{ overflow: 'hidden', display: 'block' }}
      title="Join the Finvio Waitlist"
    />
  )
}
