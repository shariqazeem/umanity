/**
 * Media storage for delivery proof (photos, videos, receipts).
 *
 *  - Local driver (default): files under .data/uploads/<yyyy-mm>/<id>.<ext>,
 *    served by GET /api/media/<yyyy-mm>/<id>.<ext>. Fine on the Ubuntu box
 *    (mount .data as a volume); not for serverless hosts.
 *  - S3-compatible driver (R2, S3, MinIO): selected when S3_ENDPOINT,
 *    S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL are
 *    set. Needs `@aws-sdk/client-s3` installed (see TODO below).
 */
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { newId } from '@/lib/db'
import type { MediaItem } from '@/lib/db/schema'

export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), '.data', 'uploads')
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
}
const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]))

export function isAllowedContentType(contentType: string): boolean {
  return contentType in EXT_BY_TYPE
}

export function kindForContentType(contentType: string): MediaItem['kind'] {
  if (contentType.startsWith('image/')) return 'photo'
  if (contentType.startsWith('video/')) return 'video'
  return 'document'
}

export function s3Configured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_PUBLIC_URL)
}

export interface SavedMedia {
  url: string
  sha256: string
  size: number
  kind: MediaItem['kind']
  contentType: string
  path: string
}

export async function saveMedia(bytes: Uint8Array, opts: { filename: string; contentType: string }): Promise<SavedMedia> {
  const contentType = opts.contentType.toLowerCase()
  if (!isAllowedContentType(contentType)) throw new Error(`Unsupported file type ${contentType}`)
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error('File is larger than 15 MB')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const ext = EXT_BY_TYPE[contentType]
  const month = new Date().toISOString().slice(0, 7)
  const rel = `${month}/${newId('m')}.${ext}`

  if (s3Configured()) {
    // TODO(storage): S3/R2 driver. Install `@aws-sdk/client-s3`, then:
    //   new S3Client({ endpoint: S3_ENDPOINT, region: 'auto', credentials: {...}, forcePathStyle: true })
    //   PutObjectCommand({ Bucket: S3_BUCKET, Key: rel, Body: bytes, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' })
    //   return { url: `${S3_PUBLIC_URL}/${rel}`, ... }
    throw new Error('S3 storage is configured but the driver is not installed: run `npm i @aws-sdk/client-s3` and finish lib/storage.ts, or unset the S3_* variables to use local storage')
  }

  const full = path.join(UPLOAD_ROOT, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, bytes)
  return { url: `/api/media/${rel}`, sha256, size: bytes.byteLength, kind: kindForContentType(contentType), contentType, path: rel }
}

/** Reads a locally stored file by its relative path; null when missing or when the path is not ours. */
export function readMedia(relPath: string): { bytes: Buffer; contentType: string } | null {
  if (!/^[0-9]{4}-[0-9]{2}\/[a-z0-9_]+\.[a-z0-9]+$/i.test(relPath)) return null
  const root = path.resolve(UPLOAD_ROOT)
  const full = path.resolve(root, relPath)
  if (!full.startsWith(root + path.sep)) return null
  if (!fs.existsSync(full)) return null
  const ext = path.extname(full).slice(1).toLowerCase()
  return { bytes: fs.readFileSync(full), contentType: TYPE_BY_EXT[ext] || 'application/octet-stream' }
}
