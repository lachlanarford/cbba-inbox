'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChannelConfig } from '@/types/database'

interface ConnectSocialModalProps {
  channelType: 'whatsapp' | 'facebook' | 'instagram'
  existingConfig: ChannelConfig | null
  onClose: () => void
  onSaved: (config: ChannelConfig) => void
}

const CHANNEL_META = {
  whatsapp: {
    label: 'WhatsApp',
    notice: 'WhatsApp requires a verified Twilio account and Meta Business approval. Enter your Twilio credentials below. The channel will remain inactive until you toggle it active after verification.',
    bannerText: 'WhatsApp connection saved. Toggle active once Meta verification is complete.',
    fields: [
      { key: 'accountSid', label: 'Twilio Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Twilio Auth Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'whatsappNumber', label: 'WhatsApp Number', placeholder: '+61400000000' },
    ],
    displayNameKey: 'whatsappNumber',
    identifier: 'whatsapp-twilio',
  },
  facebook: {
    label: 'Facebook Messenger',
    notice: 'Connect your Facebook Page to receive Messenger conversations. Requires Meta App review before going live.',
    bannerText: 'Facebook connection saved. Activate once Meta App review is approved.',
    fields: [
      { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'EAAxxxx...', secret: true },
      { key: 'verify_token', label: 'Verify Token', placeholder: 'A secret string you choose', secret: false },
    ],
    displayNameKey: 'verify_token',
    identifier: 'facebook-page',
  },
  instagram: {
    label: 'Instagram',
    notice: 'Connect your Instagram Business account to receive DMs. Requires Meta App review.',
    bannerText: 'Instagram connection saved. Activate once Meta App review is approved.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAxxxx...', secret: true },
      { key: 'verify_token', label: 'Verify Token', placeholder: 'A secret string you choose', secret: false },
    ],
    displayNameKey: 'verify_token',
    identifier: 'instagram-dm',
  },
}

export default function ConnectSocialModal({ channelType, existingConfig, onClose, onSaved }: ConnectSocialModalProps) {
  const meta = CHANNEL_META[channelType]
  const initialValues = (existingConfig?.credentials ?? {}) as Record<string, string>
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const displayName = values[meta.displayNameKey] || meta.identifier

    let result: ChannelConfig | null = null

    if (existingConfig) {
      const { data } = await supabase
        .from('channel_configs')
        .update({ credentials: values, display_name: displayName })
        .eq('id', existingConfig.id)
        .select('*')
        .single()
      result = data as unknown as ChannelConfig
    } else {
      const { data } = await supabase
        .from('channel_configs')
        .insert({
          channel_type: channelType,
          display_name: displayName,
          identifier: meta.identifier,
          credentials: values,
          is_active: false,
        })
        .select('*')
        .single()
      result = data as unknown as ChannelConfig
    }

    setSaving(false)
    if (result) {
      onSaved(result)
      setSaved(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-cbba-navy-light border border-white/10 rounded-2xl shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Connect {meta.label}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300">{meta.notice}</p>
        </div>

        {saved ? (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <p className="text-xs text-emerald-400">{meta.bannerText}</p>
          </div>
        ) : (
          <div className="space-y-4 mb-5">
            {meta.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-gray-400 block mb-1.5">{field.label}</label>
                <input
                  type={field.secret ? 'password' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple font-mono"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/8 transition-colors"
          >
            {saved ? 'Close' : 'Cancel'}
          </button>
          {!saved && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-cbba-purple hover:bg-cbba-purple-light disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save credentials'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
