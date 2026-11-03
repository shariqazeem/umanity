import type { Metadata } from 'next'
import { getCause } from '@/lib/causes'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const c = getCause(id)
  if (!c) return { title: 'Cause' }
  const description = `${c.tagline} ${c.impact} Held in escrow on Solana until the delivery is filmed, verified and approved.`
  return { title: c.name, description, openGraph: { title: `${c.emoji} ${c.name} · Umanity`, description }, twitter: { card: 'summary_large_image', title: `${c.emoji} ${c.name} · Umanity`, description } }
}

export default function CauseLayout({ children }: { children: React.ReactNode }) {
  return children
}
