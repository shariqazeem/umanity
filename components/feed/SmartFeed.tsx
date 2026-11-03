'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet } from '@/lib/client/api'
import type { FeedItem } from '@/lib/contracts'
import type { FeedPost } from '@/lib/data/social'
import type { DareView } from '@/lib/data/dares'
import { Composer } from './Composer'
import { PostCard } from './PostCard'
import { DeliveryCard } from './DeliveryCard'
import { VoteCard } from './VoteCard'
import { SuggestCard } from './SuggestCard'
import { DareCard } from '@/components/dares/DareCard'
import { DareComposer } from '@/components/dares/DareComposer'

const FILTERS = [
  { key: 'all', label: 'For you' },
  { key: 'proof', label: 'Deliveries' },
  { key: 'gifts', label: 'Gifts' },
  { key: 'dares', label: 'Dares' },
] as const

export function SmartFeed() {
  const { address, user } = useUmanity()
  const params = useSearchParams()
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [dareOpen, setDareOpen] = useState(false)
  const [dareInit, setDareInit] = useState<{ cause: string | null; amount: number | null; target?: string | null }>({ cause: null, amount: null })

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ feed?: FeedItem[] }>(`/api/feed/smart${address ? `?address=${address}` : ''}`)
      setItems(Array.isArray(d.feed) ? d.feed : [])
      setFailed(false)
    } catch {
      setItems((prev) => prev ?? [])
      setFailed(true)
    }
  }, [address])

  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 60_000)
    return () => clearInterval(t)
  }, [load])

  // /home?compose=dare&cause=<id>&amount=<sol>: the give flow offers "dare a friend" after a gift.
  useEffect(() => {
    if (params.get('compose') !== 'dare') return
    setDareInit({ cause: params.get('cause'), amount: params.get('amount') ? Number(params.get('amount')) : null, target: params.get('target') })
    setDareOpen(true)
    window.history.replaceState(null, '', '/home')
  }, [params])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const dares = (items ?? []).filter((i): i is Extract<FeedItem, { type: 'dare' }> => i.type === 'dare').map((i) => i.data)
  const visible = (items ?? []).filter((it) => {
    // "joined Umanity" rows are noise in the stream; they stay on profiles.
    if (it.type === 'post' && it.data.type === 'joined') return false
    if (it.type === 'dare') return filter === 'dares' || (filter === 'all' && dares.length < 2)
    if (filter === 'all') return true
    if (filter === 'proof') return it.type === 'field_update' || it.type === 'proposal' || (it.type === 'post' && (it.data.type === 'proof' || it.data.type === 'milestone'))
    if (filter === 'gifts') return it.type === 'post' && (it.data.type === 'donation' || it.data.type === 'intent')
    return false
  })

  return (
    <div>
      <div className="mb-4 pt-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] mb-0.5">Feed</h2>
          <p className="text-[#86868b] text-[13px]">Your network&apos;s impact, live.</p>
        </div>
      </div>

      {!address && <GuestIntro />}

      <div className="mb-3">
        <Composer onPosted={(post: FeedPost) => setItems((it) => [{ type: 'post', id: post.id, data: post }, ...(it ?? [])])} onDare={() => (setDareInit({ cause: null, amount: null }), setDareOpen(true))} />
      </div>

      {dares.length >= 2 && filter === 'all' && (
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-600">⚡ Live dares</p>
            <button onClick={() => setFilter('dares')} className="text-[11px] font-medium text-[#86868b] hover:text-[#1d1d1f]">
              See all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-5 sm:px-5 pb-1">
            {dares.map((d) => (
              <DareCard key={d.id} dare={d} compact />
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${filter === f.key ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-[20px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">✦</span>
          </div>
          <p className="text-[#1d1d1f] font-semibold text-[15px] mb-1">{failed ? 'The feed could not load' : filter === 'all' ? 'Your feed is empty' : 'Nothing here yet'}</p>
          <p className="text-[#86868b] text-[13px] mb-5">{failed ? 'It will retry on its own.' : 'Give once and your gift lands here, with its transaction and the delivery it pays for.'}</p>
          <Link href="/give" className="btn-primary px-5 py-2.5 text-[13px]">
            ♡ Make the first gift
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5 animate-stagger">
          {visible.map((it) => {
            switch (it.type) {
              case 'post':
                return <PostCard key={it.id} post={it.data} fundedByViewer={it.data.fundedByViewer} />
              case 'field_update':
                return <DeliveryCard key={it.id} update={it.data} fundedByViewer={it.data.fundedByViewer} />
              case 'dare':
                return <DareCard key={it.id} dare={it.data} />
              case 'proposal':
                return <VoteCard key={it.id} proposal={it.data} />
              case 'suggested_follow':
                return user && it.data.address === user.address ? null : <SuggestCard key={it.id} u={it.data} />
              default:
                return null
            }
          })}
        </div>
      )}

      {visible.length > 0 && (
        <div className="mt-5 text-center">
          <button onClick={refresh} disabled={refreshing} className="btn-ghost px-4 py-2 text-[12px] font-medium">
            {refreshing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-[1.5px] border-[#aeaeb2] border-t-[#1d1d1f] rounded-full animate-spin" />
                Refreshing
              </span>
            ) : (
              'Refresh feed'
            )}
          </button>
        </div>
      )}

      <DareComposer open={dareOpen} onClose={() => setDareOpen(false)} onCreated={(d: DareView) => setItems((it) => [{ type: 'dare', id: `dare_${d.id}`, data: d }, ...(it ?? [])])} initialCause={dareInit.cause} initialAmount={dareInit.amount} initialTarget={dareInit.target} />
    </div>
  )
}

/** First-visit framing for people who arrive without a wallet (judges included). */
function GuestIntro() {
  const { openAuth } = useUmanity()
  return (
    <div className="card p-5 mb-3 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-100/50 blur-2xl pointer-events-none" />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 mb-2">Crypto giving, on proof</p>
      <h3 className="text-[19px] font-bold tracking-[-0.02em] leading-snug max-w-md">Give from any chain. It waits in escrow until the delivery is filmed, verified and approved.</h3>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link href="/give" className="btn-primary px-4 py-2.5 !text-[13px]">
          ♡ Give 0.01 SOL
        </Link>
        <button onClick={openAuth} className="btn-secondary px-4 py-2.5 !text-[13px]">
          Sign in
        </button>
        <Link href="/agents" className="btn-ghost px-3 py-2.5 !text-[13px]">
          🤖 Agents can give too →
        </Link>
      </div>
    </div>
  )
}
