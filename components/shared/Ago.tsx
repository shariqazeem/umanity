'use client'

import { timeAgo } from '@/lib/client/api'

/** "6m" text. The server's render and the browser's can be a minute apart, so React is told that's expected. */
export function Ago({ at }: { at: string }) {
  return <span suppressHydrationWarning>{timeAgo(at)}</span>
}
