'use client'

/** The sticky give card and the escrow box on a cause page. */
import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { AccountLink, Btn, Icon, Pill, Progress } from '@/components/shared/ui'
import { describeImpact, type CauseMeta } from '@/lib/causes'
import { fmtSol, fmtUsd } from '@/lib/client/api'
import type { CampaignView } from '@/lib/data/governance'
import { milestoneRows, statusLabel } from './data'

const PRESETS = [5, 10, 25, 50]

export function GiveCard({ cause }: { cause: CauseMeta }) {
  const { openGive } = useUmanity()
  const [custom, setCustom] = useState('')
  const [picked, setPicked] = useState<number | null>(25)
  const usd = picked ?? parseFloat(custom || '0')
  const impact = usd > 0 ? describeImpact(cause, usd) : null
  return (
    <div className="card p-5">
      <h3 className="text-[17px] font-bold tracking-[-0.02em]">Give to {cause.shortName.toLowerCase()}</h3>
      <p className="text-[12.5px] text-[#6e6e73] mt-0.5">Held in escrow until the delivery is proven.</p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {PRESETS.map((p) => {
          const on = picked === p
          const what = describeImpact(cause, p)
          return (
            <button
              key={p}
              onClick={() => {
                setPicked(p)
                setCustom('')
              }}
              className={`rounded-2xl border px-3 py-3 text-left transition-all ${on ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-black/[0.08] hover:border-black/30'}`}
            >
              <span className="block num text-[18px] font-bold leading-none">${p}</span>
              <span className={`block text-[11.5px] mt-1.5 leading-snug ${on ? 'text-white/70' : 'text-[#6e6e73]'}`}>{what ? `≈ ${what}` : ''}</span>
            </button>
          )
        })}
      </div>
      <div className="relative mt-2">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aeaeb2]">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value)
            setPicked(null)
          }}
          placeholder="Other amount"
          className={`input !pl-8 num ${picked === null && custom ? '!border-[#1d1d1f]' : ''}`}
        />
      </div>
      {impact && picked === null && usd > 0 && <p className="text-[12px] text-[#047857] mt-2">About {impact}.</p>}

      <Btn tone="accent" size="xl" full className="mt-4" icon="heart" onClick={() => openGive({ causeId: cause.id, amountUsd: usd > 0 ? usd : undefined })}>
        {usd > 0 ? `Give ${fmtUsd(usd)}` : 'Give'}
      </Btn>
      <Btn tone="ghost" size="md" full className="mt-1.5" icon="globe" onClick={() => openGive({ causeId: cause.id, amountUsd: usd > 0 ? usd : undefined, method: 'anychain' })}>
        Give from another chain
      </Btn>
      <p className="text-[11px] text-[#aeaeb2] text-center mt-2">No platform fee. You can give anonymously.</p>
    </div>
  )
}

export function EscrowBox({ held, raised, released, vault, poolPda, campaign }: { held: number; raised: number; released: number; vault: string; poolPda: string; campaign: CampaignView | null }) {
  const { solPrice } = useUmanity()
  const rows = milestoneRows(campaign)
  const target = campaign?.target_amount ?? 0
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Icon name="lock" size={15} className="text-[#047857]" />
        <h3 className="text-[15px] font-bold tracking-[-0.01em]">The vault</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[
          ['Held', held],
          ['Raised', raised],
          ['Released', released],
        ].map(([l, v]) => (
          <div key={l as string}>
            <p className="eyebrow">{l}</p>
            <p className="num text-[17px] font-bold mt-1 leading-none">{fmtSol(v as number, 2)}</p>
            <p className="text-[11px] text-[#6e6e73] mt-1 num">SOL{solPrice ? ` · ${fmtUsd((v as number) * solPrice)}` : ''}</p>
          </div>
        ))}
      </div>
      {target > 0 && (
        <div className="mt-4">
          <Progress value={raised} max={target} />
          <p className="text-[11.5px] text-[#6e6e73] mt-1.5 num">
            {fmtSol(raised, 2)} of {fmtSol(target, target >= 10 ? 0 : 2)} SOL campaign target
          </p>
        </div>
      )}
      {vault && (
        <p className="text-[12px] text-[#6e6e73] mt-4 flex items-center gap-1.5 flex-wrap">
          Vault <AccountLink address={vault} />
          {poolPda && (
            <>
              <span className="text-[#d4d4d8]">·</span> Pool <AccountLink address={poolPda} />
            </>
          )}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((m) => {
            const s = statusLabel(m.status)
            return (
              <li key={m.id} className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${m.status === 'released' ? 'bg-[#10b981] text-white' : 'bg-black/[0.06] text-[#6e6e73]'}`}>{m.status === 'released' ? <Icon name="check" size={10} strokeWidth={3} /> : m.index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-snug">{m.description}</span>
                  <span className="block text-[11px] text-[#aeaeb2] num mt-0.5">
                    {m.percentage}% · opens at {fmtSol(m.thresholdSol, m.thresholdSol >= 10 ? 0 : 2)} SOL
                  </span>
                </span>
                <Pill tone={s.tone}>{s.label}</Pill>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11.5px] text-[#6e6e73] mt-4 pt-3 border-t border-black/[0.06] leading-relaxed">Funds leave this vault only when the donors approve a delivery. The program enforces it; Umanity cannot move the money alone.</p>
    </div>
  )
}
