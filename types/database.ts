// Domain types and joined query result types for Phases 2-3.
// The Database type used by the Supabase client lives in types/supabase.ts.

export type Channel = 'gmail' | 'whatsapp' | 'facebook' | 'instagram' | 'form' | 'chat'
export type ConversationStatus = 'open' | 'in_progress' | 'waiting' | 'closed'
export type Department = 'Reps' | 'Comps' | 'LTP' | 'Other'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type SenderType = 'staff' | 'contact' | 'ai'
export type LabelType = 'department' | 'priority' | 'custom'

export interface Contact {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  social_id: string | null
  channel: Channel | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ChannelConfig {
  id: string
  channel_type: Channel
  display_name: string
  identifier: string
  credentials: Record<string, unknown>
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  contact_id: string
  assigned_to: string | null
  channel: Channel
  status: ConversationStatus
  department: Department | null
  priority: Priority
  subject: string | null
  is_read: boolean
  needs_review: boolean
  created_at: string
  updated_at: string
  closed_at: string | null
  last_message_at: string
  external_thread_id: string | null
  channel_config_id: string | null
  has_attachments: boolean
  snoozed_until: string | null
}

export interface KnowledgeBaseEntry {
  id: string
  title: string
  content: string
  source_type: 'url' | 'manual'
  source_url: string | null
  last_scraped_at: string | null
  is_active: boolean
  department: Department | null
  category: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeEntryWithOwner extends KnowledgeBaseEntry {
  created_by_user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface Label {
  id: string
  name: string
  colour: string
  type: LabelType
  created_at: string
}

export interface FeedbackRequest {
  id: string
  conversation_id: string
  token: string
  contact_email: string | null
  contact_name: string | null
  rating: number | null
  comment: string | null
  sent_at: string
  responded_at: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string | null
  content: string
  is_internal_note: boolean
  is_ai_suggested: boolean
  created_at: string
}

// Joined result types for common queries
export interface ConversationListItem extends Conversation {
  contact: Pick<Contact, 'id' | 'full_name' | 'email' | 'phone'>
  assigned_user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface MessageWithSender extends Message {
  sender: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface ConversationDetail extends Conversation {
  contact: Contact
  assigned_user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface ContactWithConversationCount extends Contact {
  conversation_count: number
}

export interface StaffUser {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string
  department: Department | null
}

export interface InboxFilters {
  status: string
  department: string
  priority: string
  channel: string
  channelConfigId: string
  assignedTo: string
  search: string
  email: string
  dateFrom: string
  dateTo: string
  showSnoozed: boolean
}

export const DEFAULT_FILTERS: InboxFilters = {
  status: 'open',
  department: '',
  priority: '',
  channel: '',
  channelConfigId: '',
  assignedTo: '',
  search: '',
  email: '',
  dateFrom: '',
  dateTo: '',
  showSnoozed: false,
}
