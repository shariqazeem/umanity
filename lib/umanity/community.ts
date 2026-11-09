/**
 * Community drops: anyone, anywhere, can propose a drop they will run themselves.
 *
 * A proposal stays off-chain until the team approves it. Then the server opens
 * it on Solana with the runner as its payee, so the program pays the runner
 * only after filmed proof and the review window, and refunds every backer if
 * the date passes without it. Runners send their proof here; the team checks
 * it and posts it on-chain. Fees work as for every drop: gifts go 100% to the
 * pot, fees split 50/50. Server-only.
 */
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import { and, desc, eq } from 'drizzle-orm'
import { dropProposals, drops, getDb, newId, proofSubmissions } from '@/lib/db'
import type { MediaItem } from '@/lib/db/schema'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { createDrop, postProof } from './admin'
import { listTotal, validateMeta, type DropMeta } from './drops'
import { fetchConfig, fetchDrop } from './program'

const DAY = 86_400_000
/** A runner can have this many proposals waiting at once. */
const MAX_PENDING = 3

export type ProposalInput = { meta: DropMeta; goalUsd: number; capUsd: number; deadline: string; contact: string }

export async function createProposal(conn: Connection, proposer: string, p: ProposalInput) {
  new PublicKey(proposer)
  const meta: DropMeta = { ...p.meta, v: 1 }
  const problem = validateMeta(meta)
  if (problem) throw new Error(problem)
  const goal = Number(p.goalUsd)
  const cap = Number(p.capUsd || p.goalUsd)
  const config = await fetchConfig(conn)
  const maxPot = config ? config.maxPot : 2000
  if (!(goal >= 10)) throw new Error('The goal must be at least $10')
  if (!(cap >= goal) || cap > maxPot) throw new Error(`The cap must be between the goal and $${maxPot.toLocaleString('en-US')}`)
  if (Math.abs(listTotal(meta.items) - goal) > Math.max(1, goal * 0.02)) throw new Error('The goal must match the shopping list total')
  const deadline = new Date(p.deadline)
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now() + 3 * DAY || deadline.getTime() > Date.now() + 90 * DAY) {
    throw new Error('The delivery date must be between 3 and 90 days away')
  }
  const contact = String(p.contact ?? '').trim().slice(0, 200)
  if (contact.length < 3) throw new Error('Add how the team can reach you (X, Instagram, email or phone)')

  const db = await getDb()
  const pending = await db
    .select({ id: dropProposals.id })
    .from(dropProposals)
    .where(and(eq(dropProposals.cluster, SOLANA_CLUSTER), eq(dropProposals.proposer, proposer), eq(dropProposals.status, 'pending')))
  if (pending.length >= MAX_PENDING) throw new Error(`You have ${MAX_PENDING} proposals waiting already`)

  const id = newId('prop')
  await db.insert(dropProposals).values({ id, cluster: SOLANA_CLUSTER, proposer, meta, goalCents: Math.round(goal * 100), capCents: Math.round(cap * 100), deadline, contact })
  return { id }
}

export async function myProposals(proposer: string) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(dropProposals)
    .where(and(eq(dropProposals.cluster, SOLANA_CLUSTER), eq(dropProposals.proposer, proposer)))
    .orderBy(desc(dropProposals.createdAt))
    .limit(20)
  return rows.map(publicProposal)
}

export async function reviewQueue() {
  const db = await getDb()
  const [proposals, submissions] = await Promise.all([
    db.select().from(dropProposals).where(eq(dropProposals.cluster, SOLANA_CLUSTER)).orderBy(desc(dropProposals.createdAt)).limit(40),
    db.select().from(proofSubmissions).where(eq(proofSubmissions.cluster, SOLANA_CLUSTER)).orderBy(desc(proofSubmissions.createdAt)).limit(40),
  ])
  return { proposals: proposals.map((p) => ({ ...publicProposal(p), proposer: p.proposer, contact: p.contact })), submissions }
}

