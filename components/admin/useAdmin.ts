'use client'

import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet } from '@/lib/client/api'

/** Whether the current wallet is on the field-team admin list (GET /api/admin/me). */
export function useAdmin() {
  const { address } = useUmanity()
  const [state, setState] = useState<{ isAdmin: boolean | null; error: string | null }>({ isAdmin: null, error: null })
  useEffect(() => {
    if (!address) {
      setState({ isAdmin: null, error: null })
      return
    }
    let alive = true
    apiGet<{ success?: boolean; isAdmin?: boolean; error?: string }>(`/api/admin/me?address=${address}`)
      .then((d) => alive && setState({ isAdmin: !!d?.isAdmin, error: d?.success === false ? d.error ?? 'Admin check failed' : null }))
      .catch((e) => alive && setState({ isAdmin: false, error: e instanceof Error ? e.message : 'Admin check unavailable' }))
    return () => {
      alive = false
    }
  }, [address])
  return state
}
