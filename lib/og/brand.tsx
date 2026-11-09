/**
 * Shared pieces for the Open Graph cards (1200×630 PNG via next/og). The look
 * follows the app: #f5f5f7 canvas, white card, #1d1d1f ink, one emerald accent.
 */
import fs from 'fs'
import path from 'path'

export const OG_SIZE = { width: 1200, height: 630 }

type Weight = 400 | 600 | 800 | 900
let fonts: { name: string; data: Buffer; weight: Weight; style: 'normal' }[] | null = null
/** Inter at the weights the cards use (Satori only bundles a regular sans). OFL, from fontsource. */
export function ogFonts() {
  if (!fonts) {
    fonts = ([400, 600, 800, 900] as Weight[]).map((weight) => ({ name: 'Inter', data: fs.readFileSync(path.join(process.cwd(), 'lib', 'og', 'fonts', `inter-${weight}.ttf`)), weight, style: 'normal' as const }))
  }
  return fonts
}

let logo: string | null = null
/** The round "U" mark as a data URL (read once from /public). Cards set it beside the word "Umanity", so not the wordmark badge. */
export function logoDataUrl(): string {
  if (!logo) {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'mark.png'))
    logo = `data:image/png;base64,${buf.toString('base64')}`
  }
  return logo
}

export function Brand({ right }: { right?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUrl()} width={56} height={56} style={{ borderRadius: 28 }} alt="" />
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: '#1d1d1f' }}>Umanity</span>
      </div>
      {right && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 22, fontWeight: 700 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#10b981' }} />
          {right}
        </div>
      )}
    </div>
  )
}