function publicProposal(p: typeof dropProposals.$inferSelect) {
  const meta = p.meta as unknown as DropMeta
  return {
    id: p.id,
    title: meta.title,
    place: meta.place,
    emoji: meta.emoji,
    meta,
    goalUsd: p.goalCents / 100,
    capUsd: p.capCents / 100,
    deadline: p.deadline.toISOString(),
    status: p.status,
    reason: p.reason,
    dropId: p.dropId,
    createdAt: p.createdAt.toISOString(),
  }
}

/** The team opens an approved proposal on Solana, with the runner as payee. */
export async function approveProposal(conn: Connection, id: string) {
  const db = await getDb()
  const p = (await db.select().from(dropProposals).where(eq(dropProposals.id, id)))[0]
  if (!p || p.status !== 'pending') throw new Error('This proposal is not waiting for review')
  const out = await createDrop(conn, { meta: p.meta as unknown as DropMeta, goalUsd: p.goalCents / 100, capUsd: p.capCents / 100, deadline: p.deadline, payee: p.proposer, kind: 'community', proposalId: p.id })
  await db.update(dropProposals).set({ status: 'approved', dropId: out.id, reviewedAt: new Date() }).where(eq(dropProposals.id, id))
  return out
}

export async function rejectProposal(id: string, reason: string) {
  const db = await getDb()
  await db.update(dropProposals).set({ status: 'rejected', reason: reason.trim().slice(0, 300) || null, reviewedAt: new Date() }).where(eq(dropProposals.id, id))
}

const mediaKind = (url: string): MediaItem['kind'] => (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url) ? 'photo' : /\.(mp4|mov|webm)(\?|#|$)/i.test(url) ? 'video' : 'document')

/** A community runner sends proof for their own drop; the team checks it, then posts it on-chain. */
export async function submitProof(conn: Connection, runner: string, dropId: number, s: { title: string; body: string; xPostUrl?: string | null; links: string[] }) {
  const db = await getDb()
  const row = (await db.select().from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.id, dropId))))[0]
  if (!row || row.kind !== 'community') throw new Error('Only community drops take proof from their runner')
  if (row.payee !== runner) throw new Error('Only the drop’s runner can send its proof')
  const chain = await fetchDrop(conn, dropId)
  if (!chain || (chain.state !== 'open' && chain.state !== 'proven')) throw new Error('This drop is closed')
  if (Date.now() / 1000 > chain.deadline) throw new Error('The delivery date has passed')
  const links = s.links.map((l) => l.trim()).filter((l) => /^https:\/\//.test(l)).slice(0, 10)
  const xPostUrl = s.xPostUrl && /^https:\/\/(x|twitter)\.com\//.test(s.xPostUrl) ? s.xPostUrl : null
  if (!links.length && !xPostUrl) throw new Error('Add links to the receipt and photos, or the X post of the delivery')
  const title = s.title.trim().slice(0, 120)
  if (!title) throw new Error('Say what was delivered')
  const id = newId('subm')
  await db.insert(proofSubmissions).values({ id, cluster: SOLANA_CLUSTER, dropId, runner, title, body: s.body.trim().slice(0, 4000), xPostUrl, links })
  return { id }
}

export async function postSubmission(conn: Connection, id: string, postedBy: string) {
  const db = await getDb()
  const sub = (await db.select().from(proofSubmissions).where(eq(proofSubmissions.id, id)))[0]
  if (!sub || sub.status !== 'pending') throw new Error('This proof is not waiting')
  const media: MediaItem[] = sub.links.map((url) => ({ url, kind: mediaKind(url) }))
  const out = await postProof(conn, { dropId: sub.dropId, title: sub.title, body: sub.body, media, xPostUrl: sub.xPostUrl, postedBy })
  await db.update(proofSubmissions).set({ status: 'posted' }).where(eq(proofSubmissions.id, id))
  return out
}

export async function rejectSubmission(id: string, reason: string) {
  const db = await getDb()
  await db.update(proofSubmissions).set({ status: 'rejected', reason: reason.trim().slice(0, 300) || null }).where(eq(proofSubmissions.id, id))
}
