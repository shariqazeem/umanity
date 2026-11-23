/**
 * Shared pieces for the share images and Circle cards (PNG via next/og), in The Tally: paper and mist
 * grounds, #111 ink, the cut-circle mark, Anek Latin for words and Martian Mono for records.
 */
import fs from 'fs'
import path from 'path'
import { markSvg } from '@/lib/umanity/tally'

export const OG_SIZE = { width: 1200, height: 630 }
export const INK = '#111111'
export const MIST = '#D9E1E2'

type Font = { name: string; data: ArrayBuffer | Buffer; weight: 400 | 600 | 800; style: 'normal' }

/** One weight of a Google font as TrueType (Satori can't read woff2). Null if it can't be fetched. */
async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
    if (!url) return null
    const res = await fetch(url)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

let cached: Font[] | null = null
/** Anek Latin 800 and Martian Mono 400/600 (OFL), fetched once; the bundled Inter stands in if Google can't be reached. */
export async function brandFonts(): Promise<Font[]> {
  if (cached) return cached
  const [anek, mono4, mono6] = await Promise.all([googleFont('Anek Latin', 800), googleFont('Martian Mono', 400), googleFont('Martian Mono', 600)])
  const inter = (w: number) => fs.readFileSync(path.join(process.cwd(), 'lib', 'og', 'fonts', `inter-${w}.ttf`))
  const fonts: Font[] = [
    { name: 'Anek Latin', data: anek ?? inter(800), weight: 800, style: 'normal' },
    { name: 'Martian Mono', data: mono4 ?? inter(400), weight: 400, style: 'normal' },
    { name: 'Martian Mono', data: mono6 ?? inter(600), weight: 600, style: 'normal' },
  ]
  if (anek && mono4 && mono6) cached = fonts
  return fonts
}

/** An SVG string as a data URL that Satori can draw. */
export const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

export function Brand({ right }: { right?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgDataUrl(markSvg(58))} width={58} height={58} alt="" />
        <span style={{ fontFamily: 'Anek Latin', fontSize: 42, fontWeight: 800, letterSpacing: -1, color: INK }}>umanity</span>
      </div>
      {right && <span style={{ fontFamily: 'Martian Mono', fontSize: 19, fontWeight: 600, letterSpacing: 1, color: INK }}>{right.toUpperCase()}</span>}
    </div>
  )
}
