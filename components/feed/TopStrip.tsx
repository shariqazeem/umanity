'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Icon } from '@/components/shared/ui'
import { guardianFor } from '@/lib/guardian'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TopStrip() {
  const { user, signer, openAuth, openGive } = useUmanity()
  if (!signer || !user) {
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-[32px] leading-none">Welcome.</h1>
        <button onClick={openAuth} className="text-[13.5px] text-[#6e6e73] hover:text-[#1d1d1f] inline-flex items-center gap-1.5">
          Sign in to keep a streak and see what friends give <Icon name="arrowRight" size={14} />
        </button>
      </div>
    )
  }
  const g = guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount })
  const name = user.handleClaimed ? user.displayName || user.username : ''
  const streak = user.streakCurrent
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Link href="/profile" className="flex items-center gap-3 min-w-0">
        <Avatar username={user.username} url={user.avatarUrl} size={40} />
        <h1 className="font-display text-[30px] sm:text-[32px] leading-none truncate">
          {greeting()}
          {name ? `, ${name}` : ''}.
        </h1>
      </Link>
      <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
        <button onClick={() => openGive()} className={`pill h-8 px-3 ${streak > 0 ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-black/[0.05] text-[#6e6e73]'}`} title={streak > 0 ? 'Give today to keep your streak' : 'Give today to start a streak'}>
          <Icon name="flame" size={13} />
          {streak > 0 ? `${streak}-day streak · give today to keep it` : 'Start a streak today'}
        </button>
        <Link href="/profile" className="pill h-8 px-3 bg-black/[0.05] text-[#1d1d1f]" title="Your Living Guardian tier">
          <Icon name="spark" size={13} />
          {g.tier}
        </Link>
      </div>
    </div>
  )
}
