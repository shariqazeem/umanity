'use client'

import { Suspense } from 'react'
import { SmartFeed } from '@/components/feed/SmartFeed'

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2.5 pt-2">
          <div className="skeleton h-10 w-40" />
          <div className="skeleton h-28" />
          <div className="skeleton h-32" />
        </div>
      }
    >
      <SmartFeed />
    </Suspense>
  )
}
