'use client'

import { useRef } from 'react'

interface Props {
  html: string
}

const WRAPPER = `
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #111827;
      background: #f8f9fa;
      word-break: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #604484; }
    blockquote {
      margin: 8px 0;
      padding: 4px 12px;
      border-left: 3px solid #e5e7eb;
      color: #6b7280;
    }
    pre, code { font-size: 13px; }
    table { max-width: 100%; }
  </style>
`

export default function HtmlEmailViewer({ html }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function onLoad() {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument?.body) return
    const height = iframe.contentDocument.documentElement.scrollHeight
    iframe.style.height = `${Math.min(height, 800)}px`
  }

  const wrapped = html.includes('<html') || html.includes('<!DOCTYPE')
    ? html
    : `<!DOCTYPE html><html><head>${WRAPPER}</head><body>${html}</body></html>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrapped}
      sandbox="allow-same-origin"
      onLoad={onLoad}
      className="w-full border-0 block"
      style={{ minHeight: 80, height: 120 }}
      title="Email content"
    />
  )
}
