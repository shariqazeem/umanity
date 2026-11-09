'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { walletFetch } from '@/lib/client/admin'
import { listTotal, usdText } from '@/lib/umanity/drops'
import { dropHref } from './DropParts'

type Item = { name: string; qty: number; unitUsd: number }
type Proposal = { id: string; title: string; place: string; emoji: string; goalUsd: number; deadline: string; status: string; reason: string | null; dropId: number | null; createdAt: string }

const blank = (): Item => ({ name: '', qty: 1, unitUsd: 0 })
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

const RULES: [string, string][] = [
  ['🎥', 'You are paid only after your delivery is filmed and checked: the receipt, the goods and the handover.'],
  ['↩︎', 'Miss your date and every giver gets their money back, by code.'],
  ['✓', 'The Umanity team reviews each drop before it opens, and checks each proof before it pays.'],
  ['⚖️', 'Same rules as Umanity’s own drops: gifts go 100% to the pot, and Umanity takes nothing from them.'],
]

/** Anyone, anywhere, can run a drop: propose it, deliver it, film it, get paid from its pot. */
export function StartDrop() {
  const { signer, openAuth, toast } = useUmanity()
  const [f, setF] = useState({ emoji: '🍲', title: '', place: '', story: '', unitName: 'food pack', unitUsd: '25', people: '5', covers: 'a family of five for a week', deadline: inDays(14), cap: '', contact: '' })
  const [items, setItems] = useState<Item[]>([blank()])
  const [busy, setBusy] = useState(false)
  const [mine, setMine] = useState<Proposal[] | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const list = items.filter((i) => i.name.trim() && i.qty > 0 && i.unitUsd > 0)
  const goal = Math.round(listTotal(list) * 100) / 100

  const load = useCallback(async () => {
    if (!signer?.signMessage) return
    const r = await walletFetch<{ proposals?: Proposal[] }>(signer, '/api/proposals', { method: 'GET' }).catch(() => null)
    setMine(r?.proposals ?? [])
  }, [signer])
  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!signer) return openAuth()
    setBusy(true)
    const r = await walletFetch<{ id?: string; error?: string }>(signer, '/api/proposals', {
      body: {
        meta: { title: f.title.trim(), place: f.place.trim(), story: f.story.trim(), emoji: f.emoji || '🍲', unit: { name: f.unitName.trim(), usd: Number(f.unitUsd), people: Number(f.people) || 0, covers: f.covers.trim() }, items: list },
        goalUsd: goal,
        capUsd: Number(f.cap) || goal,
        deadline: new Date(`${f.deadline}T18:00:00Z`).toISOString(),
        contact: f.contact,
      },
    }).catch((e): { id?: string; error?: string } => ({ error: (e as Error).message }))
    setBusy(false)
    if (r.id) {
      toast('Sent. The team reviews it and replies to your contact.', 'ok')
      setF((x) => ({ ...x, title: '', story: '' }))
      setItems([blank()])
      load()
    } else toast(r.error || 'Could not send it', 'err')
  }

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Start a drop</p>
        <h1 className="text-[28px] md:text-[34px] font-black tracking-[-0.035em] leading-[1.05] mt-1 [text-wrap:balance]">Run a drop where you live</h1>
        <p className="text-[14px] text-[#86868b] mt-2 max-w-xl [text-wrap:balance]">Food, blankets, medicine, school kits: anything you can buy, hand over and film. People anywhere fill your pot.</p>
      </header>

      <section className="card p-5 grid sm:grid-cols-2 gap-3">
        {RULES.map(([icon, text]) => (
          <div key={text} className="flex gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-[15px] flex-shrink-0">{icon}</span>
            <p className="text-[13px] text-[#525252] leading-snug">{text}</p>
          </div>
        ))}
      </section>

      {mine && mine.length > 0 && <MyProposals mine={mine} onSent={load} />}

      <section className="card p-5 space-y-3">
        <h2 className="font-bold text-[16px]">Your drop</h2>
        <div className="grid grid-cols-[64px_1fr] gap-2">
          <input value={f.emoji} onChange={set('emoji')} className="input text-center !text-[20px]" aria-label="Emoji" />
          <input value={f.title} onChange={set('title')} placeholder="Food packs for 10 families" className="input" />
        </div>
        <input value={f.place} onChange={set('place')} placeholder="Where: area, city, country" className="input w-full" />
        <textarea value={f.story} onChange={set('story')} rows={3} placeholder="Who it helps, how you found them, and how you'll deliver and film it" className="input w-full" />

        <p className="text-[12px] font-semibold text-[#86868b] pt-1">What one unit is</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input value={f.unitName} onChange={set('unitName')} placeholder="Unit (food pack)" className="input" />
          <input value={f.unitUsd} onChange={set('unitUsd')} inputMode="decimal" placeholder="$ per unit" className="input" />
          <input value={f.people} onChange={set('people')} inputMode="numeric" placeholder="People per unit" className="input" />
          <input value={f.covers} onChange={set('covers')} placeholder="What one covers" className="input" />
        </div>

        <p className="text-[12px] font-semibold text-[#86868b] pt-1">Shopping list, at local prices in USD</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_88px_32px] gap-2 items-center">
              <input value={it.name} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Rice, 5 kg" className="input" />
              <input value={it.qty} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value) || 0 } : y)))} inputMode="numeric" className="input text-center" aria-label="Quantity" />
              <input value={it.unitUsd || ''} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, unitUsd: Number(e.target.value) || 0 } : y)))} inputMode="decimal" placeholder="$ each" className="input" />
              <button onClick={() => setItems((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))} className="hit text-[#aeaeb2] hover:text-[#1d1d1f]" aria-label="Remove item">
                ✕
              </button>
            </div>
          ))}
          <button onClick={() => setItems((x) => [...x, blank()])} className="text-[12.5px] font-semibold text-[#1d1d1f] hover:underline">
            + Add an item
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-2 pt-1">
          <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <p className="text-[11px] text-[#86868b]">Goal (the list total)</p>
            <p className="text-[18px] font-black counter">{usdText(goal, 2)}</p>
          </div>
          <label className="text-[11px] font-semibold text-[#86868b]">
            Most it can hold
            <input value={f.cap} onChange={set('cap')} inputMode="decimal" placeholder={goal ? `${Math.ceil(goal * 1.5)}` : '$'} className="input w-full mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#86868b]">
            Delivered by
            <input type="date" value={f.deadline} onChange={set('deadline')} min={inDays(3)} max={inDays(90)} className="input w-full mt-1" />
          </label>
        </div>
        <input value={f.contact} onChange={set('contact')} placeholder="How the team can reach you: X, Instagram, email or phone" className="input w-full" />
        <button onClick={submit} disabled={busy || (signer != null && (!f.title.trim() || !f.place.trim() || goal < 10))} className="btn-primary w-full py-3.5 !text-[15px]">
          {!signer ? 'Sign in to send it' : busy ? 'Sending…' : `Send for review · ${usdText(goal, 2)}`}
        </button>
        <p className="text-[11px] text-[#aeaeb2] text-center">The pot pays your wallet ({signer ? `${signer.publicKey.toBase58().slice(0, 4)}…${signer.publicKey.toBase58().slice(-4)}` : 'the one you sign in with'}) after proof. Umanity drops are listed first; community drops have their own section.</p>
      </section>
    </div>
  )
}

const STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: 'Waiting for review', tone: 'bg-amber-50 text-amber-800' },
  approved: { text: 'Live', tone: 'bg-emerald-50 text-emerald-700' },
  rejected: { text: 'Not approved', tone: 'bg-[#f5f5f7] text-[#86868b]' },
}

function MyProposals({ mine, onSent }: { mine: Proposal[]; onSent: () => void }) {
  const [proofFor, setProofFor] = useState<number | null>(null)
  return (
    <section className="card p-5">
      <h2 className="font-bold text-[16px] mb-2">Your drops</h2>
      <ul className="divide-y divide-black/[0.04]">
        {mine.map((p) => {
          const s = STATUS[p.status] ?? STATUS.pending
          return (
            <li key={p.id} className="py-3">
              <div className="flex items-center gap-3">
                <span className="text-[20px]">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold truncate">{p.title}</p>
                  <p className="text-[11.5px] text-[#86868b]">
                    {p.place} · {usdText(p.goalUsd, 0)}
                    {p.reason && ` · ${p.reason}`}
                  </p>
                </div>
                <span className={`text-[10.5px] font-bold rounded-full px-2 py-0.5 ${s.tone}`}>{s.text}</span>
              </div>
              {p.status === 'approved' && p.dropId != null && (
                <div className="flex gap-4 mt-2 ml-9 text-[12px]">
                  <Link href={dropHref(p.dropId)} className="font-semibold text-emerald-600 hover:underline">
                    See the drop →
                  </Link>
                  <button onClick={() => setProofFor(proofFor === p.dropId ? null : p.dropId)} className="font-semibold text-[#1d1d1f] hover:underline">
                    Send proof
                  </button>
                </div>
              )}
              {proofFor === p.dropId && p.dropId != null && <ProofForm dropId={p.dropId} onSent={() => (setProofFor(null), onSent())} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ProofForm({ dropId, onSent }: { dropId: number; onSent: () => void }) {
  const { signer, toast } = useUmanity()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [xPostUrl, setX] = useState('')
  const [links, setLinks] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!signer) return
    setBusy(true)
    const r = await walletFetch<{ id?: string; error?: string }>(signer, `/api/drops/${dropId}/proof-submissions`, { body: { title, body, xPostUrl: xPostUrl.trim() || null, links: links.split(/\s+/).filter(Boolean) } }).catch((e): { id?: string; error?: string } => ({ error: (e as Error).message }))
    setBusy(false)
    if (r.id) {
      toast('Proof sent. The team checks it, posts it on-chain, and the pot pays after the review.', 'ok')
      onSent()
    } else toast(r.error || 'Could not send it', 'err')
  }
  return (
    <div className="mt-3 ml-9 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Delivered: 10 food packs in …" className="input w-full" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="What you bought, who received it, anything that changed" className="input w-full" />
      <input value={xPostUrl} onChange={(e) => setX(e.target.value)} placeholder="X post with the video (https://x.com/…)" className="input w-full" />
      <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="Links to the receipt and photos (https://…), one per line" className="input w-full" />
      <button onClick={send} disabled={busy || !title.trim()} className="btn-primary w-full py-3 !text-[14px]">
        {busy ? 'Sending…' : 'Send proof for review'}
      </button>
    </div>
  )
}
