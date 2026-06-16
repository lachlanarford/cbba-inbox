import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/gmail/client'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
}

const GOOGLE_DOC = 'application/vnd.google-apps.document'
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet'
const PDF_TYPE = 'application/pdf'

export const SUPPORTED_MIME_TYPES = new Set([GOOGLE_DOC, GOOGLE_SHEET, PDF_TYPE])

export async function getDriveClient(channelConfigId: string) {
  const auth = await getAuthenticatedClient(channelConfigId)
  return google.drive({ version: 'v3', auth })
}

export async function listFilesInFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string
): Promise<DriveFile[]> {
  const files: DriveFile[] = []

  async function walk(id: string) {
    let pageToken: string | undefined
    do {
      const res = await drive.files.list({
        q: `'${id}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageSize: 100,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      })
      for (const file of res.data.files ?? []) {
        if (!file.id || !file.name || !file.mimeType) continue
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          console.log('[drive] entering subfolder:', file.name)
          await walk(file.id)
        } else if (SUPPORTED_MIME_TYPES.has(file.mimeType)) {
          console.log('[drive] found supported file:', file.name, file.mimeType)
          files.push({ id: file.id, name: file.name, mimeType: file.mimeType })
        } else {
          console.log('[drive] skipping unsupported file:', file.name, file.mimeType)
        }
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  await walk(folderId)
  return files
}

export async function extractTextFromFile(
  drive: ReturnType<typeof google.drive>,
  file: DriveFile
): Promise<string | null> {
  if (file.mimeType === GOOGLE_DOC) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: 'text/plain' },
      { responseType: 'text' }
    )
    return (res.data as string).trim() || null
  }

  if (file.mimeType === GOOGLE_SHEET) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: 'text/csv' },
      { responseType: 'text' }
    )
    return (res.data as string).trim() || null
  }

  if (file.mimeType === PDF_TYPE) {
    const res = await drive.files.get(
      { fileId: file.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
    const raw = res.data
    const buf = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from(raw as ArrayBuffer)
    console.log('[drive] PDF download size for', file.name, ':', buf.length, 'bytes')
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buf })
    const result = await parser.getText()
    console.log('[drive] PDF text length for', file.name, ':', result.text?.length ?? 0)
    return result.text?.trim() || null
  }

  return null
}
