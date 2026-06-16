import { google } from 'googleapis'

export interface DriveServiceAccount {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
}

const GOOGLE_DOC = 'application/vnd.google-apps.document'
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet'
const PDF_TYPE = 'application/pdf'

export const SUPPORTED_MIME_TYPES = new Set([GOOGLE_DOC, GOOGLE_SHEET, PDF_TYPE])

export function getDriveClient(credentials: DriveServiceAccount) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function listFilesInFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string
): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken,
    })
    for (const file of res.data.files ?? []) {
      if (file.id && file.name && file.mimeType && SUPPORTED_MIME_TYPES.has(file.mimeType)) {
        files.push({ id: file.id, name: file.name, mimeType: file.mimeType })
      }
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

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
      { fileId: file.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: Buffer.from(res.data as ArrayBuffer) })
    const result = await parser.getText()
    return result.text.trim() || null
  }

  return null
}
