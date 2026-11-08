import type { Metadata } from 'next'
import { findUserByUsername } from '@/lib/data/users'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const handle = decodeURIComponent(username).replace(/^@/, '').toLowerCase()
  const u = await findUserByUsername(handle).catch(() => null)
  if (!u) return { title: `@${handle}` }
  const gifts = u.donationCount === 1 ? '1 gift' : `${u.donationCount} gifts`
  const description = `@${u.username} on Umanity: ${gifts} into USDC pots on Solana that pay out only when each delivery is filmed.`
  return { title: `@${u.username}`, description, openGraph: { title: `@${u.username} on Umanity`, description }, twitter: { card: 'summary_large_image', title: `@${u.username} on Umanity`, description } }
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children
}
