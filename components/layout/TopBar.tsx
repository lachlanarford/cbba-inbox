'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from './NotificationBell'

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

export default function TopBar({ userId }: { userId: string }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="h-14 flex items-center justify-between px-3 md:px-6 border-b border-white/5 bg-cbba-navy flex-shrink-0">
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationBell userId={userId} />
      </div>
    </header>
  )
}
