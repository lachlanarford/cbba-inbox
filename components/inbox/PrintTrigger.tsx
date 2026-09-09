'use client'

import { useEffect } from 'react'

export default function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 450)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="print:hidden mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#604484] px-3 py-1.5 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        <PrinterIcon />
        Print
      </button>
      <p className="text-sm text-gray-600">
        The print dialog should open automatically. Close this tab when you are done.
      </p>
    </div>
  )
}

function PrinterIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}
