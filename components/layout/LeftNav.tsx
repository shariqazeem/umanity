'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Icon } from '@/components/shared/ui'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { short } from '@/lib/client/api'
import { NAV, SECONDARY_NAV, isActive } from './nav'

export function LeftNav() {
  const pathname = usePathname()
  const { signer, user, usdc, isMainnet, openAuth, openWalletSheet } = useUmanity()
  const activeMain = (match: readonly string[]) => isActive(pathname, match)

  return (
    <aside className="hidden lg:flex w-[260px] flex-shrink-0 sticky top-0 h-[100dvh] flex-col border-r border-black/[0.04] px-3 py-5">
      <Link href="/home" className="px-3 mb-6 inline-flex items-center gap-2.5 w-fit">
        <Image src="/logo.png" alt="Umanity" width={42} height={42} className="rounded-full" priority />
      </Link>

      <nav className="flex-1 space-y-0.5">
        {NAV.map((tab) => {
          const active = activeMain(tab.match)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] transition-all duration-200 ${
                active ? 'text-[#1d1d1f] font-bold bg-black/[0.04]' : 'text-[#525252] font-medium hover:bg-black/[0.03]'
              }`}
            >
              <span className={`transition-transform ${active ? 'scale-110' : ''}`}>
                <Icon name={tab.icon} size={22} strokeWidth={active ? 2.1 : 1.8} />
              </span>
              {tab.label}
            </Link>
          )
        })}

        <div className="h-px bg-black/[0.04] mx-3 !my-3" />

        {SECONDARY_NAV.map((tab) => {
          const active = isActive(pathname, tab.match)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2 rounded-xl text-[14px] transition-all duration-200 ${
                active ? 'text-[#1d1d1f] font-bold bg-black/[0.04]' : 'text-[#525252] font-medium hover:bg-black/[0.03]'
              }`}
            >
              <Icon name={tab.icon} size={20} strokeWidth={active ? 2.1 : 1.8} />
              {tab.label}
              {'badge' in tab && tab.badge && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">{tab.badge}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 mb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
          <div className="pulse-dot" />
          {isMainnet ? 'Solana Mainnet' : 'Solana Devnet'}
        </div>
      </div>

      <div className="px-1 space-y-2">
        {signer ? (
          <div className="flex items-center gap-1">
            <button onClick={openWalletSheet} className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-black/[0.03] transition-colors text-left">
              <Avatar username={user?.username || 'u'} url={user?.avatarUrl} size={36} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold truncate">{user ? `@${user.username}` : short(signer.publicKey.toBase58())}</span>
                <span className="block text-[11px] text-[#86868b] counter">
                  {usdc == null ? '…' : `$${usdc.toFixed(2)} USDC`}
                  {user && user.streakCurrent > 0 && <span className="ml-1.5">· 🔥 {user.streakCurrent}</span>}
                </span>
              </span>
            </button>
            <div className="notif-up">
              <NotificationBell />
            </div>
          </div>
        ) : (
          <button onClick={openAuth} className="btn-primary w-full py-3 text-[14px]">
            Sign in
          </button>
        )}
      </div>
    </aside>
  )
}
