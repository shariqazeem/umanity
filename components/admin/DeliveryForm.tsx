'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useUmanity, type Signer } from '@/components/providers/UmanityProvider'
import { Btn, Field, Toggle, Img, Icon, Pill } from '@/components/shared/ui'
import { apiGet, fmtUsd } from '@/lib/client/api'
import { adminFetch } from '@/lib/client/admin'
import { CAUSES, DEFAULT_CAUSE_ID } from '@/lib/causes'
import { MediaUploader, type UploadItem } from './MediaUploader'
import type { CampaignView } from '@/lib/data/governance'
import type { MediaItem } from '@/lib/contracts'

export function DeliveryForm({ signer, onPosted }: { signer: Signer; onPosted: () => void }) {
  const { solPrice, toast } = useUmanity()
  const [poolId, setPoolId] = useState(DEFAULT_CAUSE_ID)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amountSol, setAmountSol] = useState('')
  const [fiatAmount, setFiatAmount] = useState('')
  const [location, setLocation] = useState('')
  const [deliveredAt, setDeliveredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [milestoneIndex, setMilestoneIndex] = useState<number | ''>('')
  const [requestRelease, setRequestRelease] = useState(false)
  const [xPostUrl, setXPostUrl] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [media, setMedia] = useState<UploadItem[]>([])
  const [campaigns, setCampaigns] = useState<Record<string, CampaignView>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ poolId: string; id?: string } | null>(null)

  useEffect(() => {
    apiGet<{ campaigns?: CampaignView[] }>('/api/campaigns')
      .then((d) => setCampaigns(Object.fromEntries((d.campaigns ?? []).map((c) => [c.pool_id, c]))))
      .catch(() => {})
  }, [])

  const campaign = campaigns[poolId]
  const cause = CAUSES.find((c) => c.id === poolId)!
  const uploaded = useMemo(() => media.filter((m) => m.status === 'done' && m.url), [media])
  const uploading = media.some((m) => m.status === 'uploading')
  const sol = parseFloat(amountSol || '0')

  const reset = () => {
    setTitle('')
    setDescription('')
    setAmountSol('')
    setFiatAmount('')
    setLocation('')
    setMilestoneIndex('')
    setRequestRelease(false)
    setXPostUrl('')
    setLat('')
    setLng('')
    setMedia([])
    setDone(null)
    setError('')
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const latN = lat ? Number(lat) : undefined
      const lngN = lng ? Number(lng) : undefined
      const items: MediaItem[] = uploaded.map((m) => ({ url: m.url!, kind: m.kind, sha256: m.sha256, note: m.note || undefined, ...(m.kind === 'photo' && latN != null && lngN != null ? { lat: latN, lng: lngN } : {}) }))
      const body = {
        poolId,
        title: title.trim(),
        description: description.trim(),
        amountSol: sol > 0 ? sol : undefined,
        fiatAmount: fiatAmount.trim() || undefined,
        location: location.trim() || undefined,
        deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : undefined,
        media: items,
        milestoneIndex: milestoneIndex === '' ? undefined : milestoneIndex,
        requestRelease: milestoneIndex !== '' && requestRelease,
        xPostUrl: xPostUrl.trim() || undefined,
      }
      const r = await adminFetch<{ success: boolean; error?: string; update?: { id?: string }; delivery?: { id?: string } }>(signer, '/api/field/updates', { body })
      if (!r.success) throw new Error(r.error || 'Could not post the delivery')
      setDone({ poolId, id: r.update?.id ?? r.delivery?.id })
      toast('Delivery posted. Donors of this cause have been notified.', 'ok')
      onPosted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the delivery')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <span className="w-14 h-14 rounded-full bg-[#10b981] text-white flex items-center justify-center mx-auto check-pop">
          <Icon name="check" size={26} strokeWidth={2.5} />
        </span>
        <h3 className="font-display text-[30px] leading-none mt-5">Posted.</h3>
        <p className="text-[14px] text-[#6e6e73] mt-3 max-w-[380px] mx-auto">The update is live on the cause page and in the feed, and everyone who gave to {cause.name} has been told their gift arrived.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
          <Link href={`/causes/${done.poolId}`} className="btn btn-primary h-11 px-5 text-[14px]">
            Open the cause page
          </Link>
          <Link href="/home" className="btn btn-outline h-11 px-5 text-[14px]">
            See it in the feed
          </Link>
          <Btn tone="ghost" size="lg" onClick={reset}>
            Post another
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cause */}
      <div>
        <p className="text-[12.5px] font-semibold mb-2">Cause</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CAUSES.map((c) => {
            const on = c.id === poolId
            return (
              <button key={c.id} type="button" onClick={() => (setPoolId(c.id), setMilestoneIndex(''))} className={`flex items-center gap-2.5 p-2 pr-3 rounded-2xl border text-left transition-colors ${on ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-black/[0.08] bg-white hover:border-black/30'}`}>
                <span className="w-10 h-10 rounded-xl overflow-hidden bg-black/[0.05] flex-shrink-0">
                  <Img src={c.image.replace('w=1600', 'w=120')} alt="" />
                </span>
                <span className="text-[12.5px] font-semibold leading-tight">{c.shortName}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Title" hint="One line, as it will appear in the feed">
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="School kits and a hot lunch for 24 children" className="input" />
      </Field>
      <Field label="What happened" hint="What was bought, for whom, from where. Write it the way you would tell a donor in person.">
        <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 4000))} rows={5} placeholder="We visited … and delivered … Receipts from … attached." className="input resize-y" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Spent (SOL)" hint={sol > 0 && solPrice ? `about ${fmtUsd(sol * solPrice)} today` : 'Amount from the vault this delivery used'}>
          <input type="number" inputMode="decimal" min="0" step="0.001" value={amountSol} onChange={(e) => setAmountSol(e.target.value)} placeholder="0.00" className="input num" />
        </Field>
        <Field label="Spent (PKR, as on the receipts)" hint="Free text, for example PKR 45,300">
          <input value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value.slice(0, 60))} placeholder="PKR 45,300" className="input" />
        </Field>
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value.slice(0, 120))} placeholder="Korangi, Karachi" className="input" />
        </Field>
        <Field label="Delivered on">
          <input type="date" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} className="input" />
        </Field>
        <Field label="Latitude" hint="Optional; applied to the photos">
          <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="24.8607" className="input num" />
        </Field>
        <Field label="Longitude">
          <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="67.0011" className="input num" />
        </Field>
      </div>

      {/* Milestone */}
      <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] p-4">
        <p className="text-[12.5px] font-semibold">Milestone this delivery fulfils</p>
        <p className="text-[12px] text-[#6e6e73] mt-0.5">Attaches the proof to a milestone so donors can vote to release it from the vault.</p>
        {campaign ? (
          <div className="mt-3 space-y-1.5">
            <label className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer ${milestoneIndex === '' ? 'border-[#1d1d1f] bg-white' : 'border-transparent hover:bg-white'}`}>
              <input type="radio" name="ms" checked={milestoneIndex === ''} onChange={() => setMilestoneIndex('')} className="accent-[#1d1d1f]" />
              <span className="text-[13px]">No milestone (just an update)</span>
            </label>
            {campaign.milestones.map((m) => (
              <label key={m.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer ${milestoneIndex === m.index ? 'border-[#1d1d1f] bg-white' : 'border-transparent hover:bg-white'}`}>
                <input type="radio" name="ms" checked={milestoneIndex === m.index} onChange={() => setMilestoneIndex(m.index)} className="accent-[#1d1d1f]" disabled={m.status === 'released'} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] leading-snug">
                    {m.index + 1}. {m.description}
                  </span>
                  <span className="block text-[11.5px] text-[#6e6e73] mt-0.5">
                    {m.percentage}% of funds · <span className="capitalize">{m.status}</span>
                    {m.evidence ? ' · has evidence' : ''}
                  </span>
                </span>
                <Pill tone={m.status === 'released' ? 'green' : m.status === 'voting' ? 'amber' : 'gray'}>{m.status}</Pill>
              </label>
            ))}
            {milestoneIndex !== '' && (
              <div className="pt-2">
                <Toggle on={requestRelease} onChange={setRequestRelease} label="Open the release vote for this milestone now" />
                <p className="text-[11.5px] text-[#6e6e73] mt-1.5 ml-[50px]">Donors of this cause get 72 hours to approve or reject on the strength of the proof.</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12.5px] text-[#aeaeb2] mt-2">No campaign found for this cause yet. Run the bootstrap on the right.</p>
        )}
      </div>

      {/* Media */}
      <div>
        <p className="text-[12.5px] font-semibold mb-2">Photos and receipts</p>
        <MediaUploader signer={signer} items={media} onChange={setMedia} />
      </div>

      <Field label="Post on X" hint="Optional link to the thread about this delivery">
        <input value={xPostUrl} onChange={(e) => setXPostUrl(e.target.value.trim())} placeholder="https://x.com/umanity_xyz/status/…" className="input" />
      </Field>

      {error && <p className="text-[12.5px] text-[#c53030]">{error}</p>}
      <Btn size="xl" full onClick={submit} loading={busy} disabled={!title.trim() || !description.trim() || uploading} icon="truck">
        {uploading ? 'Waiting for uploads…' : `Post delivery${uploaded.length ? ` with ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}` : ''}`}
      </Btn>
      <p className="text-[11.5px] text-[#aeaeb2] text-center">Signed with {signer.publicKey.toBase58().slice(0, 4)}…{signer.publicKey.toBase58().slice(-4)}. Every donor of this cause is notified that their gift arrived.</p>
    </div>
  )
}
