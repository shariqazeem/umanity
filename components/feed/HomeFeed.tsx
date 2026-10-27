'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Empty, Skeleton } from '@/components/shared/ui'
import { apiGet } from '@/lib/client/api'
import type { FeedItem } from '@/lib/contracts'
import type { FeedPost } from '@/lib/data/social'
import type { DareView } from '@/lib/data/dares'
import { TopStrip } from './TopStrip'
import { GiveToday } from './GiveToday'
import { Composer } from './Composer'
import { PostCard, FieldUpdateCard, ProposalCard, SuggestCard } from './FeedCards'
import { RightRail } from './RightRail'
import { DareCard } from '@/components/dares/DareCard'
import { DareComposer } from '@/components/dares/DareComposer'

export function HomeFeed() {
  const { address, user, openGive } = useUmanity()
  const params = useSearchParams()
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [dareOpen, setDareOpen] = useState(false)
  const [dareInit, setDareInit] = useState<{ cause: string | null; amount: number | null; target?: string | null }>({ cause: null, amount: null })

  const load = useCallback(async () => {
    try {
      const q = address ? `?address=${address}` : ''
      const d = await apiGet<{ success?: boolean; feed?: FeedItem[] }>(`/api/feed/smart${q}`)
      setItems(Array.isArray(d.feed) ? d.feed : [])
      setFailed(false)
    } catch {
      setItems((prev) => prev ?? [])
      setFailed(true)
    }
  }, [address])

  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 60_000)
    return () => clearInterval(t)
  }, [load])

  // /home?compose=dare&cause=<id>&amount=<sol> — the give flow lands here after a gift.
  useEffect(() => {
    if (params.get('compose') !== 'dare') return
    setDareInit({ cause: params.get('cause'), amount: params.get('amount') ? Number(params.get('amount')) : null, target: params.get('target') })
    setDareOpen(true)
    const url = new URL(window.location.href)
    url.searchParams.delete('compose')
    url.searchParams.delete('cause')
    url.searchParams.delete('amount')
    url.searchParams.delete('target')
    window.history.replaceState(null, '', url.toString())
  }, [params])

  const prependPost = (post: FeedPost) => setItems((it) => [{ type: 'post', id: post.id, data: post }, ...(it ?? [])])
  const prependDare = (dare: DareView) => setItems((it) => [{ type: 'dare', id: `dare_${dare.id}`, data: dare }, ...(it ?? [])])

  return (
    <div className="xl:flex xl:gap-8 xl:justify-center">
      <div className="w-full max-w-[680px] mx-auto xl:mx-0 space-y-6">
        <TopStrip />
        <GiveToday />
        <Composer onPosted={prependPost} onDare={() => (setDareInit({ cause: null, amount: null }), setDareOpen(true))} />

        {items === null ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-[20px]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="card">
            <Empty
              icon="heart"
              title="Nothing here yet."
              sub={failed ? 'The stream could not load. It will retry on its own.' : 'The first gift goes at the top, with its transaction and what it bought.'}
              action={
                <Btn tone="accent" icon="heart" onClick={() => openGive()}>
                  Give
                </Btn>
              }
            />
          </div>
        ) : (
          <div className="space-y-3 animate-stagger">
            {items.map((it) => {
              switch (it.type) {
                case 'post':
                  return <PostCard key={it.id} post={it.data} fundedByViewer={it.data.fundedByViewer} />
                case 'field_update':
                  return <FieldUpdateCard key={it.id} update={it.data} fundedByViewer={it.data.fundedByViewer} />
                case 'dare':
                  return <DareCard key={it.id} dare={it.data} />
                case 'proposal':
                  return <ProposalCard key={it.id} proposal={it.data} />
                case 'suggested_follow':
                  return user && it.data.address === user.address ? null : <SuggestCard key={it.id} u={it.data} />
                default:
                  return null
              }
            })}
          </div>
        )}
      </div>
      <RightRail />
      <DareComposer open={dareOpen} onClose={() => setDareOpen(false)} onCreated={prependDare} initialCause={dareInit.cause} initialAmount={dareInit.amount} initialTarget={dareInit.target} />
    </div>
  )
}
