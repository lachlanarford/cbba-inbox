export default function ChangelogPage() {
  return (
    <div className="max-w-2xl mx-auto py-2 space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">What&apos;s new</h1>
        <p className="text-xs text-gray-500 mt-0.5">Recent updates to CBBA Inbox</p>
      </div>

      {CHANGELOG.map((section, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{section.date}</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="bg-cbba-navy-light border border-white/5 rounded-xl divide-y divide-white/5">
            {section.items.map((item, j) => (
              <div key={j} className="px-5 py-4 flex gap-4">
                <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const CHANGELOG = [
  {
    date: '18–19 Jun 2026',
    items: [
      {
        icon: '📱',
        title: 'Mobile-friendly layout',
        description: 'The app now works on phones. A bottom navigation bar replaces the sidebar. In the inbox, tapping a conversation opens it full screen with a back button to return to the list.',
      },
      {
        icon: '✉️',
        title: 'Email contacts directly',
        description: 'Each contact row in the Contacts page now has a mail icon. Click it to compose and send a new email straight from the contacts list. The email is tracked as a conversation in your inbox.',
      },
      {
        icon: '📋',
        title: 'Email entire contact lists',
        description: 'In a contact list, an "Email all" button lets you compose one message to every member. Recipients are added as BCC so they don\'t see each other\'s addresses.',
      },
      {
        icon: '📊',
        title: 'Reports page on mobile',
        description: 'Report cards now stack into a single column on small screens instead of overflowing off the edge.',
      },
    ],
  },
  {
    date: '17 Jun 2026',
    items: [
      {
        icon: '💬',
        title: 'Per-staff live chat with auto turn-off',
        description: 'Each staff member can now independently toggle their live chat availability. When you go offline your conversations are handled by AI automatically.',
      },
      {
        icon: '🕐',
        title: 'Office hours restrict live chat widget',
        description: 'The chat widget on the website switches to AI mode outside of configured office hours, even if a staff member has live chat turned on.',
      },
      {
        icon: '☁️',
        title: 'Google Drive hourly auto-sync',
        description: 'The knowledge base now syncs with Google Drive every hour, keeping AI answers up to date without manual re-scraping.',
      },
    ],
  },
  {
    date: '29 May 2026',
    items: [
      {
        icon: '📎',
        title: 'Email attachments viewable and downloadable',
        description: 'Files attached to incoming emails now appear as chips in the conversation. Click to download directly from the inbox.',
      },
      {
        icon: '📝',
        title: 'Reply drafts auto-saved per conversation',
        description: 'Whatever you\'ve typed in the reply box is saved automatically. If you switch conversations and come back, your draft is still there.',
      },
    ],
  },
  {
    date: '28 May 2026',
    items: [
      {
        icon: '📧',
        title: 'Mark as unread syncs back to Gmail',
        description: 'Marking a conversation as unread in the inbox now also marks the underlying Gmail thread as unread, keeping both views in sync.',
      },
    ],
  },
]
