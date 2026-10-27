import { NextRequest } from 'next/server'
import { ok, fail, errorMessage } from '@/lib/api'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { saveMedia, MAX_UPLOAD_BYTES, isAllowedContentType } from '@/lib/storage'

export const runtime = 'nodejs'

/**
 * POST /api/media/upload (admin, multipart field `file`, optional `kind`=receipt|document)
 * → { url, sha256, size, kind, contentType }
 */
export async function POST(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return fail(auth.error || 'Unauthorized', 401)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail('Expected multipart form data')
  }
  const file = form.get('file')
  if (!(file instanceof File)) return fail('Field `file` is required')
  if (!isAllowedContentType(file.type)) return fail(`Unsupported file type ${file.type || '(unknown)'}; images, video and PDF only`)
  if (file.size > MAX_UPLOAD_BYTES) return fail('File is larger than 15 MB', 413)
  try {
    const saved = await saveMedia(new Uint8Array(await file.arrayBuffer()), { filename: file.name, contentType: file.type })
    const kindOverride = String(form.get('kind') || '')
    const kind = kindOverride === 'receipt' || kindOverride === 'document' ? kindOverride : saved.kind
    return ok({ url: saved.url, sha256: saved.sha256, size: saved.size, kind, contentType: saved.contentType })
  } catch (e) {
    return fail(errorMessage(e), 500)
  }
}
