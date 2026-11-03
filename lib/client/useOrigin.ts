'use client'

import { useEffect, useState } from 'react'

/**
 * The page origin, safe for text that is server-rendered: the first render
 * uses the configured app URL (same on server and client), then switches to
 * the real origin after mount.
 */
export function useOrigin(): string {
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.xyz')
  useEffect(() => setOrigin(window.location.origin), [])
  return origin
}
