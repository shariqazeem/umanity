import { DropFeed } from '@/components/drops/DropFeed'
import { NextDrop } from '@/components/drops/NextDrop'
import { SeedProvider } from '@/components/drops/seed'
import { listDrops } from '@/lib/umanity/data'
import { homeFeed } from '@/lib/umanity/feed'

export const dynamic = 'force-dynamic'

/** Arrives with the next drop and the feed already rendered; the client keeps them live. */
export default async function HomePage() {
  const [drops, feed] = await Promise.all([listDrops().catch(() => null), homeFeed({ viewer: null }).catch(() => null)])
  return (
    <SeedProvider seed={{ drops, feed }}>
      <NextDrop />
      <DropFeed />
    </SeedProvider>
  )
}
