import { AppShell } from '@/components/layout/AppShell'
import { SeedProvider } from '@/components/drops/seed'
import { moneySummary } from '@/lib/umanity/data'
import { homeFeed, topBackers } from '@/lib/umanity/feed'

export const dynamic = 'force-dynamic'

/** The shell arrives with the rail's numbers, backers and activity already rendered. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [money, backers, feed] = await Promise.all([moneySummary().catch(() => null), topBackers(25).catch(() => null), homeFeed({ viewer: null, limit: 12 }).catch(() => null)])
  return (
    <SeedProvider seed={{ money, backers, feed }}>
      <AppShell>{children}</AppShell>
    </SeedProvider>
  )
}
