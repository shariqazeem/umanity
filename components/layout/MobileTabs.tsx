'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon } from '@/components/shared/ui'

const TABS = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/causes', label: 'Causes', icon: 'heart' },
  { href: '/transparency', label: 'Proof', icon: 'shieldCheck' },
  { href: '/profile', label: 'You', icon: 'user' },
]

export function MobileTabs() {
  const pathname = usePathname()
  const { openGive } = useUmanity()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-black/[0.06] safe-bottom">
      <div className="relative grid grid-cols-5 h-[60px] items-center">
        {TABS.slice(0, 2).map((t) => (
          <Tab key={t.href} {...t} active={pathname === t.href || (t.href !== '/home' && pathname.startsWith(t.href))} />
        ))}
        <div className="flex items-center justify-center">
          <button onClick={() => openGive()} aria-label="Give" className="w-14 h-14 -mt-7 rounded-full bg-[#10b981] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.4)] active:scale-95 transition-transform">
            <Icon name="heart" size={24} strokeWidth={2.2} />
          </button>
        </div>
        {TABS.slice(2).map((t) => (
          <Tab key={t.href} {...t} active={pathname === t.href || pathname.startsWith(t.href)} />
        ))}
      </div>
    </nav>
  )
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center gap-0.5 h-full ${active ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'}`}>
      <Icon name={icon} size={22} strokeWidth={active ? 2.2 : 1.8} />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  )
}
