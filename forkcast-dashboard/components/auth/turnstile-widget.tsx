"use client"

// components/auth/turnstile-widget.tsx
//
// Thin wrapper around the Cloudflare Turnstile JS API. Renders nothing if
// `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset (so dev/preview environments
// without a key just skip the widget). The login page is responsible for
// blocking submission until `onToken` has fired with a non-null value
// when CAPTCHA is required.

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          appearance?: 'always' | 'interaction-only' | 'execute'
        }
      ) => string | undefined
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback'

export interface TurnstileWidgetProps {
  siteKey: string | null
  onToken: (token: string | null) => void
  className?: string
}

export function TurnstileWidget({ siteKey, onToken, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined') return

    const render = () => {
      if (!containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
        appearance: 'always',
      })
      widgetIdRef.current = id ?? null
    }

    if (!document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`)) {
      window.onloadTurnstileCallback = render
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    } else if (window.turnstile) {
      render()
    } else {
      window.onloadTurnstileCallback = render
    }

    return () => {
      const id = widgetIdRef.current
      if (id && window.turnstile) {
        try { window.turnstile.remove(id) } catch { /* noop */ }
      }
      widgetIdRef.current = null
    }
  }, [siteKey, onToken])

  if (!siteKey) return null
  return <div ref={containerRef} className={className} />
}
