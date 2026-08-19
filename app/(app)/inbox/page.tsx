import { Suspense } from 'react'
import InboxLayout from '@/components/inbox/InboxLayout'

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-xs text-gray-500">Loading inbox...</div>}>
      <InboxLayout />
    </Suspense>
  )
}
