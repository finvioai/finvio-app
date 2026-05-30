'use client'

import { useEffect, useRef } from 'react'

export function LaunchListWidget() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    // Delay script injection so React Strict Mode's synchronous
    // unmount/remount cycle cancels the timer before it fires.
    // Only the final mount's timer survives, so the script loads exactly once.
    const timer = setTimeout(() => {
      document.getElementById('launchlist-js')?.remove()

      const script = document.createElement('script')
      script.id = 'launchlist-js'
      script.src = 'https://getlaunchlist.com/js/widget.js'
      document.head.appendChild(script)
    }, 50)

    return () => {
      clearTimeout(timer)
      document.getElementById('launchlist-js')?.remove()
      container.innerHTML = ''
    }
  }, [])

  return <div ref={containerRef} className="launchlist-widget" data-key-id="o28D06" />
}
