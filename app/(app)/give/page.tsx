'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { OneTapGive } from '@/components/give/OneTapGive'
import { CauseCard, CauseCardSkeleton } from '@/components/causes/CauseCard'
import { useCauseList } from '@/components/causes/data'
import { explorerAccount, UMANITY_DONATIONS_PROGRAM_ID } from '@/lib/solana/constants'
import { short } from '@/lib/client/api'

const CHAINS = ['Ethereum', 'Base', 'Arbitrum', 'Bitcoin', 'TON', 'NEAR', 'Tron', 'BNB', 'Polygon', 'Solana']

export default function GivePage() {
  const { items } = useCauseList()
  const { openGive } = useUmanity()

  return (
    <div className="space-y-8">
      <section className="pt-2">
        <h2 className="text-2xl font-bold tracking-[-0.02em] mb-1">Make an impact</h2>
        <p className="text-[#86868b] text-sm">Every gift waits in an on-chain escrow vault until the delivery is filmed, receipted, verified and approved.</p>
      </section>

      <OneTapGive />

      {/* Any chain */}
      <section className="card p-6 md:p-7 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-emerald-100/70 to-sky-100/40 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-widest mb-3">Give from any chain</p>
            <h3 className="text-[22px] md:text-[26px] font-bold tracking-tight leading-tight mb-2">Hold USDC on Base? ETH? BTC? Give it as-is.</h3>
            <p className="text-[#86868b] text-sm leading-relaxed max-w-md">One deposit address takes funds from 30+ chains. NEAR Intents solvers swap them to SOL and settle straight into the cause&apos;s Solana escrow. No bridge, no swap, no second wallet.</p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {CHAINS.map((c) => (
                <span key={c} className="pill bg-white border border-black/[0.05] text-[#525252] !text-[10px]">
                  {c}
                </span>
              ))}
              <span className="pill bg-black/[0.04] text-[#86868b] !text-[10px]">+20 more</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:w-[220px]">
            <button onClick={() => openGive({ method: 'anychain' })} className="btn-primary py-3.5 text-[14px]">
              🌐 Give from another chain
            </button>
            <p className="text-[10px] text-[#aeaeb2] text-center">Aurora Intents · NEAR Intents · settles on Solana</p>
          </div>
        </div>
      </section>

      {/* Causes */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight mb-0.5">Causes</h3>
            <p className="text-[13px] text-[#86868b]">Pick one. Each is a separate vault with its own receipts.</p>
          </div>
          <span className="text-[11px] text-[#aeaeb2] font-medium whitespace-nowrap flex-shrink-0 ml-3">6 active</span>
        </div>

        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/40 p-4 mb-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm flex-shrink-0">🔐</div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-emerald-800">Transparent on-chain escrow</p>
            <p className="text-[12px] text-emerald-700/80 leading-relaxed mt-0.5">Gifts go to Anchor vault PDAs, not to anyone&apos;s wallet. A milestone only releases after the field team posts photos and receipts, the AI oracle audits them, and the donors of that cause vote yes.</p>
            <a href={explorerAccount(UMANITY_DONATIONS_PROGRAM_ID)} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-[11px] font-mono text-emerald-700 hover:underline">
              Donations program {short(UMANITY_DONATIONS_PROGRAM_ID)} →
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-stagger">{items === null ? [1, 2, 3, 4].map((i) => <CauseCardSkeleton key={i} />) : items.map((c) => <CauseCard key={c.id} c={c} />)}</div>
      </section>

      {/* More ways */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/blinks" className="card-interactive p-5">
          <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-lg mb-3">⚡</div>
          <p className="font-semibold text-[15px]">Give from X with Blinks</p>
          <p className="text-[12px] text-[#86868b] mt-1 leading-relaxed">Every cause is a Solana Blink. Paste it in a post and anyone can give without leaving their timeline.</p>
          <p className="text-[12px] font-semibold text-emerald-600 mt-3">Copy a Blink →</p>
        </Link>
        <Link href="/agents" className="agent-card p-5 block transition-transform hover:-translate-y-0.5">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg mb-3">🤖</div>
          <p className="font-semibold text-[15px]">Let your agents give</p>
          <p className="text-[12px] text-[#86868b] mt-1 leading-relaxed">One HTTP request with x402. Any app, bot or AI agent pays in USDC on Solana and gets a signed receipt back.</p>
          <p className="text-[12px] font-semibold text-emerald-600 mt-3">Open the Give API →</p>
        </Link>
      </section>
    </div>
  )
}
