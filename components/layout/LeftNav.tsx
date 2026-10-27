'use client'

import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet } from '@/lib/client/api'
import { guardianFor, TIER_COLORS } from '@/lib/guardian'
import { Mono } from '@/components/shared/ui'

export type TabId = 'feed' | 'causes' | 'give' | 'govern' | 'profile'

export const TABS: { id: TabId; label: string; sub: string; icon: string }[] = [
  { id: 'feed', label: 'Feed', sub: 'Impact stream & live dares', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { id: 'causes', label: 'Causes', sub: 'Escrow vaults & milestones', icon: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  { id: 'give', label: 'Give & Bridge', sub: 'Any chain · discreet route', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 0c3 3 3 17 0 20M2 12h20' },
  { id: 'govern', label: 'Govern', sub: 'Releases & oracle audits', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'profile', label: 'Profile & Pass', sub: 'Guardian, holdings, receipts', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
]

export function LeftNav({ active, onChange, badges }: { active: TabId; onChange: (t: TabId) => void; badges?: Partial<Record<TabId, string>> }) {
  const { user } = useUmanity()
  const [votes, setVotes] = useState(0)
  useEffect(() => {
    if (!user) return
    apiGet<{ breakdown?: { votes?: number } }>(`/api/impact-score?address=${user.address}`).then((d) => setVotes(d.breakdown?.votes ?? 0)).catch(() => {})
  }, [user])
  const g = user ? guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount, votes }) : null
  const colors = g ? TIER_COLORS[g.tier] : null

  return (
    <aside className="hidden lg:flex w-[240px] flex-shrink-0 sticky top-14 h-[calc(100dvh-56px)] flex-col px-3 py-5 border-r border-[#ECECED]">
      <nav className="space-y-0.5">
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button key={t.id} onClick={() => onChange(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${isActive ? 'bg-black/[0.05] text-[#111113]' : 'text-[#52525B] hover:bg-black/[0.03] hover:text-[#111113]'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d={t.icon} />
              </svg>
              <span className="flex-1 min-w-0">
                <span className={`block text-[14px] ${isActive ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
                <span className="block text-[10px] text-[#A1A1AA] truncate">{t.sub}</span>
              </span>
              {badges?.[t.id] && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${t.id === 'feed' ? 'bg-[#FFF1ED] text-[#D9431F]' : 'bg-[#F3F3F1] text-[#52525B]'}`}>{badges[t.id]}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto">
        {g && user && colors ? (
          <button onClick={() => onChange('profile')} className="w-full text-left rounded-2xl p-3.5 border border-[#ECECED] hover:border-[#111113]/20 transition-all" style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{colors.glyph}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] font-bold truncate ${g.tier === 'Sovereign' ? 'text-white' : 'text-[#111113]'}`}>
                  {g.tier} Guardian · @{user.username}
                </p>
                <p className={`text-[10px] ${g.tier === 'Sovereign' ? 'text-white/70' : 'text-[#52525B]'}`}>
                  🔥 {user.streakCurrent}-day streak · <Mono>{user.rewardPoints.toLocaleString()}</Mono> pts
                </p>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-black/[0.08] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(g.progress * 100)}%`, background: colors.accent }} />
            </div>
            <p className={`text-[10px] mt-1.5 ${g.tier === 'Sovereign' ? 'text-white/70' : 'text-[#52525B]'}`}>{g.nextTier ? `${g.pointsToNext.toLocaleString()} to ${g.nextTier}` : 'Max tier'}</p>
          </button>
        ) : (
          <div className="rounded-2xl p-3.5 border border-dashed border-[#D4D4D8] text-[11px] text-[#52525B]">Connect a wallet or start a demo wallet to grow your Living Guardian pass.</div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 mt-4 text-[10px] text-[#A1A1AA]">
          <a href="https://github.com/shariqazeem/umanity-social" target="_blank" rel="noopener noreferrer" className="hover:text-[#111113]">
            GitHub
          </a>
          <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#111113]">
            @umanity_xyz
          </a>
          <span>Solana · Anchor · NEAR Intents · x402</span>
        </div>
      </div>
    </aside>
  )
}

export function MobileTabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-[#ECECED] safe-area-bottom">
      <div className="flex items-center justify-around h-[56px]">
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button key={t.id} onClick={() => onChange(t.id)} className={`flex flex-col items-center justify-center w-16 h-full ${isActive ? 'text-[#111113]' : 'text-[#A1A1AA]'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              <span className="text-[9px] font-semibold mt-0.5">{t.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
