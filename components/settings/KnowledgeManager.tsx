'use client'

import DriveSync from './DriveSync'

interface KnowledgeManagerProps {
  driveFolderId: string
  driveChannelConfigId: string
  gmailAccounts: { id: string; email: string }[]
}

export default function KnowledgeManager({ driveFolderId, driveChannelConfigId, gmailAccounts }: KnowledgeManagerProps) {
  return (
    <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6">
      <DriveSync
        initialFolderId={driveFolderId}
        initialChannelConfigId={driveChannelConfigId}
        gmailAccounts={gmailAccounts}
      />
    </div>
  )
}
