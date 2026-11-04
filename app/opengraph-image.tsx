import { ImageResponse } from 'next/og'
import { Brand, OG_SIZE, ogFonts } from '@/lib/og/brand'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Umanity — Crypto giving, on camera.'

/** The share card for the site: the landing headline, as the app shows it. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 55%)', fontFamily: 'Inter' }}>
        <Brand right="Live on Solana" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 104, fontWeight: 900, letterSpacing: -5, lineHeight: 0.95, color: '#1d1d1f' }}>Crypto giving</span>
          <span style={{ fontSize: 104, fontWeight: 900, letterSpacing: -5, lineHeight: 0.95, color: '#d4d4d4', textDecoration: 'line-through' }}>on trust.</span>
          <span style={{ fontSize: 104, fontWeight: 900, letterSpacing: -5, lineHeight: 0.95, color: '#059669' }}>On camera.</span>
        </div>
        <div style={{ display: 'flex', gap: 28, fontSize: 26, color: '#86868b' }}>
          <span>USDC pots on Solana</span>
          <span>·</span>
          <span>Refunds by code</span>
          <span>·</span>
          <span>Filmed deliveries</span>
          <span>·</span>
          <span>Agents give via x402</span>
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() }
  )
}
