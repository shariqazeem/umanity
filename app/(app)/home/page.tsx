'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/shared/ui'
import { HomeFeed } from '@/components/feed/HomeFeed'

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[680px] mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-56" />
          <Skeleton className="h-36" />
        </div>
      }
    >
      <HomeFeed />
    </Suspense>
  )
}
