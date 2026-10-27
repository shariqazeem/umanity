'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Btn, Card, Empty, Icon, Img, Pill, Skeleton, TxLink } from '@/components/shared/ui'
import { countdown, fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { useApi, useCountdown } from '@/lib/client/hooks'
import { getCause } from '@/lib/causes'
import type { DareView } from '@/lib/data/dares'
import { BOOST_SOL, shareDare, useBoost } from '@/components/dares/DareCard'

interface Stake {
  id: string
  address: string
  username: string
  amount: number
  signature: string
  route: string
  createdAt: string
}

export default function DarePage() {
  const { id } = useParams<{ id: string }>()
  const { data, loading, error, reload } = useApi<{ dare?: DareView; stakes?: Stake[] }>(id ? `/api/dares/${id}` : null)
  if (loading && !data) {
    return (
      <div className="max-w-[640px] mx-auto space-y-4">
        <Skeleton className="h-64 rounded-[24px]" />
        <Skeleton className="h-40 rounded-[24px]" />
      </div>
    )
  }
  if (!data?.dare) {
    return (
      <div className="max-w-[640px] mx-auto card">
        <Empty
          icon="bolt"
          title="This dare does not exist."
          sub={error || 'It may have been removed, or the link is wrong.'}
          action={
            <Link href="/home" className="btn btn-primary h-10 px-4.5 text-[13.5px]">
              Back home
            </Link>
          }
        />
      </div>
    )
  }
  return <DareDetail dare={data.dare} stakes={data.stakes ?? []} onChange={reload} />
}

function DareDetail({ dare: initial, stakes, onChange }: { dare: DareView; stakes: Stake[]; onChange: () => void }) {
  const { user, openGive, solPrice } = useUmanity()
  const [dare, setDare] = useState(initial)
  const left = useCountdown(dare.secondsLeft)
  const { boost, busy } = useBoost(dare, (d) => {
    setDare(d)
    onChange()
  })
  const open = dare.status === 'open' && left > 0
  const isTarget = !!user && user.username === dare.targetHandle
  const cause = getCause(dare.poolId)

  return (
    <div className="max-w-[640px] mx-auto space-y-4">
      <Link href="/home" className="inline-flex items-center gap-1 text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">
        <Icon name="chevronLeft" size={14} /> Home
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill tone={open ? 'dark' : dare.status === 'completed' ? 'green' : 'gray'}>
            <Icon name={open ? 'bolt' : dare.status === 'completed' ? 'check' : 'clock'} size={11} />
            {open ? `${countdown(left)} left` : dare.status === 'completed' ? 'Delivered' : dare.status === 'expired' ? 'Expired · pot went to the cause' : dare.status}
          </Pill>
          <span className="text-[12px] text-[#aeaeb2]">{timeAgo(dare.createdAt)}</span>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <Link href={`/u/${dare.creator.username}`}>
            <Avatar username={dare.creator.username || 'u'} size={44} />
          </Link>
          <p className="text-[15px] leading-snug">
            <Link href={`/u/${dare.creator.username}`} className="font-semibold hover:underline underline-offset-2">
              {dare.creator.displayName || `@${dare.creator.username}`}
            </Link>{' '}
            dared{' '}
            <Link href={`/u/${dare.targetHandle}`} className="font-semibold hover:underline underline-offset-2">
              @{dare.targetHandle}
            </Link>
          </p>
        </div>
        <h1 className="font-display text-[34px] sm:text-[42px] leading-[1.08] mt-5">&ldquo;{dare.text}&rdquo;</h1>

        <div className="grid grid-cols-3 gap-3 mt-7">
          <div>
            <p className="eyebrow">Pot</p>
            <p className="num text-[24px] font-bold mt-1 leading-none">{fmtSol(dare.pot, 3)}</p>
            <p className="text-[11.5px] text-[#6e6e73] mt-1 num">SOL{solPrice ? ` · ${fmtUsd(dare.pot * solPrice)}` : ''}</p>
          </div>
          <div>
            <p className="eyebrow">Backers</p>
            <p className="num text-[24px] font-bold mt-1 leading-none">{dare.backerCount}</p>
            <p className="text-[11.5px] text-[#6e6e73] mt-1">people in</p>
          </div>
          <div>
            <p className="eyebrow">Stake</p>
            <p className="num text-[24px] font-bold mt-1 leading-none">{fmtSol(dare.stake, 3)}</p>
            <p className="text-[11.5px] text-[#6e6e73] mt-1">SOL to match</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-7 flex-wrap">
          {open && isTarget && (
            <Btn tone="accent" size="lg" icon="heart" onClick={() => openGive({ causeId: dare.poolId, amountSol: dare.stake, dareId: dare.id })}>
              Accept · give {fmtSol(dare.stake, 3)} SOL
            </Btn>
          )}
          {open && (
            <Btn tone={isTarget ? 'outline' : 'primary'} size="lg" icon="plus" onClick={() => boost()} loading={busy} disabled={!dare.darePda}>
              Boost {fmtSol(BOOST_SOL, 2)} SOL
            </Btn>
          )}
          <Btn tone="outline" size="lg" icon="share" onClick={() => shareDare(dare)}>
            Share
          </Btn>
        </div>
        <p className="text-[12.5px] text-[#aeaeb2] mt-4 leading-relaxed">Whether @{dare.targetHandle} delivers or not, the pot goes to {dare.poolName}. On settlement 1.5% keeps Umanity running; the rest is escrowed for the cause.</p>
        <div className="flex items-center gap-4 mt-3">
          {dare.createTxSignature && <TxLink sig={dare.createTxSignature} label="Stake transaction" />}
          {dare.resolveTxSignature && <TxLink sig={dare.resolveTxSignature} label="Settlement transaction" />}
        </div>
      </Card>

      {cause && (
        <Link href={`/causes/${cause.id}`} className="card card-hover flex items-center gap-4 p-3 pr-5 block">
          <span className="w-20 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-black/[0.04]">
            <Img src={cause.image.replace('w=1600', 'w=320')} alt={cause.imageAlt} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block">For</span>
            <span className="block text-[16px] font-bold tracking-[-0.01em] truncate">{cause.name}</span>
            <span className="block text-[12.5px] text-[#6e6e73] truncate">{cause.tagline}</span>
          </span>
          <Icon name="arrowRight" size={18} className="text-[#aeaeb2]" />
        </Link>
      )}

      <Card className="p-5">
        <p className="eyebrow">Backers</p>
        {stakes.length === 0 ? (
          <p className="text-[13.5px] text-[#6e6e73] mt-2">Only the stake so far. Boost it to be the first backer.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {stakes.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <Avatar username={s.username || 'u'} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate">{s.username ? `@${s.username}` : 'Someone'}</p>
                  <p className="text-[11px] text-[#aeaeb2]">{timeAgo(s.createdAt)}</p>
                </div>
                <span className="num text-[13px] font-semibold">+{fmtSol(s.amount, 3)} SOL</span>
                <TxLink sig={s.signature} label="" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
