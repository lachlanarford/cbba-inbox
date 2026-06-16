import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { getDriveClient, listFilesInFolder, extractTextFromFile } from '@/lib/drive/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const service = createServiceClient()

  // Load folder ID from settings
  const { data: folderSetting } = await service
    .from('settings')
    .select('value')
    .eq('key', 'drive_folder_id')
    .maybeSingle()

  const folderId = folderSetting?.value as string | undefined
  console.log('[drive-sync] folderId:', folderId)
  if (!folderId) return NextResponse.json({ error: 'Drive folder not configured' }, { status: 400 })

  // Pick the first Gmail channel config — any will do since they share the same Google Workspace
  const { data: gmailConfigs } = await service
    .from('channel_configs')
    .select('id, identifier')
    .eq('channel_type', 'gmail')
    .limit(1)

  const gmailConfig = gmailConfigs?.[0] ?? null

  if (!gmailConfig) {
    return NextResponse.json({ error: 'No Gmail channel found. Connect a Gmail account first — Drive uses the same Google account.' }, { status: 400 })
  }

  console.log('[drive-sync] using channel config:', gmailConfig.id, gmailConfig.identifier)

  let drive
  try {
    drive = await getDriveClient(gmailConfig.id)
    console.log('[drive-sync] drive client created OK')
  } catch (err) {
    console.error('[drive-sync] auth failed:', err)
    return NextResponse.json({ error: `Failed to authenticate with Google: ${String(err)}` }, { status: 500 })
  }

  // List supported files in the folder
  let files
  try {
    files = await listFilesInFolder(drive, folderId)
    console.log('[drive-sync] files found:', files.length)
  } catch (err) {
    console.error('[drive-sync] listFilesInFolder failed:', err)
    return NextResponse.json({ error: `Failed to list Drive folder: ${String(err)}` }, { status: 500 })
  }

  const syncedFileIds = new Set<string>()
  const results: { name: string; status: 'synced' | 'skipped' | 'error' }[] = []

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

  // Deactivate Drive entries no longer in the folder
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

  return NextResponse.json({ synced: syncedFileIds.size, results })
}
