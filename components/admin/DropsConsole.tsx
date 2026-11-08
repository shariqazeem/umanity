'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Signer } from '@/components/providers/UmanityProvider'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Card, Pill } from '@/components/shared/ui'
import { adminFetch } from '@/lib/client/admin'
import { explorerTx } from '@/lib/solana/constants'
import { listTotal, usdText, type DropMeta } from '@/lib/umanity/drops'
import type { DropView } from '@/lib/umanity/data'
import { useDrops } from '@/components/drops/hooks'
import { STATE_LABEL, dayText, dropHref } from '@/components/drops/DropParts'
import { MediaUploader, type UploadItem } from './MediaUploader'

type Result = { error?: string; signature?: string; id?: number | string; sent?: number; signatures?: string[] }

/** The team's console for drops: open one, post what happened, unlock after review. */
export function DropsConsole({ signer }: { signer: Signer }) {
  const { data: drops, reload } = useDrops(10_000)
  const [creating, setCreating] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-tight">Drops</h2>
        <button onClick={() => setCreating((v) => !v)} className={creating ? 'btn-secondary px-4 py-2 !text-[13px]' : 'btn-primary px-4 py-2 !text-[13px]'}>
          {creating ? 'Close' : '+ New drop'}
        </button>
      </div>
      {creating && (
        <Card className="p-5 sm:p-6">
          <NewDrop signer={signer} onCreated={() => (setCreating(false), reload())} />
        </Card>
      )}
      {drops && drops.length === 0 && !creating && <Card className="p-8 text-center text-[13px] text-[#86868b]">No drops on this cluster yet.</Card>}
      {drops?.map((d) => (
        <DropAdmin key={d.id} signer={signer} drop={d} onChange={reload} />
      ))}
    </div>
  )
}

const blankItem = () => ({ name: '', qty: 1, unitUsd: 0 })

function NewDrop({ signer, onCreated }: { signer: Signer; onCreated: () => void }) {
  const { toast } = useUmanity()
  const [f, setF] = useState({ title: '', place: '', emoji: '🍲', story: '', unitName: 'ration pack', unitUsd: 30, people: 5, covers: 'a family of five for a month', payee: '', deadline: '', goal: '', cap: '' })
  const [items, setItems] = useState([blankItem()])
  const [busy, setBusy] = useState(false)
  const total = listTotal(items.filter((i) => i.name && i.unitUsd > 0 && i.qty > 0))
  const goal = Number(f.goal) || total
  const cap = Number(f.cap) || Math.ceil(goal * 1.2)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async () => {
    const meta: DropMeta = {
      v: 1,
      title: f.title.trim(),
      place: f.place.trim(),
      story: f.story.trim(),
      emoji: f.emoji.trim() || '🍲',
      unit: { name: f.unitName.trim(), usd: Number(f.unitUsd), people: Number(f.people), covers: f.covers.trim() },
      items: items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), qty: Number(i.qty), unitUsd: Number(i.unitUsd) })),
    }
    setBusy(true)
    try {
      const r = await adminFetch<Result>(signer, '/api/admin/drops', { body: { action: 'create', meta, goalUsd: goal, capUsd: cap, deadline: new Date(f.deadline).toISOString(), payee: f.payee.trim() } })
      if (r.error) throw new Error(r.error)
      toast(`Drop #${Number(r.id) + 1} is open`, 'ok')
      onCreated()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[#86868b]">The description below is hashed and the hash goes on-chain with the drop, so it can&apos;t be changed quietly later. Money can only ever go to the payee, and only after proof.</p>
      <div className="grid sm:grid-cols-[64px_1fr] gap-2">
        <input value={f.emoji} onChange={set('emoji')} className="input text-center !text-[20px]" aria-label="Emoji" />
        <input value={f.title} onChange={set('title')} placeholder="Ration packs for 25 families" className="input" />
      </div>
      <input value={f.place} onChange={set('place')} placeholder="Where (area, city)" className="input w-full" />
      <textarea value={f.story} onChange={set('story')} rows={3} placeholder="Who it is for, how they were found, who delivers and films it" className="input w-full resize-none" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input value={f.unitName} onChange={set('unitName')} placeholder="Unit (ration pack)" className="input" />
        <input value={f.unitUsd} onChange={set('unitUsd')} inputMode="decimal" placeholder="$ per unit" className="input" />
        <input value={f.people} onChange={set('people')} inputMode="numeric" placeholder="People per unit (0 if none)" title="0 hides the 'people helped' count, e.g. for animals or a demo" className="input" />
        <input value={f.covers} onChange={set('covers')} placeholder="What one covers" className="input" />
      </div>
      <div className="rounded-2xl bg-[#f5f5f7] p-3 space-y-2">
        <p className="text-[11px] font-semibold text-[#86868b]">Shopping list · total {usdText(total, 2)}</p>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_90px_32px] gap-2">
            <input value={it.name} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Flour, 10 kg" className="input !bg-white" />
            <input value={it.qty} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value) || 0 } : y)))} inputMode="numeric" className="input !bg-white" aria-label="Quantity" />
            <input value={it.unitUsd || ''} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, unitUsd: Number(e.target.value) || 0 } : y)))} inputMode="decimal" placeholder="$ each" className="input !bg-white" />
            <button onClick={() => setItems((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))} className="text-[#aeaeb2] hover:text-[#1d1d1f]" aria-label="Remove">
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => setItems((x) => [...x, blankItem()])} className="text-[12px] font-semibold text-[#1d1d1f] hover:underline">
          + Add item
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={f.goal} onChange={set('goal')} inputMode="decimal" placeholder={`Goal $ (list: ${total})`} className="input" />
        <input value={f.cap} onChange={set('cap')} inputMode="decimal" placeholder={`Cap $ (${Math.ceil(goal * 1.2)})`} className="input" />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-[#86868b]">
          Deliver and prove by
          <input type="datetime-local" value={f.deadline} onChange={set('deadline')} className="input w-full mt-1" />
        </label>
        <label className="text-[11px] font-semibold text-[#86868b]">
          Payee (supplier or delivery wallet)
          <input value={f.payee} onChange={set('payee')} placeholder="Solana address" className="input w-full mt-1 font-mono !text-[12px]" />
        </label>
      </div>
      <button onClick={submit} disabled={busy || !f.title || !f.place || !f.deadline || !f.payee || total <= 0} className="btn-primary w-full py-3 !text-[14px]">
        {busy ? 'Opening the drop…' : `Open the drop · goal ${usdText(goal, 0)}, cap ${usdText(cap, 0)}`}
      </button>
    </div>
  )
}

