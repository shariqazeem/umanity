import type { Metadata } from 'next'
import { getDare } from '@/lib/data/dares'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const d = await getDare(id).catch(() => null)
  if (!d) return { title: 'Dare' }
  const title = `@${d.creator.username} dared @${d.targetHandle}`
  const description = `"${d.text}" — ${d.pot.toFixed(3)} SOL on the line for ${d.poolName}. Boost the pot; it goes to the cause either way.`
  return { title, description, openGraph: { title: `⚡ ${title} · Umanity`, description }, twitter: { card: 'summary_large_image', title: `⚡ ${title}`, description } }
}

export default function DareLayout({ children }: { children: React.ReactNode }) {
  return children
}
