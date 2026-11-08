import { SeedProvider } from '@/components/drops/seed'
import { listDrops, moneySummary } from '@/lib/umanity/data'
import { Landing } from './Landing'

export const dynamic = 'force-dynamic'

/** The landing arrives with the live drop and the real totals already rendered. */
export default async function LandingPage() {
  const [drops, money] = await Promise.all([listDrops().catch(() => null), moneySummary().catch(() => null)])
  return (
    <SeedProvider seed={{ drops, money }}>
      <Landing />
    </SeedProvider>
  )
}
