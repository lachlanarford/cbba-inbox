'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChannelConfig } from '@/types/database'
import ChannelCard from './ChannelCard'
import ConnectGmailModal from './ConnectGmailModal'
import ConnectSocialModal from './ConnectSocialModal'

interface ChannelManagerProps {
  configs: ChannelConfig[]
  formWebhookUrl: string
  formSecret: string
}

const CHANNEL_ORDER = ['gmail', 'whatsapp', 'facebook', 'instagram', 'form'] as const

export default function ChannelManager({ configs: initialConfigs, formWebhookUrl, formSecret }: ChannelManagerProps) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [gmailModalOpen, setGmailModalOpen] = useState(false)
  const [socialModal, setSocialModal] = useState<'whatsapp' | 'facebook' | 'instagram' | null>(null)
  const [, startTransition] = useTransition()

  function getConfigsForChannel(channelType: string) {
    return configs.filter((c) => c.channel_type === channelType)
  }

  async function handleToggle(configId: string, isActive: boolean) {
    setConfigs((prev) => prev.map((c) => c.id === configId ? { ...c, is_active: isActive } : c))
    const supabase = createClient()
    await supabase.from('channel_configs').update({ is_active: isActive }).eq('id', configId)
  }

  async function handleRemove(configId: string) {
    setConfigs((prev) => prev.filter((c) => c.id !== configId))
    const supabase = createClient()
    await supabase.from('channel_configs').delete().eq('id', configId)
  }

  async function handleUpdateMetadata(configId: string, metadata: Record<string, unknown>) {
    setConfigs((prev) => prev.map((c) => c.id === configId ? { ...c, metadata } : c))
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('channel_configs').update({ metadata: metadata as any }).eq('id', configId)

    const department = metadata.default_department as string | null | undefined
    if (department) {
      await fetch('/api/admin/backfill-departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelConfigId: configId, department }),
      })
    }
  }

  function handleConfigSaved(newConfig: ChannelConfig) {
    setConfigs((prev) => {
      const existing = prev.findIndex((c) => c.id === newConfig.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = newConfig
        return updated
      }
      return [...prev, newConfig]
    })
  }

  // Reload configs after Gmail OAuth redirect
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    if (url.searchParams.get('connected') === 'gmail') {
      startTransition(() => {
        url.searchParams.delete('connected')
        window.history.replaceState({}, '', url.toString())
      })
    }
  }

  return (
    <div className="space-y-4">
      {CHANNEL_ORDER.map((channelType) => (
        <ChannelCard
          key={channelType}
          channelType={channelType}
          configs={getConfigsForChannel(channelType)}
          formWebhookUrl={channelType === 'form' ? formWebhookUrl : undefined}
          formSecret={channelType === 'form' ? formSecret : undefined}
          onToggle={handleToggle}
          onRemove={channelType !== 'form' ? handleRemove : undefined}
          onUpdateMetadata={channelType === 'gmail' ? handleUpdateMetadata : undefined}
          onConnect={
            channelType === 'gmail'
              ? () => setGmailModalOpen(true)
              : channelType === 'whatsapp' || channelType === 'facebook' || channelType === 'instagram'
              ? () => setSocialModal(channelType)
              : undefined
          }
        />
      ))}

      {gmailModalOpen && (
        <ConnectGmailModal
          onClose={() => setGmailModalOpen(false)}
        />
      )}

      {socialModal && (
        <ConnectSocialModal
          channelType={socialModal}
          existingConfig={getConfigsForChannel(socialModal)[0] ?? null}
          onClose={() => setSocialModal(null)}
          onSaved={handleConfigSaved}
        />
      )}
    </div>
  )
}
