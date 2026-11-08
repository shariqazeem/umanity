'use client'

import { useEffect, type ReactNode } from 'react'
import { LeftNav } from './LeftNav'
import { RightRail } from './RightRail'
import { LiveTicker } from './LiveTicker'
import { MobileHeader } from './MobileHeader'
import { MobileTabs } from './MobileTabs'

/**
 * The original Umanity shell: X-style three columns on desktop (nav, stream,
 * widgets), a glass header plus bottom tab bar on mobile.
 */
export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    try {
      localStorage.setItem('umanity.entered', '1')
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="min-h-[100dvh] page-bg">
      {/* Mobile */}
      <MobileHeader />
      <div className="lg:hidden">
        <LiveTicker />
      </div>

      {/* Desktop: X-style 3-column layout */}
      <div className="lg:flex max-w-[1280px] mx-auto min-h-[100dvh]">
        <LeftNav />

        <main className="flex-1 min-w-0 lg:border-r border-black/[0.04]">
          <div className="hidden lg:block sticky top-0 z-30">
            <LiveTicker />
          </div>
          <div className={`px-4 sm:px-5 pt-4 pb-28 lg:pb-12 ${wide ? '' : 'max-w-[680px] mx-auto lg:max-w-none'}`}>
            {children}
          </div>
        </main>

        <RightRail />
      </div>

      <MobileTabs />
    </div>
  )
}
