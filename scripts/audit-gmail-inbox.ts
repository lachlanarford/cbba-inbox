import { createServiceClient } from '@/lib/supabase/service'
import { estimateMailboxSize, getParsedMessage, listMailboxMessageIds } from '@/lib/gmail/client'
import { ingestInboxEmail } from '@/lib/gmail/sync-inbox'

type AccountResult = {
  email: string
  mailboxTotal: number
  scannedSinceInbox: number
  alreadyInInbox: number
  imported: number
  skipped: number
  failed: Array<{ id: string; subject: string; error: string }>
  importedSubjects: string[]
}

async function storedMessageIds(channelConfigId: string): Promise<Set<string>> {
  const supabase = createServiceClient()
  const convIds: string[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('channel_config_id', channelConfigId)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const row of rows) convIds.push(row.id)
    if (rows.length < pageSize) break
    from += pageSize
  }

  const ids = new Set<string>()
  for (let i = 0; i < convIds.length; i += 100) {
    const chunk = convIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('messages')
      .select('external_message_id')
      .in('conversation_id', chunk)
      .not('external_message_id', 'is', null)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (row.external_message_id) ids.add(row.external_message_id)
    }
  }

  return ids
}

async function auditAccount(opts: {
  id: string
  identifier: string
  metadata: Record<string, string>
  connectedAt: string
}): Promise<AccountResult> {
  const result: AccountResult = {
    email: opts.identifier,
    mailboxTotal: 0,
    scannedSinceInbox: 0,
    alreadyInInbox: 0,
    imported: 0,
    skipped: 0,
    failed: [],
    importedSubjects: [],
  }

  // Inbox only existed from Gmail connect. Older archive is counted, not imported.
  const after = new Date(opts.connectedAt)
  after.setUTCDate(after.getUTCDate() - 1)

  result.mailboxTotal = await estimateMailboxSize(opts.id)
  const gmailIds = await listMailboxMessageIds(opts.id, after)
  result.scannedSinceInbox = gmailIds.length
  const stored = await storedMessageIds(opts.id)
  const missing = gmailIds.filter((id) => !stored.has(id))
  result.alreadyInInbox = gmailIds.length - missing.length

  const defaultDepartment = opts.metadata.default_department ?? null
  const defaultAssignedTo = opts.metadata.default_assigned_to ?? null
  const concurrency = 2

  process.stdout.write(
    `  mailbox ${result.mailboxTotal}, since inbox started ${gmailIds.length}, missing ${missing.length}\n`
  )

  for (let i = 0; i < missing.length; i += concurrency) {
    const batch = missing.slice(i, i + concurrency)
    const outcomes = await Promise.all(
      batch.map(async (messageId) => {
        let lastError = 'unknown'
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const email = await getParsedMessage(opts.id, messageId)
            if (!email) return { kind: 'skipped' as const }
            const ingested = await ingestInboxEmail({
              configId: opts.id,
              email,
              defaultDepartment,
              defaultAssignedTo,
              notify: false,
              categorise: false,
            })
            if (ingested) return { kind: 'imported' as const, subject: email.subject }
            return { kind: 'skipped' as const }
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err)
            const retryable =
              lastError.includes('Quota exceeded') ||
              lastError.includes('statement timeout') ||
              lastError.includes('not found') ||
              lastError.includes('Failed to create')
            if (!retryable || attempt === 4) break
            await new Promise((resolve) => setTimeout(resolve, attempt * 4000))
          }
        }
        return { kind: 'failed' as const, id: messageId, error: lastError }
      })
    )

    for (const outcome of outcomes) {
      if (outcome.kind === 'imported') {
        result.imported++
        if (result.importedSubjects.length < 40) {
          result.importedSubjects.push(outcome.subject)
        }
      } else if (outcome.kind === 'skipped') {
        result.skipped++
      } else {
        result.failed.push({ id: outcome.id, subject: '(unknown)', error: outcome.error })
      }
    }

    const done = Math.min(i + concurrency, missing.length)
    if (done % 40 === 0 || done === missing.length) {
      process.stdout.write(`  processed ${done}/${missing.length}\n`)
    }
  }

  return result
}

async function main() {
  const supabase = createServiceClient()
  const { data: configs, error } = await supabase
    .from('channel_configs')
    .select('id, identifier, metadata, created_at')
    .eq('channel_type', 'gmail')
    .eq('is_active', true)
    .order('identifier')

  if (error) throw new Error(error.message)

  const results: AccountResult[] = []
  for (const config of configs ?? []) {
    process.stdout.write(`Checking ${config.identifier}...\n`)
    const metadata = (config.metadata ?? {}) as Record<string, string>
    const account = await auditAccount({
      id: config.id,
      identifier: config.identifier,
      metadata,
      connectedAt: config.created_at,
    })
    process.stdout.write(
      `  already in inbox ${account.alreadyInInbox}, imported ${account.imported}, skipped ${account.skipped}, failed ${account.failed.length}\n`
    )
    results.push(account)
  }

  console.log(JSON.stringify({ results }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
