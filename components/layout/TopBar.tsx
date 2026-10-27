'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Avatar, Pill, Icon } from '@/components/shared/ui'
import { fmtSol } from '@/lib/client/api'

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/causes', label: 'Causes' },
  { href: '/transparency', label: 'Transparency' },
  { href: '/how-it-works', label: 'How it works' },
]

export function TopBar() {
  const pathname = usePathname()
  const { signer, user, balance, isMainnet, openGive, openAuth, openWalletSheet } = useUmanity()
  return (
    <header className="sticky top-0 z-50 glass hairline-b">
      <div className="container-app h-16 flex items-center gap-6">
        <Link href="/home" className="flex items-center gap-2.5 flex-shrink-0">
          <Image src="/logo.png" alt="Umanity" width={34} height={34} className="rounded-full" priority />
          <span className="hidden sm:inline text-[17px] font-bold tracking-[-0.02em]">Umanity</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/home' && pathname.startsWith(n.href))
            return (
              <Link key={n.href} href={n.href} className={`px-3.5 h-9 inline-flex items-center rounded-full text-[13.5px] font-semibold transition-colors ${active ? 'bg-black/[0.06] text-[#1d1d1f]' : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'}`}>
                {n.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isMainnet && (
            <Pill tone="gray" className="hidden sm:inline-flex">
              Devnet
            </Pill>
          )}
          <Btn tone="accent" size="md" icon="heart" onClick={() => openGive()} className="hidden sm:inline-flex">
            Give
          </Btn>
          {signer ? (
            <button onClick={openWalletSheet} className="flex items-center gap-2 pl-1 pr-3 h-10 rounded-full border border-black/[0.08] bg-white hover:border-black/30 transition-colors">
              <Avatar username={user?.username || 'u'} url={user?.avatarUrl} size={30} />
              <span className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-[12.5px] font-semibold">{user?.handleClaimed ? `@${user.username}` : 'Your wallet'}</span>
                <span className="text-[11px] text-[#6e6e73] num mt-0.5">{balance == null ? '…' : `${fmtSol(balance, 2)} SOL`}</span>
              </span>
            </button>
          ) : (
            <Btn tone="outline" size="md" onClick={openAuth}>
              Sign in
            </Btn>
          )}
          <Link href="/profile" className="hidden lg:inline-flex w-10 h-10 rounded-full items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]" aria-label="Profile">
            <Icon name="user" size={20} />
          </Link>
        </div>
      </div>
    </header>
  )
}
