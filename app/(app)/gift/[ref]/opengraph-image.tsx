import { ImageResponse } from 'next/og'
import { Brand, OG_SIZE, ogFonts } from '@/lib/og/brand'
import { getGiftJourney } from '@/lib/data/journey'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'A gift on Umanity, followed from wallet to delivery'
export const revalidate = 120

const LABEL: Record<string, string> = { given: 'Given', escrowed: 'Escrowed', delivery: 'Delivered', verified: 'Audited', voted: 'Voted', released: 'Released' }

/** Share card for one gift: who gave what, and how far along the six steps it is. */
export default async function Image({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const j = await getGiftJourney(decodeURIComponent(ref)).catch(() => null)
  const amount = j ? (j.route === 'x402' && j.sourceAmount ? `$${j.sourceAmount} USDC` : `${j.amountSol.toFixed(j.amountSol < 0.1 ? 3 : 2)} SOL`) : ''
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#f5f5f7', fontFamily: 'Inter' }}>
        <Brand right="Follow your gift" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <div style={{ width: 150, height: 150, borderRadius: 44, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 88, border: '1px solid rgba(0,0,0,0.05)' }}>{j?.cause.emoji ?? '💚'}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: '#86868b' }}>{j ? (j.donor.username ? `@${j.donor.username} gave` : 'Someone gave') : 'A gift on Umanity'}</span>
            <span style={{ fontSize: 80, fontWeight: 900, letterSpacing: -3, color: '#1d1d1f', lineHeight: 1.05 }}>{amount}</span>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, color: '#059669' }}>{j ? `to ${j.cause.name}` : 'Crypto giving, on proof.'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {(j?.steps ?? []).map((s) => (
            <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 12, borderRadius: 6, background: s.state === 'done' ? '#10b981' : s.state === 'active' ? '#fbbf24' : 'rgba(0,0,0,0.08)' }} />
              <span style={{ fontSize: 22, fontWeight: 700, color: s.state === 'done' ? '#047857' : s.state === 'active' ? '#b45309' : '#aeaeb2' }}>{LABEL[s.key]}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() }
  )
}
