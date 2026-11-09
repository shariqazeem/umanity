/**
 * Renders Umanity's logo set from the app's own Inter files, so every size is
 * drawn crisp instead of scaled from one blurry image:
 *   public/logo.png         512  the badge: white circle, hairline ring, "Umanity" (token image, manifest, share cards)
 *   public/mark.png         512  the same badge with a bold "U", for small places (nav, headers)
 *   public/favicon.png       64  the mark
 *   app/icon.png            512  the mark (browser tabs)
 *   app/apple-icon.png      180  the mark on white, square (iOS fills transparency with black)
 *   public/apple-touch-icon.png  same as app/apple-icon.png
 *
 *   npx tsx scripts/brand-assets.ts [--preview <out.png>]
 */
import fs from 'fs'
import path from 'path'
import { createElement as h } from 'react'
import { ImageResponse } from 'next/og'

const font = (w: number) => fs.readFileSync(path.join(process.cwd(), 'lib/og/fonts', `inter-${w}.ttf`))
const fonts = [
  { name: 'Inter', data: font(600), weight: 600 as const, style: 'normal' as const },
  { name: 'Inter', data: font(800), weight: 800 as const, style: 'normal' as const },
]
const INK = '#1d1d1f'

/** The badge at `size`: a white disc with a hairline ring, holding the wordmark or the "U". */
function badge(size: number, kind: 'word' | 'mark', square = false) {
  const disc = square ? size * 0.84 : size * 0.97
  const ring = Math.max(1, size * 0.008)
  const text =
    kind === 'word'
      ? h('span', { style: { fontFamily: 'Inter', fontWeight: 600, fontSize: disc * 0.205, letterSpacing: -disc * 0.006, color: INK, marginTop: -disc * 0.012 } }, 'Umanity')
      : h('span', { style: { fontFamily: 'Inter', fontWeight: 800, fontSize: disc * 0.52, letterSpacing: 0, color: INK, marginTop: -disc * 0.04 } }, 'U')
  return h(
    'div',
    { style: { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: square ? '#ffffff' : 'transparent' } },
    h(
      'div',
      {
        style: {
          width: disc,
          height: disc,
          borderRadius: disc,
          background: '#ffffff',
          border: `${ring}px solid rgba(0,0,0,0.10)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
      text,
    ),
  )
}

async function png(el: ReturnType<typeof h>, size: number) {
  const res = new ImageResponse(el, { width: size, height: size, fonts })
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const out: [string, ReturnType<typeof h>, number][] = [
    ['public/logo.png', badge(512, 'word'), 512],
    ['public/mark.png', badge(512, 'mark'), 512],
    ['public/favicon.png', badge(64, 'mark'), 64],
    ['app/icon.png', badge(512, 'mark'), 512],
    ['app/apple-icon.png', badge(180, 'mark', true), 180],
    ['public/apple-touch-icon.png', badge(180, 'mark', true), 180],
  ]
  for (const [file, el, size] of out) {
    fs.writeFileSync(file, await png(el, size))
    console.log(`wrote ${file} (${size}px)`)
  }

  // A contact sheet to judge the set at the sizes it's really seen: 180, 96, 42, 32, 16.
  const i = process.argv.indexOf('--preview')
  if (i > 0) {
    const sizes = [180, 96, 42, 32, 16]
    const row = (kind: 'word' | 'mark', bg: string) =>
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 28, padding: 24, background: bg } }, ...sizes.map((s) => badge(s, kind)))
    const sheet = h('div', { style: { display: 'flex', flexDirection: 'column', width: 900, height: 920, background: '#f5f5f7' } }, row('word', '#ffffff'), row('mark', '#ffffff'), row('word', '#000000'), row('mark', '#000000'))
    const res = new ImageResponse(sheet, { width: 900, height: 920, fonts })
    fs.writeFileSync(process.argv[i + 1], Buffer.from(await res.arrayBuffer()))
    console.log(`preview ${process.argv[i + 1]}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
