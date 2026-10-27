'use client'

import Link from 'next/link'
import { Card, Pill, Skeleton, Empty, Icon, TxLink } from '@/components/shared/ui'
import { useApi } from '@/lib/client/hooks'
import { fmtSol } from '@/lib/client/api'
import { getCause } from '@/lib/causes'
import type { FieldUpdateView } from '@/lib/contracts'

export function PastDeliveries({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error } = useApi<{ success?: boolean; updates?: FieldUpdateView[]; deliveries?: FieldUpdateView[]; error?: string }>('/api/field/updates?limit=30', refreshKey)
  const list = data?.updates ?? data?.deliveries ?? []
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-bold tracking-[-0.01em]">Past deliveries</h3>
      {loading && !data ? (
        <div className="space-y-2 mt-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : error || data?.success === false ? (
        <p className="text-[12.5px] text-[#6e6e73] mt-3">Could not load deliveries: {error ?? data?.error}</p>
      ) : list.length === 0 ? (
        <div className="-mx-2">
          <Empty icon="truck" title="Nothing posted yet" sub="The first delivery you post shows up here and on the cause page." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-black/[0.06]">
          {list.map((u) => {
            const c = getCause(u.poolId)
            const released = u.milestone?.status === 'released' || !!u.releaseTxSignature
            const voting = u.milestone?.status === 'voting' || (u.proposal && u.proposal.status === 'active')
            return (
              <li key={u.id} className="py-3 flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-black/[0.05] text-[#6e6e73] flex items-center justify-center flex-shrink-0">
                  <Icon name="truck" size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/causes/${u.poolId}`} className="text-[13.5px] font-semibold hover:underline block truncate">
                    {u.title}
                  </Link>
                  <p className="text-[12px] text-[#6e6e73] mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{c?.shortName ?? u.poolName}</span>
                    <span>·</span>
                    <span>{u.deliveredAt ? new Date(u.deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    {u.amountSol > 0 && (
                      <>
                        <span>·</span>
                        <span className="num">{fmtSol(u.amountSol, 3)} SOL</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="num">{u.media.length} files</span>
                    {u.releaseTxSignature && <TxLink sig={u.releaseTxSignature} label="release" />}
                  </p>
                </div>
                <Pill tone={released ? 'green' : voting ? 'amber' : 'gray'}>{released ? 'Released' : voting ? 'Vote open' : u.attestation ? 'Audited' : 'Posted'}</Pill>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
