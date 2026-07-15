'use client'

import { useState, useCallback } from 'react'
import type { ChannelConfig, StaffUser } from '@/types/database'

const DEPARTMENTS = [
  { value: 'Reps',  label: 'Reps' },
  { value: 'Comps', label: 'Comps' },
  { value: 'LTP',   label: 'Learn to Play' },
  { value: 'Referees', label: 'Referees' },
  { value: 'Other', label: 'Other' },
] as const

interface ChannelCardProps {
  channelType: string
  configs: ChannelConfig[]
  users?: StaffUser[]
  formWebhookUrl?: string
  formSecret?: string
  onToggle: (id: string, active: boolean) => void
  onRemove?: (id: string) => void
  onConnect?: () => void
  onUpdateMetadata?: (id: string, metadata: Record<string, unknown>) => Promise<void>
}

const CHANNEL_META: Record<string, { label: string; description: string; icon: React.ReactNode; comingSoon?: boolean }> = {
  gmail: {
    label: 'Gmail',
    description: 'Receive and reply to emails from connected Gmail inboxes.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
      </svg>
    ),
  },
  whatsapp: {
    label: 'WhatsApp',
    description: 'Receive WhatsApp messages via Twilio. Requires Meta Business verification.',
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook Messenger',
    description: 'Receive Facebook Messenger messages. Requires Meta App review.',
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    description: 'Receive Instagram DMs. Requires Meta App review.',
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  form: {
    label: 'Website Form',
    description: 'Accept submissions from your website contact form via webhook.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5A2.25 2.25 0 0010.5 21.75h7.5" />
      </svg>
    ),
  },
}

export default function ChannelCard({
  channelType,
  configs,
  users = [],
  formWebhookUrl,
  formSecret,
  onToggle,
  onRemove,
  onConnect,
  onUpdateMetadata,
}: ChannelCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [renewingWatch, setRenewingWatch] = useState(false)
  const [renewResult, setRenewResult] = useState<'ok' | 'error' | null>(null)
  const meta = CHANNEL_META[channelType] ?? { label: channelType, description: '', icon: null }

  const handleRenewWatch = useCallback(async () => {
    setRenewingWatch(true)
    setRenewResult(null)
    try {
      const res = await fetch('/api/gmail/watch/renew')
      setRenewResult(res.ok ? 'ok' : 'error')
    } catch {
      setRenewResult('error')
    } finally {
      setRenewingWatch(false)
      setTimeout(() => setRenewResult(null), 3000)
    }
  }, [])

  async function copyToClipboard(value: string, field: string) {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const isFormChannel = channelType === 'form'
  const formConfig = isFormChannel ? configs[0] : null

  return (
    <div className="bg-cbba-navy-light border border-white/8 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-300 flex-shrink-0">
            {meta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
              {meta.comingSoon && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                  Pending verification
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 max-w-sm">{meta.description}</p>
          </div>
        </div>

        {onConnect && (
          <button
            onClick={onConnect}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-cbba-purple hover:bg-cbba-purple-light text-white transition-colors"
          >
            {configs.length > 0 ? 'Add account' : 'Connect'}
          </button>
        )}
      </div>

      {/* Website form config */}
      {isFormChannel && formWebhookUrl && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 mb-1">Webhook URL</p>
              <code className="text-xs text-gray-300 bg-white/5 px-2 py-1 rounded block truncate">
                {formWebhookUrl}
              </code>
            </div>
            <button
              onClick={() => copyToClipboard(formWebhookUrl, 'url')}
              className="flex-shrink-0 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              {copiedField === 'url' ? 'Copied' : 'Copy'}
            </button>
          </div>

          {formSecret && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 mb-1">Secret (X-Form-Secret header)</p>
                <code className="text-xs text-gray-300 bg-white/5 px-2 py-1 rounded block">
                  {'•'.repeat(Math.min(formSecret.length, 32))}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(formSecret, 'secret')}
                className="flex-shrink-0 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                {copiedField === 'secret' ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {formConfig && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">
                {formConfig.is_active ? 'Accepting submissions' : 'Submissions paused'}
              </span>
              <Toggle
                checked={formConfig.is_active}
                onChange={(v) => onToggle(formConfig.id, v)}
              />
            </div>
          )}
        </div>
      )}

      {/* Connected accounts list (non-form channels) */}
      {!isFormChannel && configs.length > 0 && (
        <div className="mt-4 space-y-2">
          {configs.map((config) => {
            const defaultDept = ((config.metadata ?? {}) as Record<string, string>).default_department ?? ''
            return (
              <div key={config.id} className="rounded-lg bg-white/4 overflow-hidden">
                <div className="flex items-center justify-between gap-3 py-2 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot active={config.is_active} />
                    <span className="text-xs text-gray-300 truncate">{config.display_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      config.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-gray-500'
                    }`}>
                      {config.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {channelType === 'gmail' && (
                      <>
                        <button
                          onClick={handleRenewWatch}
                          disabled={renewingWatch}
                          className="text-xs text-gray-500 hover:text-cbba-purple transition-colors disabled:opacity-50"
                          title="Renew Gmail Pub/Sub watch subscription"
                        >
                          {renewingWatch ? 'Renewing...' : renewResult === 'ok' ? 'Renewed!' : renewResult === 'error' ? 'Failed' : 'Renew watch'}
                        </button>
                        <button
                          onClick={() => { window.location.href = `/api/gmail/auth/start?email=${encodeURIComponent(config.identifier)}` }}
                          className="text-xs text-gray-500 hover:text-cbba-purple transition-colors"
                          title="Re-authorise this account with Google"
                        >
                          Reconnect
                        </button>
                      </>
                    )}
                    <Toggle
                      checked={config.is_active}
                      onChange={(v) => onToggle(config.id, v)}
                    />
                    {onRemove && (
                      <button
                        onClick={() => onRemove(config.id)}
                        className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {channelType === 'gmail' && onUpdateMetadata && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex-shrink-0">Default department:</span>
                      <select
                        value={defaultDept}
                        onChange={(e) => onUpdateMetadata(config.id, {
                          ...(config.metadata ?? {}),
                          default_department: e.target.value || null,
                        })}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-300 focus:outline-none focus:border-cbba-purple cursor-pointer transition-colors"
                      >
                        <option value="">None</option>
                        {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex-shrink-0">Default assignee:</span>
                      <select
                        value={((config.metadata ?? {}) as Record<string, string>).default_assigned_to ?? ''}
                        onChange={(e) => onUpdateMetadata(config.id, {
                          ...(config.metadata ?? {}),
                          default_assigned_to: e.target.value || null,
                        })}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-300 focus:outline-none focus:border-cbba-purple cursor-pointer transition-colors"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isFormChannel && configs.length === 0 && (
        <p className="mt-3 text-xs text-gray-600">No accounts connected.</p>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-cbba-purple' : 'bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
  )
}
