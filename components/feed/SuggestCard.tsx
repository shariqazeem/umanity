'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { apiSend, fmtSol } from '@/lib/client/api'
import type { PublicUser } from '@/lib/data/users'

export function SuggestCard({ u }: { u: PublicUser }) {
  const { address, ensureSigner, toast } = useUmanity()
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const follow = async () => {
    const s = ensureSigner()
    if (!s) return
    setBusy(true)
    try {
      await apiSend('/api/social/follow', { followerAddress: address ?? s.publicKey.toBase58(), followeeAddress: u.address })
      setDone(true)
      toast(`Following @${u.username}.`, 'ok')
    } catch {
      toast('Could not follow right now', 'err')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-600 mb-2.5">Suggested for you</p>
      <div className="flex items-center gap-3">
        <Link href={`/u/${u.username}`}>
          <Avatar username={u.username} url={u.avatarUrl} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/u/${u.username}`} className="text-[13px] font-medium hover:underline">
            @{u.username}
          </Link>
          <p className="text-[11px] text-[#86868b] truncate">{u.bio || (u.totalDonated > 0 ? `${fmtSol(u.totalDonated, 2)} SOL given` : 'New on Umanity')}</p>
        </div>
        <button onClick={follow} disabled={done || busy} className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${done ? 'bg-[#f5f5f7] text-[#86868b]' : 'btn-primary'}`}>
          {done ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  )
}
