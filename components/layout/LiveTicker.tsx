'use client'

import { useEffect, useState } from 'react'
import { apiGet, fmtSol } from '@/lib/client/api'
import { chainLabel, type ActivityRow } from '@/components/feed/types'

/** The original live strip: only real, recorded activity; hidden until there is some. */
export function LiveTicker() {
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    const load = () =>
      apiGet<{ activities?: ActivityRow[] }>('/api/activity?limit=12')
        .then((d) => {
          if (!alive) return
          setItems((d.activities ?? []).slice(0, 12).map(describe))
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

function describe(a: ActivityRow): string {
  const amt = `${fmtSol(a.amount, a.amount < 0.1 ? 3 : 2)} SOL`
  switch (a.type) {
    case 'intent':
    case 'intent_settled':
      return `🌐 ${a.username ? `@${a.username}` : 'Someone'} gave ${amt} from ${chainLabel(a.sourceChain) ?? 'another chain'} to ${a.poolName}`
    case 'discreet':
      return `🛡️ A private gift of ${amt} reached ${a.poolName}`
    case 'payout':
      return `✅ ${amt} released from ${a.poolName} escrow`
    case 'agent':
      return `🤖 An agent gave ${a.sourceAmount ? `$${a.sourceAmount} USDC` : amt} to ${a.poolName} via x402`
    default:
      return `💚 @${a.username} gave ${amt} to ${a.poolName}`
  }
}
