'use client'

import { useState } from 'react'
import { useUmanity, type Signer } from '@/components/providers/UmanityProvider'
import { Card, Btn, Icon, TxLink } from '@/components/shared/ui'
import { adminFetch } from '@/lib/client/admin'

interface Step {
  poolId: string
  pool: 'created' | 'exists'
  poolSignature?: string
  campaign: 'created' | 'exists'
  campaignSignature?: string
  targetSol: number
}

export function BootstrapCard({ signer }: { signer: Signer }) {
  const { isMainnet } = useUmanity()
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [error, setError] = useState('')
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await adminFetch<{ success: boolean; steps?: Step[]; error?: string }>(signer, '/api/admin/bootstrap', { body: {} })
      if (!r.success) throw new Error(r.error || 'Bootstrap failed')
      setSteps(r.steps ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bootstrap failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-black/[0.05] text-[#6e6e73] flex items-center justify-center flex-shrink-0">
          <Icon name="bank" size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold tracking-[-0.01em]">Set up causes on-chain</h3>
          <p className="text-[12.5px] text-[#6e6e73] mt-1 leading-relaxed">Creates any missing vault, campaign and milestone accounts for the six causes on Solana {isMainnet ? 'mainnet' : 'devnet'}, signed by the program authority on the server. Safe to run again; existing accounts are left alone.</p>
        </div>
      </div>
      <Btn tone="outline" size="md" className="mt-4" onClick={run} loading={busy} icon="refresh">
        Run bootstrap
      </Btn>
      {error && <p className="text-[12.5px] text-[#c53030] mt-3">{error}</p>}
      {steps && (
        <ul className="mt-4 space-y-1.5 text-[12.5px]">
          {steps.map((s) => (
            <li key={s.poolId} className="flex items-center gap-2 flex-wrap">
              <Icon name="check" size={13} className="text-[#047857]" />
              <span className="font-semibold">{s.poolId}</span>
              <span className="text-[#6e6e73]">
                pool {s.pool} · campaign {s.campaign} · target <span className="num">{s.targetSol} SOL</span>
              </span>
              {s.poolSignature && <TxLink sig={s.poolSignature} label="pool tx" />}
              {s.campaignSignature && <TxLink sig={s.campaignSignature} label="campaign tx" />}
            </li>
          ))}
          {steps.length === 0 && <li className="text-[#6e6e73]">Nothing to do.</li>}
        </ul>
      )}
    </Card>
  )
}
