'use client'

import { useCallback, useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { LeftNav, MobileTabs, type TabId } from '@/components/layout/LeftNav'
import { RightRail } from '@/components/layout/RightRail'
import { FeedTab } from '@/components/feed/FeedTab'
import { CausesTab } from '@/components/causes/CausesTab'
import { GiveTab } from '@/components/give/GiveTab'
import { GovernTab } from '@/components/govern/GovernTab'
import { ProfileTab } from '@/components/profile/ProfileTab'
import { ClaimHandleModal } from '@/components/profile/ClaimHandleModal'
import { UmanityAgent } from '@/components/ai/UmanityAgent'
import { apiGet } from '@/lib/client/api'

const VALID: TabId[] = ['feed', 'causes', 'give', 'govern', 'profile']

export default function Home() {
  const [tab, setTab] = useState<TabId>('feed')
  const [giveCause, setGiveCause] = useState<string | null>(null)
  const [giveMode, setGiveMode] = useState<'anychain' | 'solana' | null>(null)
  const [claimOpen, setClaimOpen] = useState(false)
  const [badges, setBadges] = useState<Partial<Record<TabId, string>>>({})

  // Deep links: ?tab=give&cause=edhi-foundation
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const t = p.get('tab') as TabId | null
    if (t && VALID.includes(t)) setTab(t)
    const c = p.get('cause')
    if (c) setGiveCause(c)
  }, [])

  useEffect(() => {
    apiGet<{ stats?: { openDares: number; activeProposals: number } }>('/api/platform/stats')
      .then((d) => d.stats && setBadges({ feed: d.stats.openDares > 0 ? `${d.stats.openDares} live` : undefined, govern: d.stats.activeProposals > 0 ? `${d.stats.activeProposals} open` : undefined }))
      .catch(() => {})
  }, [tab])

  const go = useCallback((t: TabId) => {
    setTab(t)
    window.scrollTo({ top: 0 })
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    window.history.replaceState(null, '', url.toString())
  }, [])

  const openGive = useCallback(
    (cause?: string, mode: 'anychain' | 'solana' = 'anychain') => {
      if (cause) setGiveCause(cause)
      setGiveMode(mode)
      go('give')
    },
    [go]
  )

  return (
    <div className="min-h-[100dvh] bg-[#F8F8F7]">
      <TopBar onGive={() => openGive(undefined, 'anychain')} />
      <div className="max-w-[1360px] mx-auto flex">
        <LeftNav active={tab} onChange={go} badges={badges} />
        <main className="flex-1 min-w-0 px-4 lg:px-6 pt-5 pb-28 lg:pb-12">
          <div className="entrance-reveal" key={tab}>
            {tab === 'feed' && <FeedTab onGive={openGive} />}
            {tab === 'causes' && <CausesTab onGive={openGive} />}
            {tab === 'give' && <GiveTab initialCause={giveCause} initialMode={giveMode} />}
            {tab === 'govern' && <GovernTab />}
            {tab === 'profile' && <ProfileTab onClaim={() => setClaimOpen(true)} />}
          </div>
        </main>
        <RightRail onClaim={() => setClaimOpen(true)} />
      </div>
      <MobileTabs active={tab} onChange={go} />
      <ClaimHandleModal open={claimOpen} onClose={() => setClaimOpen(false)} />
      <UmanityAgent />
    </div>
  )
}