function DropAdmin({ signer, drop, onChange }: { signer: Signer; drop: DropView; onChange: () => void }) {
  const { toast } = useUmanity()
  const [mode, setMode] = useState<'update' | 'proof' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const now = Date.now() / 1000
  const live = drop.state === 'open' || drop.state === 'proven'

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (action === 'cancel' && !confirm(`Call off Drop #${drop.id + 1}? Every backer gets refunded. This can't be undone.`)) return
    setBusy(action)
    try {
      const r = await adminFetch<Result>(signer, '/api/admin/drops', { body: { action, dropId: drop.id, ...extra } })
      if (r.error) throw new Error(r.error)
      toast(action === 'refund' ? `Refunded ${r.sent ?? 0} backers` : 'Done', 'ok')
      setMode(null)
      onChange()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[14px] bg-[#f5f5f7] flex items-center justify-center text-[22px] flex-shrink-0">{drop.emoji}</div>
        <div className="flex-1 min-w-0">
          <Link href={dropHref(drop.id)} className="text-[15px] font-bold tracking-tight hover:underline">
            #{drop.id + 1} {drop.title}
          </Link>
          <p className="text-[12px] text-[#86868b]">
            {usdText(drop.potUsd, 2)} of {usdText(drop.goalUsd, 0)} · {drop.backers} backers · by {dayText(drop.deadline)}
          </p>
        </div>
        <Pill tone={drop.refundsOpen ? 'amber' : drop.state === 'unlocked' ? 'green' : 'gray'}>{drop.refundsOpen ? 'Refunding' : STATE_LABEL[drop.state]}</Pill>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => setMode(mode === 'update' ? null : 'update')} className="btn-secondary px-3 py-2 !text-[12.5px]">
          Post update
        </button>
        {live && now <= drop.deadline && (
          <button onClick={() => setMode(mode === 'proof' ? null : 'proof')} className="btn-primary px-3 py-2 !text-[12.5px]">
            {drop.state === 'proven' ? 'Post new proof' : 'Post proof'}
          </button>
        )}
        {drop.state === 'proven' && (
          <button onClick={() => act('unlock')} disabled={!!busy} className="btn-primary px-3 py-2 !text-[12.5px]">
            {busy === 'unlock' ? 'Unlocking…' : 'Unlock to payee'}
          </button>
        )}
        {drop.refundsOpen && drop.potUsd > 0 && (
          <button onClick={() => act('refund')} disabled={!!busy} className="btn-secondary px-3 py-2 !text-[12.5px]">
            {busy === 'refund' ? 'Refunding…' : 'Refund everyone now'}
          </button>
        )}
        {live && (
          <button onClick={() => act('cancel')} disabled={!!busy} className="px-3 py-2 text-[12.5px] font-semibold text-red-600 hover:underline">
            Call off
          </button>
        )}
        {drop.unlockTx && (
          <a href={explorerTx(drop.unlockTx)} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-[12.5px] font-semibold text-emerald-600 hover:underline">
            Unlock tx ↗
          </a>
        )}
      </div>
      {drop.state === 'proven' && <p className="text-[11.5px] text-[#86868b] mt-2">Unlocking works once the review window after the proof has passed; the program refuses it before then.</p>}
      {mode && <PostForm signer={signer} kind={mode} busy={busy === mode} onSubmit={(body) => act(mode, body)} />}
    </Card>
  )
}

function PostForm({ signer, kind, busy, onSubmit }: { signer: Signer; kind: 'update' | 'proof'; busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [xPostUrl, setX] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const uploading = items.some((i) => i.status === 'uploading')
  const media = items.filter((i) => i.status === 'done' && i.url).map((i) => ({ url: i.url!, kind: i.kind, sha256: i.sha256, note: i.note || undefined }))
  return (
    <div className="mt-4 pt-4 border-t border-black/[0.05] space-y-2.5">
      <p className="text-[12px] text-[#86868b]">
        {kind === 'proof'
          ? 'Proof starts the review window. The text, the X post and every file hash are bundled, hashed, and the hash is written on-chain.'
          : 'Updates show on the drop and in the feed. They move no money.'}
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'proof' ? 'Delivered: 25 ration packs in Lyari' : 'Packing day'} className="input w-full" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What happened, who received it, anything that changed" className="input w-full resize-none" />
      <input value={xPostUrl} onChange={(e) => setX(e.target.value)} placeholder="X post with the video (https://x.com/umanity_xyz/status/…)" className="input w-full" />
      <MediaUploader signer={signer} items={items} onChange={setItems} />
      <button onClick={() => onSubmit({ title, body, xPostUrl: xPostUrl || undefined, media })} disabled={busy || uploading || !title.trim()} className="btn-primary w-full py-3 !text-[14px]">
        {busy ? 'Posting…' : kind === 'proof' ? 'Post proof on-chain' : 'Post update'}
      </button>
    </div>
  )
}
