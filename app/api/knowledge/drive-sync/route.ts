import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { getDriveClient, listFilesInFolder, extractTextFromFile, type DriveServiceAccount } from '@/lib/drive/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const service = createServiceClient()

  // Load Drive settings
  const { data: settings } = await service
    .from('settings')
    .select('key, value')
    .in('key', ['drive_folder_id', 'drive_service_account'])

  const settingsMap = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value as string]))
  const folderId = settingsMap['drive_folder_id']
  const serviceAccountRaw = settingsMap['drive_service_account']

  if (!folderId) return NextResponse.json({ error: 'Drive folder not configured' }, { status: 400 })
  if (!serviceAccountRaw) return NextResponse.json({ error: 'Drive service account not configured' }, { status: 400 })

  let credentials: DriveServiceAccount
  try {
    credentials = JSON.parse(serviceAccountRaw) as DriveServiceAccount
  } catch {
    return NextResponse.json({ error: 'Invalid service account JSON' }, { status: 400 })
  }

  const drive = getDriveClient(credentials)

  // List supported files in the folder
  let files
  try {
    files = await listFilesInFolder(drive, folderId)
  } catch (err) {
    console.error('[drive-sync] listFilesInFolder failed:', err)
    return NextResponse.json({ error: 'Failed to list Drive folder. Check folder ID and service account permissions.' }, { status: 500 })
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

      // Upsert by drive_file_id
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

  // Deactivate Drive entries that are no longer in the folder
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
