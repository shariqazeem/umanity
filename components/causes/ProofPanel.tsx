'use client'
import { adminFetch } from '@/lib/client/admin'

/**
 * The trust layer under a delivery update: the oracle verdict, the donors'
 * vote, and the on-chain release. Re-created from the old Govern tab in the
 * new, quieter style.
 */
import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Icon, Pill, TxLink } from '@/components/shared/ui'
import { apiSend, countdown, fmtSol } from '@/lib/client/api'
import { payWithX402 } from '@/lib/client/x402'
import type { FieldUpdateView } from '@/lib/contracts'
import type { OracleAttestation } from '@/lib/db'

interface Props {
  update: FieldUpdateView
  isAdmin: boolean
  myVote: number | null
  power: number
  onVote: (proposalId: string, option: number) => Promise<boolean>
  onExecute: (proposalId: string) => Promise<boolean>
  onChange: () => void
}

export function ProofPanel({ update, isAdmin, myVote, power, onVote, onExecute, onChange }: Props) {
  const { ensureSigner, toast, signer } = useUmanity()
  const [busy, setBusy] = useState<string | null>(null)
  const att: OracleAttestation | null = update.attestation
  const m = update.milestone
  const p = update.proposal
  const now = Date.now()
  const closesAt = p ? new Date(p.closes_at).getTime() : 0
  const closed = p ? closesAt < now : false
  const active = !!p && p.status === 'active' && !closed
  const canExecute = !!p && p.status === 'active' && closed
  const yes = p?.results[0]
  const no = p?.results[1]

  const audit = async () => {
    if (!update.milestoneId) return
    const s = ensureSigner()
    if (!s) return
    setBusy('audit')
    try {
      const res = await payWithX402(s, '/api/x402/verify-milestone', { milestoneId: update.milestoneId })
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`)
      toast(res.settlement ? 'Audit paid and complete. The attestation is on-chain.' : 'Audit complete.', 'ok')
      onChange()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed'
      toast(/insufficient|balance|funds/i.test(msg) ? 'The audit costs $0.01 in USDC. Add USDC to your wallet and try again.' : msg, 'err')
    } finally {
      setBusy(null)
    }
  }

  const vote = async (option: number) => {
    if (!p) return
    if (!ensureSigner()) return
    setBusy('vote')
    await onVote(p.id, option)
    setBusy(null)
    onChange()
  }

  const execute = async () => {
    if (!p) return
    setBusy('execute')
    await onExecute(p.id)
    setBusy(null)
    onChange()
  }

  /** Field team only: close an open vote before its window ends (signed request). */
  const closeEarly = async () => {
    if (!p || !signer) return
    setBusy('close')
    try {
      const r = await adminFetch<{ success: boolean; error?: string; message?: string }>(signer, '/api/governance/execute', { body: { proposalId: p.id, force: true } })
      toast(r.success ? r.message || 'Vote closed and tallied.' : r.error || 'Could not close the vote', r.success ? 'ok' : 'err')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not close the vote', 'err')
    }
    setBusy(null)
    onChange()
  }

  const release = async () => {
    if (!update.milestoneId) return
    const s = ensureSigner()
    if (!s) return
    setBusy('release')
    try {
      const r = await adminFetch<{ success: boolean; error?: string; amount?: number }>(s, '/api/governance/release', { body: { milestoneId: update.milestoneId } })
      toast(r.success ? `Released ${fmtSol(r.amount ?? 0, 3)} SOL from escrow on-chain.` : r.error || 'Release failed', r.success ? 'ok' : 'err')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Release failed', 'err')
    }
    setBusy(null)
    onChange()
  }

  const verdict = att ? (att.verdict === 'verified' ? { label: `Verified · ${att.confidence}/100`, tone: 'green' as const } : att.verdict === 'rejected' ? { label: `Rejected · ${att.confidence}/100`, tone: 'red' as const } : { label: `Needs review · ${att.confidence}/100`, tone: 'amber' as const }) : { label: 'Not audited yet', tone: 'gray' as const }

  return (
    <div className="mt-4 rounded-2xl border border-black/[0.06] bg-[#fafafa] p-4">
      {/* Oracle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="shieldCheck" size={16} className="text-[#047857]" />
          <span className="text-[13px] font-semibold">Impact Oracle</span>
          <Pill tone={verdict.tone}>{verdict.label}</Pill>
        </div>
        {update.milestoneId && (
          <Btn size="sm" tone="outline" onClick={audit} loading={busy === 'audit'}>
            {att ? 'Audit again' : 'Audit this proof'} · $0.01
          </Btn>
        )}
      </div>
      {att && (
        <div className="mt-2.5">
          <p className="text-[12.5px] text-[#6e6e73] leading-relaxed">{att.summary}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {att.checks.map((c) => (
              <span key={c.name} title={c.note} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${c.passed ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#fff1f1] text-[#c53030]'}`}>
                <Icon name={c.passed ? 'check' : 'x'} size={10} strokeWidth={2.5} /> {c.name}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-[#aeaeb2] mt-2 num break-all">
            attestation {att.attestationHash.slice(0, 18)}… · {att.model} · {new Date(att.issuedAt).toLocaleDateString()}
          </p>
        </div>
      )}
      {!att && <p className="text-[12px] text-[#aeaeb2] mt-1.5">Anyone can pay one cent in USDC to have the oracle audit this proof. The verdict is hashed into the milestone on-chain.</p>}

      {/* Vote */}
      {p && yes && no && (
        <div className="mt-4 pt-4 border-t border-black/[0.06]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[13px] font-semibold flex items-center gap-2">
              <Icon name="vote" size={15} className="text-[#047857]" /> Donors decide: release {m ? `${m.percentage}%` : ''} for this delivery?
            </p>
            <span className="text-[11.5px] text-[#6e6e73] num">
              {active ? `closes in ${countdown(Math.max(0, Math.round((closesAt - now) / 1000)))}` : p.status === 'executed' ? 'decided' : 'voting ended'} · {fmtSol(p.escrowAmount, 3)} SOL
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[yes, no].map((r, i) => {
              const mine = myVote === i
              return (
                <button key={i} onClick={() => vote(i)} disabled={!active || myVote !== null || busy === 'vote'} className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all disabled:cursor-default ${mine ? 'border-[#1d1d1f]' : active && myVote === null ? 'border-black/[0.08] hover:border-[#1d1d1f]' : 'border-black/[0.06]'}`}>
                  <div className={`absolute inset-y-0 left-0 ${i === 0 ? 'bg-[#ecfdf5]' : 'bg-black/[0.04]'}`} style={{ width: `${r.percentage}%` }} />
                  <div className="relative flex items-center justify-between">
                    <span className="text-[13px] font-semibold">{i === 0 ? 'Approve' : 'Not yet'}</span>
                    <span className="num text-[13px] font-bold">{r.percentage.toFixed(0)}%</span>
                  </div>
                  <p className="relative text-[11px] text-[#6e6e73] mt-0.5 num">
                    {r.voteCount} {r.voteCount === 1 ? 'vote' : 'votes'} · {r.totalWeight.toLocaleString()} power{mine ? ' · yours' : ''}
                  </p>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {canExecute && (
              <Btn size="sm" onClick={execute} loading={busy === 'execute'}>
                Tally the votes
              </Btn>
            )}
            {active && isAdmin && (
              <Btn size="sm" tone="outline" onClick={closeEarly} loading={busy === 'close'}>
                Close the vote now
              </Btn>
            )}
            {p.status === 'executed' && p.result && <Pill tone={p.result.approved ? 'green' : 'red'}>{p.result.approved ? 'Approved by the donors' : 'Not approved'}</Pill>}
            {m?.status === 'approved' && isAdmin && (
              <Btn size="sm" tone="accent" onClick={release} loading={busy === 'release'}>
                Release on-chain
              </Btn>
            )}
            {m?.status === 'approved' && !isAdmin && <span className="text-[11.5px] text-[#6e6e73]">Approved. The release transaction follows shortly.</span>}
            <span className="ml-auto text-[11px] text-[#aeaeb2] num">{power > 0 ? `You vote with ${power.toLocaleString()} power` : active ? 'Give to this cause to vote' : ''}</span>
          </div>
        </div>
      )}

      {(update.releaseTxSignature || m?.releaseTxSignature) && (
        <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center gap-2 flex-wrap">
          <Pill tone="green">
            <Icon name="unlock" size={11} /> Released from escrow
          </Pill>
          <TxLink sig={update.releaseTxSignature || m?.releaseTxSignature} label="Release transaction" />
        </div>
      )}
      {!p && m && m.status !== 'released' && <p className="text-[11.5px] text-[#aeaeb2] mt-3 pt-3 border-t border-black/[0.06]">The release vote opens once the proof is posted.</p>}
    </div>
  )
}
