'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/shared/ui'
import { NAV, isActive } from './nav'

/** The original bottom tab bar: five tabs, labels under icons, glass. */
export function MobileTabs() {
  const pathname = usePathname()
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-black/[0.04] safe-area-bottom">
      <div className="flex items-center justify-around h-[56px] max-w-md mx-auto">
        {NAV.map((tab) => {
          const active = isActive(pathname, tab.match)
          if (tab.href === '/give') {
            return (
              <Link key={tab.href} href={tab.href} aria-label="Give" className="flex items-center justify-center w-14 h-full">
                <span className={`w-11 h-11 -mt-1 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center shadow-lg shadow-black/20 transition-transform duration-200 ${active ? 'scale-105' : 'active:scale-95'}`}>
                  <Icon name="heart" size={20} strokeWidth={2.1} />
                </span>
              </Link>
            )
          }
          return (
            <Link key={tab.href} href={tab.href} className={`flex flex-col items-center justify-center w-14 h-full transition-all duration-200 ${active ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'}`}>
              <span className={`transition-transform duration-300 ${active ? 'scale-105' : ''}`}>
                <Icon name={tab.icon} size={22} strokeWidth={active ? 2.1 : 1.8} />
              </span>
              <span className={`text-[9px] font-medium mt-0.5 ${active ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'}`}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
