'use client'

import Link from 'next/link'
import { Lockup } from '@/components/brand/Logo'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { NotificationBell } from './NotificationBell'

export function MobileHeader() {
  const { signer, user, isMainnet, openAuth, openWalletSheet } = useUmanity()
  return (
    <header className="lg:hidden sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-black/[0.04]">
      <div className="px-5 h-[52px] flex items-center justify-between">
        <Link href="/home" aria-label="Umanity home">
          <Lockup size={24} />
        </Link>
        <div className="flex items-center gap-2">
          {!isMainnet && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] text-[10px] text-[#4F5B5E] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Devnet
            </span>
          )}
          {signer ? (
            <>
              <NotificationBell />
              <button onClick={openWalletSheet} aria-label="Wallet" className="rounded-full">
                <Avatar username={user?.username || 'u'} url={user?.avatarUrl} size={32} />
              </button>
            </>
          ) : (
            <button onClick={openAuth} className="btn-primary h-9 px-4 !text-[13px]">
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
