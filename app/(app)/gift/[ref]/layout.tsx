import type { Metadata } from 'next'
import { getGiftJourney } from '@/lib/data/journey'

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params
  const j = await getGiftJourney(decodeURIComponent(ref)).catch(() => null)
  if (!j) return { title: 'Gift' }
  const amount = j.route === 'x402' && j.sourceAmount ? `$${j.sourceAmount} USDC` : `${j.amountSol.toFixed(j.amountSol < 0.1 ? 3 : 2)} SOL`
  const title = `${amount} to ${j.cause.name} — ${j.progress} of ${j.steps.length} steps`
  const description = `Follow this gift from the wallet to the hand-over: ${j.steps.map((s) => `${s.title}${s.state === 'done' ? ' ✓' : ''}`).join(' → ')}.`
  return { title, description, openGraph: { title: `${title} · Umanity`, description }, twitter: { card: 'summary_large_image', title: `${title} · Umanity`, description } }
}

export default function GiftLayout({ children }: { children: React.ReactNode }) {
  return children
}
