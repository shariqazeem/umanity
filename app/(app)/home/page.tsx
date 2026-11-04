'use client'

import { DropFeed } from '@/components/drops/DropFeed'
import { NextDrop } from '@/components/drops/NextDrop'

export default function HomePage() {
  return (
    <>
      <NextDrop />
      <DropFeed />
    </>
  )
}
