'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/client/api'
import { activityLine } from '@/components/drops/activity'
import type { HomeItem } from '@/lib/umanity/feed'

/** The original live strip: only real, recorded activity; hidden until there is some. */
export function LiveTicker() {
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    const load = () =>
      apiGet<{ items?: HomeItem[] }>('/api/feed/drops?limit=16')
        .then((d) => {
          if (!alive) return
          setItems((d.items ?? []).filter((i) => i.type !== 'post').slice(0, 12).map(activityLine).filter(Boolean))
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  if (items.length === 0) return null
  const line = items.join('    //    ')
  const doubled = `${line}    //    ${line}    //    `

  return (
    <div className="ticker-container bg-[#fafafa]/90 backdrop-blur-sm border-b border-black/[0.03] py-2 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Live</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="ticker-content text-[11px] text-[#aeaeb2] font-medium">{doubled}</div>
        </div>
      </div>
    </div>
  )
}
