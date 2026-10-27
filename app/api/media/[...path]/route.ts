import { NextRequest, NextResponse } from 'next/server'
import { readMedia } from '@/lib/storage'

export const runtime = 'nodejs'

/** GET /api/media/<yyyy-mm>/<id>.<ext> — serves locally stored delivery media. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const rel = (path || []).join('/')
  const file = readMedia(rel)
  if (!file) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
