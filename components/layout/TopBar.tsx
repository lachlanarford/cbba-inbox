'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/inbox': 'Inbox',
  '/contacts': 'Contacts',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/settings/admin': 'Admin Settings',
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  for (const [prefix, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(`${prefix}/`)) return title
  }
  return 'CBBA Inbox'
}

export default function TopBar() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-cbba-navy flex-shrink-0">
      <h1 className="text-base font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          aria-label="Notifications"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors duration-150"
        >
          <BellIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}
