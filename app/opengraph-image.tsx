import { ImageResponse } from 'next/og'
import { Brand, INK, MIST, OG_SIZE, brandFonts, svgDataUrl } from '@/lib/og/brand'
import { circleSvg } from '@/lib/umanity/tally'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Umanity — Nothing given in the dark.'

/** The share card for the site, in The Tally: the open circle, the mission line, the rule. */
export default async function Image() {
  const open = svgDataUrl(circleSvg({ n: 0, gifts: 0 }, { turn: -30, held: 'plain', gap: 14, slide: 10, rim: 6.5 }, 620, 112))
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: MIST, color: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={open} width={580} height={580} alt="" style={{ position: "absolute", left: 730, top: 70 }} />
        <div style={{ position: 'absolute', left: 64, top: 56, right: 64, display: 'flex' }}>
          <Brand right="Live on Solana" />
        </div>
        <div style={{ position: 'absolute', left: 64, top: 210, display: 'flex', flexDirection: 'column', fontFamily: 'Anek Latin', fontWeight: 800, fontSize: 92, letterSpacing: -3, lineHeight: 0.95 }}>
          <span>Nothing given</span>
          <span>in the dark.</span>
        </div>
        <div style={{ position: 'absolute', left: 64, bottom: 56, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'Martian Mono', fontSize: 19, fontWeight: 400, letterSpacing: 1 }}>
          <span>EVERY GIFT WAITS UNTIL THE DELIVERY IS FILMED.</span>
          <span>IF IT ISN'T, IT GOES HOME.</span>
        </div>
      </div>
    ),
    { ...size, fonts: await brandFonts() }
  )
}
