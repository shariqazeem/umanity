'use client'

import { useEffect, type ReactNode } from 'react'
import { TopBar } from './TopBar'
import { MobileTabs } from './MobileTabs'

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      localStorage.setItem('umanity.entered', '1')
    } catch {
      /* ignore */
    }
  }, [])
  return (
    <div className="min-h-[100dvh] bg-[#f5f5f7]">
      <TopBar />
      <main className="container-app pt-6 pb-28 md:pb-16">{children}</main>
      <MobileTabs />
    </div>
  )
}
