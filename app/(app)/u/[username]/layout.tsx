import type { Metadata } from 'next'
import { findUserByUsername } from '@/lib/data/users'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const handle = decodeURIComponent(username).replace(/^@/, '').toLowerCase()
  const u = await findUserByUsername(handle).catch(() => null)
  if (!u) return { title: `@${handle}` }
  const sol = (u.totalDonatedLamports / 1e9).toFixed(2)
  const description = `@${u.username} has given ${sol} SOL across ${u.donationCount} gifts on Umanity, every one held in escrow until it was delivered and proven.`
  return { title: `@${u.username}`, description, openGraph: { title: `@${u.username} on Umanity`, description }, twitter: { card: 'summary_large_image', title: `@${u.username} on Umanity`, description } }
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children
}
