/**
 * Drop descriptions and the words amounts are shown in.
 *
 * A drop's description (title, place, story, shopping list) lives off-chain,
 * but its sha256 is stored in the drop on-chain, so the page can show that
 * nothing was edited after people gave. `canonicalJson` fixes the bytes that
 * get hashed. Browser-safe.
 */
import type { DropItem } from '@/lib/db/schema'

export type DropMeta = {
  v: 1
  title: string
  place: string
  story: string
  emoji: string
  /** What amounts are counted in: "ration pack", $30, feeds 5 people for a month. */
  unit: { name: string; usd: number; people: number; covers: string }
  items: DropItem[]
}

/** JSON with object keys sorted at every level, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(new TextEncoder().encode(text)))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '')
  if (!/^[0-9a-f]*$/i.test(clean) || clean.length % 2) throw new Error('bad hex')
  return Uint8Array.from(clean.match(/../g) ?? [], (b) => parseInt(b, 16))
}

/** Checks a description against the hash a drop carries on-chain. */
export async function metaMatches(meta: string, onChainHash: string) {
  return (await sha256Hex(meta)) === onChainHash.toLowerCase()
}

export function validateMeta(m: DropMeta): string | null {
  if (m.v !== 1) return 'v must be 1'
  if (!m.title?.trim() || m.title.length > 80) return 'title: 1-80 characters'
  if (!m.place?.trim() || m.place.length > 80) return 'place: 1-80 characters'
  if (m.story.length > 2_000) return 'story: at most 2,000 characters'
  // people may be 0 for drops that don't feed people directly (or demos): the app then never claims anyone was helped.
  if (!m.unit?.name || !(m.unit.usd > 0) || !(m.unit.people >= 0)) return 'unit needs a name, a price and people helped (0 if none)'
  if (!m.items?.length) return 'the shopping list is empty'
  for (const it of m.items) {
    if (!it.name || !(it.unitUsd > 0) || !(it.qty > 0)) return `item "${it.name}": needs a name, price and quantity`
  }
  return null
}

/** Total of the shopping list, in USD. */
export const listTotal = (items: DropItem[]) => items.reduce((s, it) => s + it.unitUsd * it.qty, 0)

/** "$60 → 2 ration packs, 10 people fed for a month" */
export function amountInUnits(usdAmount: number, unit: DropMeta['unit']) {
  const units = usdAmount / unit.usd
  const whole = Math.floor(units + 1e-9)
  const people = Math.floor(units * unit.people + 1e-9)
  return { units, whole, people }
}

/** ", 10 people helped", or nothing for drops that don't count people. */
export function helpedText(people: number, perUnit: number) {
  return perUnit > 0 ? `, ${plural(Math.floor(people + 1e-9), 'person', 'people')} helped` : ''
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

export const usdText = (n: number, digits = n % 1 === 0 ? 0 : 2) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
