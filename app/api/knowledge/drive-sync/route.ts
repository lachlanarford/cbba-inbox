import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { getDriveClient, listFilesInFolder, extractTextFromFile } from '@/lib/drive/client'
import type { SupabaseClient } from '@supabase/supabase-js'

type SyncResult = { name: string; status: 'synced' | 'skipped' | 'error' }

async function runDriveSync(
  service: SupabaseClient,
  trigger: 'manual' | 'cron'
): Promise<{ synced: number; results: SyncResult[] } | { error: string; status: number }> {
  const { data: driveSettingsRows } = await service
    .from('settings')
    .select('key, value')
    .in('key', ['drive_folder_id', 'drive_channel_config_id'])

  const driveSettings = Object.fromEntries((driveSettingsRows ?? []).map((s) => [s.key, s.value as string]))
  const folderId = driveSettings['drive_folder_id']
  const channelConfigId = driveSettings['drive_channel_config_id']

  if (!folderId) return { error: 'Drive folder not configured', status: 400 }
  if (!channelConfigId) return { error: 'No Google account selected for Drive. Choose an account in the Drive settings.', status: 400 }

  const { data: gmailConfig } = await service
    .from('channel_configs')
    .select('id, identifier')
    .eq('id', channelConfigId)
    .maybeSingle()

  if (!gmailConfig) return { error: 'Selected Google account not found. Re-select an account in Drive settings.', status: 400 }

  let drive
  try {
    drive = await getDriveClient(gmailConfig.id)
  } catch (err) {
    return { error: `Failed to authenticate with Google: ${String(err)}`, status: 500 }
  }

  let files
  try {
    files = await listFilesInFolder(drive, folderId)
  } catch (err) {
    return { error: `Failed to list Drive folder: ${String(err)}`, status: 500 }
  }

  const syncedFileIds = new Set<string>()
  const results: SyncResult[] = []

  for (const file of files) {
    try {
      const text = await extractTextFromFile(drive, file)
      if (!text) {
        results.push({ name: file.name, status: 'skipped' })
        continue
      }

      const { error } = await service
        .from('knowledge_base')
        .upsert(
          {
            title: file.name,
            content: text,
            source_type: 'drive',
            drive_file_id: file.id,
            is_active: true,
            last_scraped_at: new Date().toISOString(),
          },
          { onConflict: 'drive_file_id', ignoreDuplicates: false }
        )

      if (error) {
        console.error('[drive-sync] upsert error for', file.name, error)
        results.push({ name: file.name, status: 'error' })
      } else {
        syncedFileIds.add(file.id)
        results.push({ name: file.name, status: 'synced' })
      }
    } catch (err) {
      console.error('[drive-sync] error processing', file.name, err)
      results.push({ name: file.name, status: 'error' })
    }
  }

  if (syncedFileIds.size > 0) {
    const { data: existing } = await service
      .from('knowledge_base')
      .select('id, drive_file_id')
      .eq('source_type', 'drive')
      .eq('is_active', true)

    const toDeactivate = (existing ?? []).filter((e) => e.drive_file_id && !syncedFileIds.has(e.drive_file_id))
    if (toDeactivate.length > 0) {
      await service
        .from('knowledge_base')
        .update({ is_active: false })
        .in('id', toDeactivate.map((e) => e.id))
    }
  }

  const syncedCount = syncedFileIds.size
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const status = errorCount === 0 ? 'success' : syncedCount > 0 ? 'partial' : 'error'

  await service.from('drive_sync_logs').insert({
    trigger,
    synced_count: syncedCount,
    skipped_count: skippedCount,
    error_count: errorCount,
    status,
  })

  return { synced: syncedCount, results }
}

// Called by Vercel Cron every hour
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const result = await runDriveSync(service, 'cron')

  if ('error' in result) {
    console.error('[drive-sync cron] failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  console.log('[drive-sync cron] complete:', result.synced, 'synced')
  return NextResponse.json(result)
}

// Called manually from the Settings UI
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const service = createServiceClient()
  const result = await runDriveSync(service, 'manual')

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
