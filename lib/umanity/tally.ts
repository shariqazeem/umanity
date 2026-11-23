/**
 * The Tally: Umanity's one drawing rule. A gift cuts a circle in two, like a tally stick. The giver
 * keeps the black half; the pot holds the other half in the open. When the delivery is filmed the
 * halves close. Nothing here is random: the same record always draws the same Circle, so anyone can
 * redraw a Circle from its record. Pure functions that return SVG markup; safe on server and client.
 *
 *   moment -> the turn: a 24-hour dial, noon at the top (UTC). The black half faces the hour.
 *   number -> tally strokes inside the rim of the black half: long for ten, short for one.
 *   gifts  -> one notch along the cut for every gift its giver has made, up to nine. Never the amount.
 *   state  -> 'open' while it waits; 'closed' once filmed (the held half takes the season's colour,
 *             when there is one); 'home' when it wasn't filmed (the held half is a dotted outline).
 */
export type TallyRecord = { n?: number; at?: string | Date; h?: number; gifts?: number }
export type TallyState = 'open' | 'closed' | 'home'
export type TallyOptions = {
  state?: TallyState
  /** 'plain' (paper with an ink rim), 'ink', or a colour (a season's colour, sampled from its first film) */
  held?: string
  turn?: number
  gap?: number
  slide?: number
  rim?: number
  seam?: number
  ink?: string
  paper?: string
  strokes?: boolean
}

export const INK = '#111111'
export const PAPER = '#FFFFFF'
export const MIST = '#D9E1E2'
const R = 80
const f = (x: number) => (Math.round(x * 100) / 100).toString()

export function hourOf(g: TallyRecord) {
  if (g.h != null) return g.h
  const d = g.at ? new Date(g.at) : new Date(0)
  return d.getUTCHours() + d.getUTCMinutes() / 60
}
export const turnOf = (g: TallyRecord) => ((hourOf(g) - 12) / 24) * 360

/** Notches run along the cut from the left, like a tally stick, never centred on the seam. */
export function notches(count?: number) {
  const k = Math.max(0, Math.min(count ?? 1, 9))
  return Array.from({ length: k }, (_, i) => ({ x: -R + 18 + i * 11.5, r: 4.2 }))
}
function ticks(n?: number) {
  if (!n) return []
  const all: number[] = []
  for (let i = 0; i < Math.floor(n / 10); i++) all.push(22)
  for (let i = 0; i < n % 10; i++) all.push(10)
  return all.map((L, i) => ({ phi: (i - (all.length - 1) / 2) * 7.4, L, w: 4.6 }))
}
export function givenPath(g: TallyRecord, strokes = true) {
  let d = `M${-R} 0`
  for (const b of notches(g.gifts)) d += `L${f(b.x - b.r)} 0A${f(b.r)} ${f(b.r)} 0 0 1 ${f(b.x + b.r)} 0`
  d += `L${R} 0A${R} ${R} 0 0 0 ${-R} 0Z`
  if (strokes) {
    for (const t of ticks(g.n)) {
      const p = (t.phi * Math.PI) / 180, h = t.w / 2, inset = 8
      const u = [Math.sin(p), -Math.cos(p)], v = [Math.cos(p), Math.sin(p)]
      const ro = R - inset - h, ri = R - inset - t.L + h
      const pt = (r: number, s: number) => `${f(r * u[0] + s * h * v[0])} ${f(r * u[1] + s * h * v[1])}`
      d += `M${pt(ro, 1)}L${pt(ri, 1)}A${h} ${h} 0 0 1 ${pt(ri, -1)}L${pt(ro, -1)}A${h} ${h} 0 0 1 ${pt(ro, 1)}Z`
    }
  }
  return d
}
export function heldPath(g: TallyRecord) {
  let d = `M${-R} 0`
  for (const b of notches(g.gifts)) d += `L${f(b.x - b.r)} 0A${f(b.r)} ${f(b.r)} 0 0 0 ${f(b.x + b.r)} 0`
  return d + `L${R} 0A${R} ${R} 0 0 1 ${-R} 0Z`
}

/** One Circle as an SVG group centred on 0,0 (about 100 units in radius when open). */
export function circle(g: TallyRecord, o: TallyOptions = {}) {
  const ink = o.ink ?? INK, paper = o.paper ?? PAPER, state = o.state ?? 'open'
  const open = state === 'closed' ? 0 : 1
  const slide = (o.slide ?? 10) * open
  const gap = Math.max((o.gap ?? 14) * open, o.seam ?? 2)
  const rim = o.rim ?? 7
  const turn = o.turn ?? turnOf(g)
  const hp = heldPath(g), gp = givenPath(g, o.strokes !== false)
  // The clip depends only on the held half's shape (its notches), so its id does too: identical on the
  // server and in the browser, and shared harmlessly by Circles that look the same.
  const id = `tally-held-${Math.max(0, Math.min(g.gifts ?? 1, 9))}`
  const style = o.held ?? 'plain'
  let held: string
  if (state === 'home') held = `<path d="${hp}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-dasharray="0.1 7.4" stroke-linecap="round"/>`
  else if (style === 'plain') held = `<clipPath id="${id}"><path d="${hp}"/></clipPath><path d="${hp}" fill="${paper}" stroke="${ink}" stroke-width="${rim * 2}" clip-path="url(#${id})"/>`
  else if (style === 'ink') held = `<path d="${hp}" fill="${ink}"/>`
  else held = `<path d="${hp}" fill="${style}"/>`
  return `<g transform="rotate(${f(turn)})"><g transform="translate(${f(-slide)} ${f(gap / 2)})">${held}</g><g transform="translate(${f(slide)} ${f(-gap / 2)})"><path d="${gp}" fill="${ink}" fill-rule="evenodd"/></g></g>`
}

/** A whole SVG document around a Circle. pad = half the viewBox (112 leaves room for an open Circle). */
export function circleSvg(g: TallyRecord, o: TallyOptions = {}, size = 240, pad = 112, background?: string) {
  const bg = background ? `<rect x="${-pad}" y="${-pad}" width="${pad * 2}" height="${pad * 2}" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${pad * 2} ${pad * 2}" width="${size}" height="${size}">${bg}${circle(g, o)}</svg>`
}

/** The brand mark: Circle 0, the record before any gift. Below 64 px it uses the small cut. */
export function markSvg(size = 64, ink = INK, paper = PAPER) {
  const small = size <= 64
  const o: TallyOptions = small
    ? { turn: -30, held: 'plain', gap: 24, slide: 12, rim: 13, ink, paper }
    : { turn: -30, held: 'plain', gap: 17, slide: 11, rim: 8.5, ink, paper }
  return circleSvg({ n: 0, gifts: 0 }, o, size, 118)
}
