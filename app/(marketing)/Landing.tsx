'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, timeAgo } from '@/lib/client/api'
import { Img } from '@/components/shared/ui'
import { pickNextDrop, useDrops, useMoney } from '@/components/drops/hooks'
import { DropMeter, StatePill, dayText, dropHref } from '@/components/drops/DropParts'
import { usdText } from '@/lib/umanity/drops'
import type { HomeItem } from '@/lib/umanity/feed'

const GITHUB = 'https://github.com/shariqazeem/umanity'

export function Landing() {
  const router = useRouter()
  const { openAuth, signer, isMainnet } = useUmanity()

  // Returning people go straight to the app; ?stay=1 shows this page anyway.
  useEffect(() => {
    try {
      const stay = new URLSearchParams(window.location.search).has('stay')
      if (!stay && localStorage.getItem('umanity.entered') === '1') router.replace('/home')
    } catch {
      /* ignore */
    }
  }, [router])

  return (
    <div className="min-h-[100dvh] bg-white overflow-hidden">
      {/* Floating header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/?stay=1">
            <Image src="/logo.png" alt="Umanity" width={38} height={38} className="rounded-full" priority />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/home" className="hidden sm:block text-[13px] text-[#86868b] hover:text-[#1d1d1f] font-medium transition-colors">
              Explore App
            </Link>
            <Link href="/agents" className="hidden sm:block text-[13px] text-[#86868b] hover:text-[#1d1d1f] font-medium transition-colors">
              Agents
            </Link>
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hidden sm:block text-[13px] text-[#86868b] hover:text-[#1d1d1f] font-medium transition-colors">
              GitHub
            </a>
            {signer ? (
              <Link href="/home" className="btn-primary h-10 px-5 !text-[13px]">
                Open app
              </Link>
            ) : (
              <button onClick={openAuth} className="btn-primary h-10 px-5 !text-[13px]">
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ===== HERO ===== */}
        <section className="relative min-h-[100dvh] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 via-white to-white" />
          <div className="relative max-w-6xl mx-auto px-6 pt-20 sm:pt-24 pb-16 w-full lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:items-center">
            <div className="max-w-3xl animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/40 text-[11px] font-semibold text-emerald-700 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live on Solana {isMainnet ? 'Mainnet' : 'Devnet'} · USDC pots · refunds by code
              </div>

              <h1 className="text-[clamp(2.8rem,8vw,6rem)] font-black tracking-[-0.04em] leading-[0.88] mb-6 sm:mb-8 text-[#1d1d1f]">
                Crypto giving
                <br />
                <span className="text-[#d4d4d4] line-through decoration-[#e5e5e5] decoration-[3px]">on trust.</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">On camera.</span>
              </h1>

              <p className="text-lg md:text-[22px] text-[#86868b] max-w-xl leading-[1.45] mb-7 sm:mb-10 [text-wrap:balance]">
                Your dollars wait in a pot on Solana until the delivery is filmed. Late? The program sends them back.
              </p>

              <div className="flex flex-row items-start gap-3 mb-6">
                <Link href="/home" className="btn-primary px-5 sm:px-7 py-3.5 text-[14px]">
                  Open the app
                </Link>
                <Link href="/give" className="btn-secondary px-5 sm:px-7 py-3.5 text-[14px] font-medium">
                  ♡ Fill the next drop
                </Link>
              </div>

              <div className="hidden sm:flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[#aeaeb2]">
                {[
                  { label: 'USDC pots on Solana', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
                  { label: 'Refunds by code', icon: 'M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3' },
                  { label: 'Filmed deliveries', icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z' },
                  { label: 'Agents welcome', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z' },
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-2 sm:mt-10 lg:mt-0">
              <HeroDrop />
            </div>
          </div>
        </section>

        <StatsRow />

        {/* ===== HOW A DROP WORKS ===== */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.2em] mb-3">How a drop works</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#1d1d1f] mb-3">One delivery. One pot. Rules in code.</h2>
              <p className="text-[#86868b] text-base max-w-lg mx-auto">A drop is one real delivery with a shopping list, a place and a date. Every step leaves a record you can open.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { n: '01', icon: '♡', title: 'Fill', body: 'Give USDC in one tap, from any chain, or from an AI agent over x402. Umanity pays the network fee.' },
                { n: '02', icon: '🔐', title: 'Pot', body: "The money sits in the drop's own USDC pot, owned by the program. It can pay the drop's supplier or its backers, nobody else." },
                { n: '03', icon: '🎥', title: 'Deliver and film', body: 'The team buys the goods, hands them over and films it. The proof is hashed onto Solana, then a review window runs.' },
                { n: '04', icon: '🔓', title: 'Unlock or refund', body: 'After review the pot pays the supplier. If the drop misses its date, every backer gets their money back.' },
              ].map((s) => (
                <div key={s.n} className="relative bg-white rounded-2xl p-6 border border-black/[0.05] hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-lg">{s.icon}</div>
                    <span className="text-[11px] font-bold text-[#d4d4d4] counter">{s.n}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1d1d1f] mb-1.5">{s.title}</h3>
                  <p className="text-[13px] text-[#86868b] leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== THE LOOP ===== */}
        <LoopSection />

        {/* ===== WHAT CRYPTO GIVING GOT WRONG ===== */}
        <section className="py-20 md:py-28 bg-[#fafafa]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.2em] mb-3">What crypto giving got wrong &rarr; What Umanity does</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#1d1d1f] mb-3">Six fixes. One app.</h2>
              <p className="text-[#86868b] text-base max-w-lg mx-auto">Built on the version that won Superteam and the Solana Graveyard Hackathon, rebuilt around real deliveries and real money flows.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIXES.map((r) => (
                <div key={r.dead} className="group bg-white rounded-2xl p-6 border border-black/[0.05] hover:border-emerald-200/60 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">🪦</span>
                    <span className="text-[13px] font-bold text-[#aeaeb2] line-through">{r.dead}</span>
                  </div>
                  <p className="text-[11px] text-[#aeaeb2] leading-relaxed mb-4">{r.why}</p>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-px bg-black/[0.06]" />
                    <span className="text-[10px] font-bold text-emerald-600">FIXED</span>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-[15px] font-bold text-[#1d1d1f]">{r.alive}</h3>
                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">{r.tag}</span>
                  </div>
                  <p className="text-[12px] text-[#86868b] leading-relaxed mb-3">{r.how}</p>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-semibold text-emerald-700">{r.stat}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== ON CAMERA ===== */}
        <FieldSection />

        {/* ===== TECH DEPTH ===== */}
        <section className="py-16 md:py-20 bg-[#1d1d1f] text-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em] mb-2">The rules live in code</h2>
              <p className="text-white/50 text-sm">One Anchor program holds every pot and every fee. The Money tab reads it back.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { num: '18', label: 'On-chain instructions', sub: 'pots, proof, refunds, fee split' },
                { num: '50/50', label: 'Every fee, split by code', sub: 'drops and Umanity' },
                { num: '0.5%', label: 'Swap fee', sub: "below Phantom's 0.85%" },
                { num: 'x402', label: 'Agents fill pots', sub: 'USDC on Solana, no keys' },
              ].map((s) => (
                <div key={s.label} className="text-center py-4">
                  <p className="text-3xl md:text-4xl font-black counter mb-1">{s.num}</p>
                  <p className="text-[13px] font-medium text-white/80">{s.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#1d1d1f] mb-4">Feed someone today.</h2>
            <p className="text-[#86868b] text-base mb-8 max-w-md mx-auto">Browse without a wallet. Give in one tap. Watch the delivery it pays for.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/home" className="btn-primary px-7 py-3.5 text-[14px]">
                Open the app
              </Link>
              <Link href="/agents" className="btn-secondary px-7 py-3.5 text-[14px] font-medium">
                🤖 Give from an agent
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-black/[0.04] py-8 px-6 bg-[#fafafa]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Umanity" width={28} height={28} className="rounded-full" />
              <span className="text-[11px] text-[#aeaeb2]">Crypto giving, on camera.</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-[#aeaeb2]">
              <Link href="/money" className="hover:text-[#86868b]">
                Money
              </Link>
              <Link href="/agents" className="hover:text-[#86868b]">
                Agents API
              </Link>
              <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#86868b]">
                @umanity_xyz
              </a>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-[#86868b]">
                GitHub
              </a>
              <span>&copy; 2026</span>
            </div>
          </div>
          <p className="max-w-5xl mx-auto text-[10.5px] text-[#c7c7cc] mt-4 text-center sm:text-left">
            Umanity is a crypto app, not a registered charity, and gifts are not tax-deductible. $UMANITY is not an investment and comes with no promise of returns.
          </p>
        </footer>
      </main>
    </div>
  )
}

const FIXES = [
  {
    dead: 'Donations disappear',
    why: 'You send money to a wallet and never hear about it again.',
    alive: 'Pots that pay after proof',
    how: "Each drop's USDC sits in a pot owned by the program. It pays the drop's supplier only after the filmed proof clears review.",
    tag: 'Anchor',
    stat: 'Program-owned pots',
  },
  {
    dead: 'Refunds never happen',
    why: 'If the delivery falls through, the money quietly stays where it is.',
    alive: 'Refunds by code',
    how: 'Miss the date and the program opens refunds. Umanity sends them for you, and each one can only go back to the wallet that gave.',
    tag: 'Refunds',
    stat: 'Automatic after the date',
  },
  {
    dead: 'Trust the annual report',
    why: 'Stock photos and a promise. No way to check a single delivery.',
    alive: 'Filmed, hashed proof',
    how: 'Every delivery is filmed. The proof bundle (text, video, every file hash) is hashed onto Solana, so it can never be swapped later.',
    tag: 'Proof',
    stat: 'Hash checked on every page',
  },
  {
    dead: 'Fees vanish into overhead',
    why: 'Nobody can tell how much of a dollar reached anyone.',
    alive: 'Fees split by code',
    how: 'Gifts go 100% to drops. Every fee, from swaps or the $UMANITY pool, is split 50/50 by the program, and the Money tab traces each dollar.',
    tag: 'Money tab',
    stat: '50/50, on-chain',
  },
  {
    dead: 'Only SOL holders can give',
    why: 'Most crypto sits on other chains, and agents have no way in.',
    alive: 'Any wallet, any agent',
    how: 'Give from other chains through Aurora Intents, or from an AI agent with one x402 request. The agent wallet is the backer, refunds included.',
    tag: 'x402 · Aurora',
    stat: 'No keys, no checkout',
  },
  {
    dead: 'Tokens with no point',
    why: 'Launch, pump, dump. Nothing happens in the real world.',
    alive: 'A token that feeds people',
    how: "$UMANITY trades on Meteora. Its trading fees go to the program, which sends half to drops. No team tokens. Not an investment.",
    tag: '$UMANITY',
    stat: 'Fees claimed by the program',
  },
]

function StatsColumn() {
  const { data: money } = useMoney(60_000)
  if (!money) return <div className="skeleton h-56" />
  const rows: [string, string][] = [
    [usdText(money.totals.cameIn, 0), 'Given'],
    [usdText(money.totals.inPots, 0), 'In pots now'],
    [usdText(money.totals.unlocked, 0), 'Delivered'],
    [usdText(money.fees.toDrops, 2), 'Fees to drops'],
  ]
  return (
    <div className="space-y-5">
      {rows.map(([v, l]) => (
        <div key={l} className="text-center">
          <p className="text-2xl md:text-3xl font-bold counter tracking-tight text-[#1d1d1f]">{v}</p>
          <p className="text-[10px] text-[#86868b] uppercase tracking-[0.12em] font-medium mt-1">{l}</p>
        </div>
      ))}
    </div>
  )
}

/** The live next drop: a stranger sees the product working, not a description of it. */
function HeroDrop() {
  const { data: drops } = useDrops()
  const { openGive } = useUmanity()
  if (!drops) return <div className="skeleton h-[320px] !rounded-[24px]" />
  const drop = pickNextDrop(drops)
  if (!drop) {
    return (
      <div className="card-glass p-6 lg:w-[220px] lg:ml-auto">
        <StatsColumn />
      </div>
    )
  }
  return (
    <div className="card p-6 md:p-7 !rounded-[24px] shadow-elevated">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Filling now · {dayText(drop.deadline)}</p>
        <StatePill drop={drop} />
      </div>
      <Link href={dropHref(drop.id)} className="flex items-start gap-3 mt-3 group">
        <span className="w-11 h-11 rounded-[14px] bg-[#f5f5f7] flex items-center justify-center text-[22px] flex-shrink-0">{drop.emoji}</span>
        <span className="min-w-0">
          <span className="block text-[18px] font-bold tracking-tight leading-snug group-hover:underline [text-wrap:balance]">{drop.title}</span>
          <span className="block text-[12.5px] text-[#86868b] mt-0.5 truncate">{drop.place}</span>
        </span>
      </Link>
      <div className="mt-5">
        <DropMeter drop={drop} size="sm" />
      </div>
      <button onClick={() => openGive({ dropId: drop.id })} className="btn-primary w-full py-3.5 mt-5 !text-[15px]">
        ♡ Give to this drop
      </button>
      <p className="text-[11.5px] text-[#86868b] text-center mt-2.5">
        Pays on filmed proof. Refunded if it misses <span className="whitespace-nowrap">{dayText(drop.deadline)}</span>.
      </p>
    </div>
  )
}

/** Live totals under the hero, once there is something real to count. */
function StatsRow() {
  const { data: money } = useMoney(60_000)
  if (!money || money.totals.cameIn <= 0) return null
  return (
    <div className="flex items-center justify-center gap-10 px-6 py-6 border-y border-black/[0.04] bg-white/80">
      {[
        [usdText(money.totals.cameIn, 0), 'Given'],
        [usdText(money.totals.inPots, 0), 'In pots'],
        [usdText(money.totals.unlocked, 0), 'Delivered'],
      ].map(([v, l]) => (
        <div key={l} className="text-center">
          <p className="text-2xl font-bold counter tracking-tight">{v}</p>
          <p className="text-[10px] text-[#86868b] uppercase tracking-[0.12em] font-medium mt-1">{l}</p>
        </div>
      ))}
    </div>
  )
}

const LOOP = [
  { icon: '⇄', title: 'Trade', body: 'Swaps in the app pay 0.5%. $UMANITY trades pay its pool fee.' },
  { icon: '⚖️', title: 'Split by code', body: 'The program sends half of every fee to the drops fund.' },
  { icon: '🍲', title: 'Fill drops', body: 'The fund and your gifts fill pots for real deliveries.' },
  { icon: '🎥', title: 'On camera', body: 'Every delivery is filmed and posted, here and on X.' },
]

/** Why using Umanity feeds people even when you are not giving. */
function LoopSection() {
  return (
    <section className="py-20 md:py-28 bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-3">The loop</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#1d1d1f] mb-3">Your trades feed people too.</h2>
          <p className="text-[#86868b] text-base max-w-lg mx-auto">Gifts go 100% to drops. Everything else that earns a fee sends half of it there, and the program does the splitting.</p>
        </div>
        <div className="card p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {LOOP.map((s, i) => (
              <div key={s.title} className="flex flex-col gap-3">
                <div className={`h-1.5 rounded-full ${i === 0 ? 'bg-[#1d1d1f]' : 'bg-emerald-500'}`} />
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center">{s.icon}</div>
                <p className="text-[14px] font-bold">{s.title}</p>
                <p className="text-[12px] text-[#86868b] leading-snug">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-black/[0.04]">
            <p className="text-[12px] text-[#86868b]">Every split is a transaction you can open. So is every refund.</p>
            <div className="flex gap-2">
              <Link href="/trade" className="btn-secondary px-5 py-2.5 !text-[13px]">
                Trade
              </Link>
              <Link href="/money" className="btn-primary px-5 py-2.5 !text-[13px]">
                Follow the money →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Real proof only: hidden until a drop has filmed proof with photos. */
function FieldSection() {
  const [proofs, setProofs] = useState<Extract<HomeItem, { type: 'update' }>[] | null>(null)
  useEffect(() => {
    apiGet<{ items?: HomeItem[] }>('/api/feed/drops?limit=60')
      .then((d) => setProofs((d.items ?? []).filter((i): i is Extract<HomeItem, { type: 'update' }> => i.type === 'update' && i.media.some((m) => m.kind === 'photo')).slice(0, 3)))
      .catch(() => setProofs([]))
  }, [])
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 items-center">
          <div>
            <p className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-[0.2em] mb-3">Real world, real hands</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#1d1d1f] mb-4">We deliver it ourselves. On camera.</h2>
            <p className="text-[#86868b] text-base leading-relaxed mb-6">
              The team buys the food, the medicine, the water filters, and hands them over in person. Every delivery is filmed and posted, here and on X, before a single dollar leaves its pot.
            </p>
            <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-semibold text-emerald-600 hover:underline">
              Follow the deliveries on X →
            </a>
          </div>
          <div>
            {proofs && proofs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {proofs.map((u) => {
                  const photo = u.media.find((m) => m.kind === 'photo')!
                  return (
                    <Link key={u.id} href={dropHref(u.drop.id)} className="card-interactive overflow-hidden block">
                      <div className="aspect-[4/5] bg-black/[0.04]">
                        <Img src={photo.url} alt={u.title} />
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] text-[#86868b]">
                          {u.drop.emoji} Drop #{u.drop.id + 1} · {timeAgo(u.at)}
                        </p>
                        <p className="text-[12px] font-semibold leading-snug mt-0.5 line-clamp-2">{u.title}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#1d1d1f] text-white p-8 md:p-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">The proof standard</p>
                <ul className="space-y-4">
                  {[
                    ['🛒', 'What it bought', "The drop's shopping list, hashed on-chain when it opens"],
                    ['🎥', 'Who received it', 'Video and photos of the hand-over itself'],
                    ['🧾', 'What it cost', 'Receipts, each file hashed on upload'],
                    ['⏱️', 'A review window', 'Proof goes on-chain first; the pot unlocks only after the window'],
                  ].map(([i, t, s]) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">{i}</span>
                      <span>
                        <span className="block text-[14px] font-semibold">{t}</span>
                        <span className="block text-[12px] text-white/50">{s}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
