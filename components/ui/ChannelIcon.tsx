import type { Channel } from '@/types/database'

interface ChannelIconProps {
  channel: Channel | string
  className?: string
  showLabel?: boolean
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  gmail:     { label: 'Gmail',     color: '#EA4335' },
  whatsapp:  { label: 'WhatsApp',  color: '#25D366' },
  facebook:  { label: 'Facebook',  color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  form:      { label: 'Form',      color: '#FBB33F' },
  chat:      { label: 'Chat',      color: '#604484' },
}

export default function ChannelIcon({ channel, className = 'w-4 h-4', showLabel }: ChannelIconProps) {
  const config = CHANNEL_CONFIG[channel] ?? { label: channel, color: '#6b7280' }

  return (
    <span className="inline-flex items-center gap-1">
      <ChannelSvg channel={channel} className={className} color={config.color} />
      {showLabel && <span className="text-xs text-gray-400">{config.label}</span>}
    </span>
  )
}

function ChannelSvg({ channel, className, color }: { channel: string; className: string; color: string }) {
  switch (channel) {
    case 'gmail':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Gmail">
          <rect width="24" height="24" rx="4" fill={color} fillOpacity="0.15" />
          <path d="M4 8l8 5 8-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <rect x="4" y="7" width="16" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="WhatsApp">
          <rect width="24" height="24" rx="4" fill={color} fillOpacity="0.15" />
          <path d="M12 4C7.58 4 4 7.58 4 12c0 1.5.4 2.9 1.1 4.1L4 20l4-1.1C9.1 19.6 10.5 20 12 20c4.42 0 8-3.58 8-8s-3.58-8-8-8z" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M9 11c.3.7.7 1.4 1.3 2s1.3 1 2 1.3l.7-1c.2-.3.5-.4.9-.3.5.2 1 .4 1.4.5.4.1.6.5.5.9l-.4 1.6c-.1.4-.5.5-.9.4C10.6 15.7 8.3 13.4 7.5 10c-.1-.4.1-.8.4-.9l1.6-.4c.4-.1.8.1.9.5.1.4.3.9.5 1.4.1.4 0 .7-.3.9L9 11z" fill={color} />
        </svg>
      )
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Facebook">
          <rect width="24" height="24" rx="4" fill={color} fillOpacity="0.15" />
          <path d="M13 10h2.5l-.5 2H13v6h-2v-6H9v-2h2V8.5C11 6.6 12.1 6 13.5 6H16v2h-1.5c-.6 0-1.5.2-1.5 1v1z" fill={color} />
        </svg>
      )
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Instagram">
          <rect width="24" height="24" rx="4" fill={color} fillOpacity="0.15" />
          <rect x="5" y="5" width="14" height="14" rx="4" stroke={color} strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
          <circle cx="17" cy="7" r="1" fill={color} />
        </svg>
      )
    case 'form':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Form">
          <rect width="24" height="24" rx="4" fill={color} fillOpacity="0.15" />
          <rect x="6" y="4" width="12" height="16" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M9 8h6M9 11h6M9 14h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'chat':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Chat">
          <rect width="24" height="24" rx="4" fill={color} fillOpacity="0.15" />
          <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H8l-4 3V8z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Channel">
          <rect width="24" height="24" rx="4" fill="#6b7280" fillOpacity="0.15" />
          <circle cx="12" cy="12" r="4" stroke="#6b7280" strokeWidth="1.5" />
        </svg>
      )
  }
}

export function channelLabel(channel: string): string {
  return CHANNEL_CONFIG[channel]?.label ?? channel
}
