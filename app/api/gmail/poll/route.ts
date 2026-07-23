import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  fetchMessagesFromHistory,
  getCurrentHistoryId,
  markAsRead,
} from '@/lib/gmail/client'
import { processIncomingMessage } from '@/lib/channels/processor'

// Called by Vercel Cron (or external cron service) every minute.
// Vercel passes Authorization: Bearer {CRON_SECRET} automatically.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const { data: configs, error } = await supabase
    .from('channel_configs')
    .select('id, identifier, metadata')
    .eq('channel_type', 'gmail')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { email: string; processed: number; status: string }[] = []

  for (const config of configs ?? []) {
    const email = config.identifier
    const metadata = (config.metadata ?? {}) as Record<string, string>
    let historyId = metadata.history_id ?? null

    try {
      // First run: record current historyId and skip — nothing to process yet
      if (!historyId) {
        historyId = await getCurrentHistoryId(config.id)
        await supabase
          .from('channel_configs')
          .update({ metadata: { ...metadata, history_id: historyId } })
          .eq('id', config.id)
        results.push({ email, processed: 0, status: 'initialized' })
        continue
      }

      const { messages, newHistoryId } = await fetchMessagesFromHistory(config.id, historyId, email)

      for (const msg of messages) {
        await processIncomingMessage({
          channel: 'gmail',
          channelConfigId: config.id,
          contactFullName: msg.fromName,
          contactEmail: msg.from,
          contactPhone: null,
          contactSocialId: null,
          subject: msg.subject,
          content: msg.body,
          department: metadata.default_department ?? null,
          externalThreadId: msg.threadId,
          externalMessageId: msg.messageId,
          ccAddresses: msg.cc.length > 0 ? msg.cc : undefined,
        })
        await markAsRead(config.id, msg.messageId)
      }

      if (newHistoryId && newHistoryId !== historyId) {
        await supabase
          .from('channel_configs')
          .update({ metadata: { ...metadata, history_id: newHistoryId } })
          .eq('id', config.id)
      }

      results.push({ email, processed: messages.length, status: 'ok' })
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)

      // historyId expired (Gmail purges history after ~30 days) -- reinitialize
      if (errMsg.includes('404') || errMsg.includes('Invalid historyId')) {
        const newId = await getCurrentHistoryId(config.id).catch(() => '')
        if (newId) {
          await supabase
            .from('channel_configs')
            .update({ metadata: { ...metadata, history_id: newId } })
            .eq('id', config.id)
        }
        results.push({ email, processed: 0, status: 'reinitialized' })
      } else {
        console.error(`[gmail/poll] error for ${email}:`, err)
        results.push({ email, processed: 0, status: errMsg })
      }
    }
  }

  return NextResponse.json({ results })
}
