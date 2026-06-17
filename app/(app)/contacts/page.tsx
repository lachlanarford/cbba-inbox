'use client'

import { useState } from 'react'
import ContactsTable from '@/components/contacts/ContactsTable'
import ContactLists from '@/components/contacts/ContactLists'

export default function ContactsPage() {
  const [tab, setTab] = useState<'all' | 'lists'>('all')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Contacts</h2>
        <p className="text-sm text-gray-400 mt-0.5">All contacts across your connected channels</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'all' ? 'border-cbba-purple text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          All Contacts
        </button>
        <button
          onClick={() => setTab('lists')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'lists' ? 'border-cbba-purple text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          Lists
        </button>
      </div>

      {tab === 'all' ? <ContactsTable /> : <ContactLists />}
    </div>
  )
}
