'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AppUser } from '@/types/supabase'
import { isAdmin } from '@/lib/auth'
import SignOutButton from './SignOutButton'
import ChatModeToggle from './ChatModeToggle'

interface SidebarProps {
  user: AppUser
  chatMode: string
}

const navItems = [
  {
    label: 'Inbox',
    href: '/inbox',
    icon: InboxIcon,
  },
  {
    label: 'Contacts',
    href: '/contacts',
    icon: ContactsIcon,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: ReportsIcon,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
  },
]

export default function Sidebar({ user, chatMode }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/inbox') return pathname === '/inbox' || pathname.startsWith('/inbox/')
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email.slice(0, 2).toUpperCase()

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-cbba-navy-dark border-r border-white/5 h-screen">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/5">
        <Link href="/inbox" className="flex items-center gap-2">
          <span className="text-cbba-gold font-bold text-xl tracking-tight">CBBA</span>
          <span className="text-white/60 font-light text-sm tracking-widest uppercase">Inbox</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
              isActive(href)
                ? 'bg-cbba-purple text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon
              className={`w-4 h-4 flex-shrink-0 ${
                isActive(href) ? 'text-cbba-gold' : 'text-current'
              }`}
            />
            {label}
          </Link>
        ))}

        {isAdmin(user) && (
          <>
            <Link
              href="/settings/channels"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                pathname === '/settings/channels'
                  ? 'bg-cbba-purple text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ChannelsIcon
                className={`w-4 h-4 flex-shrink-0 ${
                  pathname === '/settings/channels' ? 'text-cbba-gold' : 'text-current'
                }`}
              />
              Channels
            </Link>
            <Link
              href="/settings/knowledge"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                pathname === '/settings/knowledge'
                  ? 'bg-cbba-purple text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <KnowledgeIcon
                className={`w-4 h-4 flex-shrink-0 ${
                  pathname === '/settings/knowledge' ? 'text-cbba-gold' : 'text-current'
                }`}
              />
              Knowledge
            </Link>
            <Link
              href="/settings/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                pathname === '/settings/admin'
                  ? 'bg-cbba-purple text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <AdminIcon
                className={`w-4 h-4 flex-shrink-0 ${
                  pathname === '/settings/admin' ? 'text-cbba-gold' : 'text-current'
                }`}
              />
              Admin
            </Link>
          </>
        )}
      </nav>

      {/* Chat mode toggle */}
      <div className="px-3 pb-2 border-t border-white/5 pt-3">
        <p className="text-xs text-gray-600 px-3 mb-1">Chat widget</p>
        <ChatModeToggle initialMode={chatMode} />
      </div>

      {/* User area */}
      <div className="px-4 py-4 border-t border-white/5 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt={user.full_name ?? user.email}
              className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full flex-shrink-0 bg-cbba-purple flex items-center justify-center text-xs font-semibold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {user.full_name ?? user.email}
            </p>
            <p className="text-xs text-gray-500 truncate capitalize">{user.role}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  )
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  )
}

function ContactsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChannelsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
    </svg>
  )
}

function KnowledgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}
