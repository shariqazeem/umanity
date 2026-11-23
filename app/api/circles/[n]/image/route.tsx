/**
 * A Circle's picture, drawn by its own gift (lib/umanity/tally.ts) once that Circle is minted, so its
 * holder sees it first. 1200×1200 PNG with its record; ?size=thumb for the bare art at 400px.
 */
import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'
import { CIRCLES_LIMIT, SEASON_ONE_COLOUR, circleRecords, getCircle } from '@/lib/umanity/circles'
import { circleSvg, INK, PAPER } from '@/lib/umanity/tally'
import { brandFonts, svgDataUrl } from '@/lib/og/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const two = (n: number) => String(n).padStart(2, '0')

export async function GET(req: Request, { params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n)
  if (!Number.isInteger(n) || n < 1 || n > CIRCLES_LIMIT) return NextResponse.json({ error: 'No such Circle' }, { status: 404 })
  const c = await getCircle(n)
  if (!c || c.status !== 'minted') return NextResponse.json({ error: 'Not revealed yet' }, { status: 404 })
  const rec = (await circleRecords([c])).get(n)!
  const held = rec.state === 'closed' && SEASON_ONE_COLOUR ? SEASON_ONE_COLOUR : 'plain'
  const headers = { 'cache-control': 'public, max-age=300, s-maxage=3600' }

  if (new URL(req.url).searchParams.get('size') === 'thumb') {
    const art = svgDataUrl(circleSvg(rec, { state: rec.state, held }, 400, 112, PAPER))
    // eslint-disable-next-line @next/next/no-img-element
    return new ImageResponse(<img src={art} width={400} height={400} alt="" />, { width: 400, height: 400, headers })
  }

  const d = new Date(rec.at)
  const given = `GIVEN ${two(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`
  const state = rec.state === 'open' ? 'OPEN · CLOSES WHEN THE FIRST FILM ROLLS' : 'CLOSED · THE FIRST FILM ROLLED'
  const gifts = `${rec.gifts} GIFT${rec.gifts > 1 ? 'S' : ''}`
  const art = svgDataUrl(circleSvg(rec, { state: rec.state, held }, 900, 112))
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 1200, display: 'flex', position: 'relative', background: PAPER, color: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} width={900} height={900} alt="" style={{ position: 'absolute', left: 240, top: 40 }} />
        <div style={{ position: 'absolute', left: 64, top: 60, display: 'flex', fontFamily: 'Martian Mono', fontSize: 22, fontWeight: 600, letterSpacing: 1 }}>THE HUNDRED · SEASON 0</div>
        <div style={{ position: 'absolute', left: 58, bottom: 150, display: 'flex', fontFamily: 'Anek Latin', fontSize: 150, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{`No. ${String(n).padStart(3, '0')}`}</div>
        <div style={{ position: 'absolute', left: 64, bottom: 60, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'Martian Mono', fontSize: 22, fontWeight: 400, letterSpacing: 1 }}>
          <span>{`${given} · ${gifts}`}</span>
          <span>{state}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 1200, fonts: await brandFonts(), headers }
  )
}
