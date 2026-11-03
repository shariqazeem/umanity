import { ImageResponse } from 'next/og'
import { Brand, OG_SIZE, ogFonts } from '@/lib/og/brand'
import { getCause } from '@/lib/causes'
import { getCauseList } from '@/lib/data/causes'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'A Umanity cause, held in escrow on Solana'
export const revalidate = 300

/** Share card for a cause: what it is and what sits in its escrow right now. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cause = getCause(id)
  const live = cause ? (await getCauseList().catch(() => [])).find((c) => c.id === id) : undefined
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: n >= 100 ? 0 : n >= 1 ? 2 : 3, maximumFractionDigits: n >= 100 ? 0 : n >= 1 ? 2 : 3 })
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#f5f5f7', fontFamily: 'Inter' }}>
        <Brand right="Escrowed on Solana" />
        <div style={{ display: 'flex', background: '#ffffff', borderRadius: 40, padding: 48, gap: 40, alignItems: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ width: 160, height: 160, borderRadius: 48, background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 96 }}>{cause?.emoji ?? '💚'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: 3 }}>{cause ? `${cause.category} · ${cause.location}` : 'Umanity'}</span>
            <span style={{ fontSize: 76, fontWeight: 900, letterSpacing: -3, color: '#1d1d1f', lineHeight: 1.05, marginTop: 8 }}>{cause?.name ?? 'Umanity'}</span>
            <span style={{ fontSize: 28, color: '#059669', fontWeight: 600, marginTop: 12 }}>{cause?.impact ?? 'Crypto giving, on proof.'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 56, alignItems: 'flex-end' }}>
          {[
            ['In escrow', live ? `${fmt(live.heldSol)} SOL` : '—'],
            ['Raised', live ? `${fmt(live.raisedSol)} SOL` : '—'],
            ['Gifts', live ? String(live.donorCount) : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: 3 }}>{label}</span>
              <span style={{ fontSize: 48, fontWeight: 800, color: '#1d1d1f', letterSpacing: -2 }}>{value}</span>
            </div>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 24, color: '#86868b', textAlign: 'right' }}>Released only by donor vote</span>
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() }
  )
}
