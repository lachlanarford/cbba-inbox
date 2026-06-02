'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import type { AppUser } from '@/types/supabase'
import { isAdmin } from '@/lib/auth'
import SignOutButton from './SignOutButton'
import ChatModeToggle from './ChatModeToggle'

const CHANGELOG = [
  { date: '29 May', text: 'Email attachments viewable and downloadable' },
  { date: '29 May', text: 'Reply drafts auto-saved per conversation' },
  { date: '29 May', text: 'Email signature now shown in conversation thread' },
  { date: '28 May', text: 'Mark as unread syncs back to Gmail' },
  { date: '28 May', text: 'Collapsible filter panel with active filter count' },
  { date: '28 May', text: 'Gmail account shown in conversation header' },
  { date: '28 May', text: 'Default department per Gmail inbox in settings' },
]

interface SidebarProps {
  user: AppUser
  chatMode: string
  logoUrl?: string | null
}

const navItems = [
  { label: 'Inbox',        href: '/inbox',              icon: InboxIcon,     adminOnly: false },
  { label: 'Contacts',     href: '/contacts',           icon: ContactsIcon,  adminOnly: false },
  { label: 'Knowledge',    href: '/settings/knowledge', icon: KnowledgeIcon, adminOnly: true  },
  { label: 'Templates',    href: '/settings/canned',    icon: CannedIcon,    adminOnly: true  },
  { label: 'Report Issue', href: '/settings/bugs',      icon: BugIcon,       adminOnly: false },
  { label: 'Reports',      href: '/reports',            icon: ReportsIcon,   adminOnly: false },
  { label: 'Channels',     href: '/settings/channels',  icon: ChannelsIcon,  adminOnly: true  },
  { label: 'Admin',        href: '/settings/admin',     icon: AdminIcon,     adminOnly: true  },
  { label: 'Branding',     href: '/settings/branding',  icon: BrandingIcon,  adminOnly: true  },
  { label: 'Settings',     href: '/settings',           icon: SettingsIcon,  adminOnly: false },
]

export default function Sidebar({ user, chatMode, logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const [changelogOpen, setChangelogOpen] = useState(false)
  const changelogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!changelogOpen) return
    function handleClick(e: MouseEvent) {
      if (changelogRef.current && !changelogRef.current.contains(e.target as Node)) {
        setChangelogOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [changelogOpen])

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
      <div className="px-5 py-5 border-b border-white/5">
        <Link href="/inbox" className="flex items-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-8 w-auto max-w-[160px] object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-cbba-gold font-bold text-xl tracking-tight">CBBA</span>
              <span className="text-white/60 font-light text-sm tracking-widest uppercase">Inbox</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems
          .filter(({ adminOnly }) => !adminOnly || isAdmin(user))
          .map(({ label, href, icon: Icon }) => (
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
      </nav>

      {/* What's new */}
      <div ref={changelogRef} className="px-3 pb-2 border-t border-white/5 pt-3 relative">
        <button
          onClick={() => setChangelogOpen((v) => !v)}
          className={`flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-xs transition-colors ${
            changelogOpen ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cbba-purple flex-shrink-0" />
          What&apos;s new
        </button>

        {changelogOpen && (
          <div className="absolute bottom-0 left-full ml-2 z-50 w-72 bg-cbba-navy border border-white/10 rounded-xl shadow-2xl flex flex-col" style={{ maxHeight: 360 }}>
            <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
              <p className="text-xs font-semibold text-white">What&apos;s new</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Recent updates to CBBA Inbox</p>
            </div>
            <ul className="overflow-y-auto flex-1 py-2 px-1">
              {CHANGELOG.map((entry, i) => (
                <li key={i} className="flex gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                  <span className="flex-shrink-0 text-[11px] text-gray-600 mt-0.5 w-12">{entry.date}</span>
                  <span className="text-[12px] text-gray-300 leading-snug">{entry.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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

function CannedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )
}

function BrandingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  )
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0V7.5m0-5.25a3 3 0 00-2.944 2.416.75.75 0 001.472.288A1.5 1.5 0 0112 3.75a1.5 1.5 0 011.472 1.204.75.75 0 001.472-.288A3 3 0 0012 2.25zm-5.625 9.75H4.5m15 0h-1.875M4.5 9.75l-.952-.952m16.904.952-.952-.952M9 17.25H7.5m9 0H15" />
    </svg>
  )
}
