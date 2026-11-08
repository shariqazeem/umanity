import { GiveDrops } from '@/components/drops/GiveDrops'
import { SeedProvider } from '@/components/drops/seed'
import { listDrops } from '@/lib/umanity/data'

export const dynamic = 'force-dynamic'

export default async function GivePage() {
  const drops = await listDrops().catch(() => null)
  return (
    <SeedProvider seed={{ drops }}>
      <GiveDrops />
    </SeedProvider>
  )
}
