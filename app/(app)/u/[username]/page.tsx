'use client'

import { useParams } from 'next/navigation'
import { ProfileView } from '@/components/profile/ProfileView'

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const handle = decodeURIComponent(username || '').replace(/^@/, '').toLowerCase()
  return <ProfileView username={handle} mode="public" />
}
