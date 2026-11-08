import { DropDetailView } from '@/components/drops/DropDetailView'
import { SeedProvider } from '@/components/drops/seed'
import { getDrop } from '@/lib/umanity/data'

export const dynamic = 'force-dynamic'

/** Arrives with the drop already rendered; the client keeps it live. */
export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const n = Number((await params).id)
  const drop = Number.isInteger(n) && n >= 1 ? await getDrop(n - 1).catch(() => null) : null
  return (
    <SeedProvider seed={{ drop }}>
      <DropDetailView />
    </SeedProvider>
  )
}
