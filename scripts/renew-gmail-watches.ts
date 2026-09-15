import { createServiceClient } from '@/lib/supabase/service'
import { watchInbox } from '@/lib/gmail/client'

async function main() {
  const supabase = createServiceClient()
  const { data: configs, error } = await supabase
    .from('channel_configs')
    .select('id, identifier, metadata')
    .eq('channel_type', 'gmail')
    .eq('is_active', true)
    .order('identifier')

  if (error) throw new Error(error.message)

  for (const config of configs ?? []) {
    try {
      const historyId = await watchInbox(config.id)
      const metadata = (config.metadata ?? {}) as Record<string, string>
      if (!metadata.history_id && historyId) {
        await supabase
          .from('channel_configs')
          .update({ metadata: { ...metadata, history_id: historyId } })
          .eq('id', config.id)
      }
      process.stdout.write(`${config.identifier} watch ok\n`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stdout.write(`${config.identifier} watch failed: ${message}\n`)
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
