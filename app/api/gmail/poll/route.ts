import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentHistoryId } from '@/lib/gmail/client'
import { catchUpGmailInbox, inboxNeedsCatchUp, syncGmailInbox } from '@/lib/gmail/sync-inbox'

// Called by Vercel Cron (or external cron service) every minute.
// Vercel passes Authorization: Bearer {CRON_SECRET} automatically.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[gmail/poll] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      const catchUp = await inboxNeedsCatchUp(config.id, metadata)
      if (catchUp.needed) {
        const imported = await catchUpGmailInbox({
          configId: config.id,
          email,
          metadata,
          afterDate: catchUp.afterDate,
        })
        results.push({
          email,
          processed: imported.processed,
          status: `caught_up:${imported.scanned}`,
        })
        continue
      }

      if (!historyId) {
        historyId = await getCurrentHistoryId(config.id)
        await supabase
          .from('channel_configs')
          .update({ metadata: { ...metadata, history_id: historyId } })
          .eq('id', config.id)
        results.push({ email, processed: 0, status: 'initialized' })
        continue
      }

      const sync = await syncGmailInbox({
        configId: config.id,
        email,
        metadata,
        storedHistoryId: historyId,
        notify: true,
      })

      results.push({ email, processed: sync.processed, status: 'ok' })
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)

      if (errMsg.includes('404') || errMsg.includes('Invalid historyId')) {
        try {
          const afterDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          const imported = await catchUpGmailInbox({
            configId: config.id,
            email,
            metadata,
            afterDate,
          })
          results.push({
            email,
            processed: imported.processed,
            status: `reinitialized:${imported.scanned}`,
          })
        } catch (catchUpErr) {
          const newId = await getCurrentHistoryId(config.id).catch(() => '')
          if (newId) {
            await supabase
              .from('channel_configs')
              .update({ metadata: { ...metadata, history_id: newId } })
              .eq('id', config.id)
          }
          console.error(`[gmail/poll] catch-up failed for ${email}:`, catchUpErr)
          results.push({ email, processed: 0, status: 'reinitialized' })
        }
      } else {
        console.error(`[gmail/poll] error for ${email}:`, err)
        results.push({ email, processed: 0, status: errMsg })
      }
    }
  }

  return NextResponse.json({ results })
}
