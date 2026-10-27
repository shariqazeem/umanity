'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { WalletButton } from '@/components/wallet/WalletButton'
import { apiGet, fmtSol, fmtUsd, short } from '@/lib/client/api'
import { Btn, Mono, Pill } from '@/components/shared/ui'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'

export interface PlatformStats {
  totalDonations: number
  totalEscrowed: number
  totalDonors: number
  totalTransactions: number
  crossChainVolume: number
  crossChainCount: number
  discreetVolume: number
  x402Calls: number
  x402Revenue: string
  proposals: number
  activeProposals: number
  escrowAwaitingVote: number
  openDares: number
  darePot: number
  network: string
}

export function useStats(intervalMs = 30_000) {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => apiGet<{ stats?: PlatformStats }>('/api/platform/stats').then((d) => alive && d.stats && setStats(d.stats)).catch(() => {})
    load()
    const t = setInterval(load, intervalMs)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [intervalMs])
  return stats
}

export function TopBar({ onGive }: { onGive: () => void }) {
  const { signer, user, balance, solPrice, startDemo, stopDemo, toast } = useUmanity()
  const stats = useStats()
  const [starting, setStarting] = useState(false)

  const demo = async () => {
    setStarting(true)
    const r = await startDemo()
    setStarting(false)
    if (r.error) toast(r.error, 'err')
    else toast(r.funded ? 'Demo wallet funded with devnet SOL. Try a donation.' : 'Demo wallet ready.', 'ok')
  }

  const usd = (sol: number) => (solPrice ? ` (${fmtUsd(sol * solPrice)})` : '')

  return (
    <header className="sticky top-0 z-50 h-14 bg-white/[0.86] backdrop-blur-xl border-b border-[#ECECED]">
      <div className="h-full px-4 lg:px-6 flex items-center gap-4">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Image src="/logo.png" alt="Umanity" width={30} height={30} className="rounded-full" />
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#52525B] whitespace-nowrap">
            <span className="pulse-dot" />
            <span className="capitalize">Solana {SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet' : 'devnet'}</span>
            <span className="hidden xl:inline text-[#D4D4D8]">·</span>
            <span className="hidden xl:inline">31+ chains via NEAR Intents</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-5 text-[11px] text-[#52525B] flex-1 min-w-0 justify-center overflow-hidden whitespace-nowrap">
          {stats ? (
            <>
              <Stat label="Escrowed" value={`${fmtSol(stats.totalEscrowed, 2)} SOL`} sub={usd(stats.totalEscrowed)} />
              <Stat label="Cross-chain" value={`${stats.crossChainCount} intents`} sub={stats.crossChainVolume > 0 ? ` · ${fmtSol(stats.crossChainVolume, 2)} SOL` : ''} />
              <Stat label="Oracle calls" value={`${stats.x402Calls}`} sub={Number(stats.x402Revenue) > 0 ? ` · $${Number(stats.x402Revenue).toFixed(2)}` : ''} />
              <Stat label="Live dares" value={`${stats.openDares}`} sub={stats.darePot > 0 ? ` · ${fmtSol(stats.darePot, 2)} SOL pot` : ''} tone="coral" />
              <Stat label="Votes open" value={`${stats.activeProposals}`} sub={stats.escrowAwaitingVote > 0 ? ` · ${fmtSol(stats.escrowAwaitingVote, 2)} SOL` : ''} />
            </>
          ) : (
            <span className="skeleton h-4 w-80 rounded" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 min-w-0 whitespace-nowrap">
          <Btn tone="outline" size="sm" className="hidden sm:inline-flex" onClick={onGive}>
            🌐 <span className="hidden xl:inline">Give from</span> any chain
          </Btn>
          {!signer && (
            <Btn tone="emerald" size="sm" onClick={demo} loading={starting} title="Creates a browser wallet funded with devnet SOL so you can try everything in seconds">
              ⚡ <span className="hidden xl:inline">Instant</span> demo wallet
            </Btn>
          )}
          {signer?.kind === 'demo' && (
            <div className="flex items-center gap-1.5 pl-2.5 pr-1 h-9 rounded-full bg-emerald-50 border border-emerald-100 min-w-0">
              <Pill tone="emerald">DEMO</Pill>
              <Mono className="hidden sm:inline text-[11px] text-emerald-800">{short(signer.publicKey.toBase58())}</Mono>
              {balance != null && <Mono className="text-[11px] text-emerald-700">{fmtSol(balance, 2)} SOL</Mono>}
              <button onClick={stopDemo} className="w-6 h-6 rounded-full hover:bg-emerald-100 text-emerald-700 text-[12px]" title="Forget demo wallet">
                ×
              </button>
            </div>
          )}
          {signer?.kind === 'wallet' && balance != null && (
            <Mono className="hidden md:inline text-[11px] text-[#52525B]">{fmtSol(balance, 2)} SOL</Mono>
          )}
          {user && signer?.kind === 'wallet' && <span className="hidden md:inline text-[12px] font-semibold">@{user.username}</span>}
          <WalletButton />
        </div>
      </div>
    </header>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'coral' }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
      <span className="text-[#A1A1AA]">{label}</span>
      <Mono className={`font-semibold ${tone === 'coral' ? 'text-[#D9431F]' : 'text-[#111113]'}`}>
        {value}
        {sub && <span className="font-normal text-[#A1A1AA]">{sub}</span>}
      </Mono>
    </span>
  )
}
