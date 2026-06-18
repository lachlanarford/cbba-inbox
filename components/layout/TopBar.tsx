'use client'

import Link from 'next/link'
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

interface TopBarProps {
  userId: string
  logoUrl?: string | null
}

export default function TopBar({ userId, logoUrl }: TopBarProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="h-14 flex items-center justify-between px-3 md:px-6 border-b border-white/5 bg-cbba-navy flex-shrink-0">
      {/* Mobile: logo; Desktop: page title */}
      <div className="md:hidden">
        <Link href="/inbox" className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-7 w-auto max-w-[110px] object-contain" />
          ) : (
            <>
              <span className="text-cbba-gold font-bold text-lg tracking-tight">CBBA</span>
              <span className="text-white/50 font-light text-xs tracking-widest uppercase">Inbox</span>
            </>
          )}
        </Link>
      </div>
      <h1 className="hidden md:block text-base font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        <NotificationBell userId={userId} />
      </div>
    </header>
  )
}
