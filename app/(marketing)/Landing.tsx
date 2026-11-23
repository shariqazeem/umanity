'use client'

import { useEffect, useState } from 'react'
import { DropMark } from '@/components/drops/DropMark'
import Link from 'next/link'
import { Lockup, Mark } from '@/components/brand/Logo'
import { circleSvg, type TallyState } from '@/lib/umanity/tally'
import { useRouter } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, timeAgo } from '@/lib/client/api'
import { Img } from '@/components/shared/ui'
import { pickNextDrop, useDrops, useMoney } from '@/components/drops/hooks'
import { DropMeter, StatePill, dayText, dropHref } from '@/components/drops/DropParts'
import { usdText } from '@/lib/umanity/drops'
import { UMANITY_MINT } from '@/lib/umanity/tokens'
import { FUND_GOAL, FUND_GOAL_DATE, goalDateText } from '@/lib/umanity/goal'
import type { HomeItem } from '@/lib/umanity/feed'

const GITHUB = 'https://github.com/shariqazeem/umanity'
/** Drop #1's refunds, sent by the keeper two minutes after its date passed (mainnet, 20 Nov 2026). */
const REFUND_TX = 'https://solscan.io/tx/56MrmTmFf9Dg94LL8kH2hFdneoYGgHbk6Z7BUYwKoDgVfRHhojPWn8k9NUU27oYvZ9EznkDrZGtTKKLEE9Y2UPbD'

export function Landing() {
  const router = useRouter()
  const { openAuth, openGive, signer, isMainnet } = useUmanity()
  const { data: drops } = useDrops()
  const next = pickNextDrop(drops)

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
            <Lockup size={26} />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/home" className="hidden sm:block text-[13px] text-[#4F5B5E] hover:text-[#111111] font-medium transition-colors">
              Explore App
            </Link>
            <Link href="/agents" className="hidden sm:block text-[13px] text-[#4F5B5E] hover:text-[#111111] font-medium transition-colors">
              Agents
            </Link>
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hidden sm:block text-[13px] text-[#4F5B5E] hover:text-[#111111] font-medium transition-colors">
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
        <section className="relative bg-[#D9E1E2] overflow-hidden">
          <div className="relative max-w-6xl mx-auto px-6 pt-24 sm:pt-28 pb-10 w-full lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-10 lg:items-center">
            <div className="max-w-3xl animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 border border-black/[0.06] font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#111111] mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#111111]" />
                Live on Solana · filmed or refunded
              </div>

              <h1 className="text-[clamp(3rem,9vw,6.4rem)] font-extrabold tracking-[-0.035em] leading-[0.9] mb-6 sm:mb-8 text-[#111111] [text-wrap:balance]">
                Nothing given
                <br />
                in the dark.
              </h1>

              <p className="text-lg md:text-[22px] text-[#3A4548] max-w-xl leading-[1.4] mb-7 sm:mb-10 [text-wrap:pretty]">
                Every gift waits in the open, in a pot on Solana, until the delivery is filmed. If it isn&apos;t, the code sends every dollar home.
              </p>

              <div className="flex flex-row items-start gap-3 mb-2">
                <Link href="/home" className="btn-primary px-5 sm:px-7 py-3.5 text-[15px]">
                  Open the app
                </Link>
                {next || !drops ? (
                  <Link href="/give" className="btn-secondary px-5 sm:px-7 py-3.5 text-[15px] font-medium">
                    Fill the next drop
                  </Link>
                ) : (
                  <button onClick={() => openGive({ fund: true })} className="btn-secondary px-5 sm:px-7 py-3.5 text-[15px] font-medium">
                    Give to the fund
                  </button>
                )}
              </div>
            </div>

            {/* Wit keeps watch on top of the open circle: a gift, waiting for its film. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/watch.svg" alt="A small chick stands on top of a black-and-white circle cut in two, watching the gap" width={900} height={720} className="w-full max-w-[420px] lg:max-w-none mx-auto mt-6 lg:mt-0 h-auto" />
          </div>
          <div className="relative max-w-6xl mx-auto px-6 pb-16">
            <div className="max-w-md">
              <HeroDrop />
            </div>
          </div>
        </section>

        <StatsRow />

        {/* ===== HOW A DROP WORKS ===== */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-[10px] font-bold text-[#7D898C] uppercase tracking-[0.2em] mb-3">How a drop works</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#111111] mb-3">One delivery. One pot. Rules in code.</h2>
              <p className="text-[#4F5B5E] text-base max-w-lg mx-auto">A drop is one real delivery with a shopping list, a place and a date. Every step leaves a record you can open.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { n: '01', icon: 'give', title: 'Fill', body: 'Give USDC in one tap, from any chain, or from an AI agent over x402. Umanity pays the network fee.' },
                { n: '02', icon: 'open', title: 'Pot', body: "The money sits in the drop's own USDC pot, owned by the program. It can pay the drop's supplier or its backers, nobody else." },
                { n: '03', icon: 'closed', title: 'Deliver and film', body: 'The team buys the goods, hands them over and films it. The proof is hashed onto Solana, then a review window runs.' },
                { n: '04', icon: 'home', title: 'Unlock or refund', body: 'After review the pot pays the supplier. If the drop misses its date, every backer gets their money back.' },
              ].map((s) => (
                <div key={s.n} className="relative bg-white rounded-2xl p-6 border border-black/[0.05] hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-5">
                    <StepMark state={s.icon} />
                    <span className="text-[11px] font-bold text-[#B9C4C6] counter">{s.n}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-[#111111] mb-1.5">{s.title}</h3>
                  <p className="text-[13px] text-[#4F5B5E] leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== THE LOOP ===== */}
        <LoopSection />

        {/* ===== WHAT CRYPTO GIVING GOT WRONG ===== */}
        <section className="py-20 md:py-28 bg-[#F2F5F5]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-[10px] font-bold text-[#7D898C] uppercase tracking-[0.2em] mb-3">What crypto giving got wrong &rarr; What Umanity does</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#111111] mb-3">Six fixes. One app.</h2>
              <p className="text-[#4F5B5E] text-base max-w-lg mx-auto">Built on the version that placed 3rd in a Superteam bounty and 3rd of 74 at the Solana Graveyard Hackathon, rebuilt around real deliveries and real money flows.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIXES.map((r) => (
                <div key={r.dead} className="group bg-white rounded-2xl p-6 border border-black/[0.05] hover:border-emerald-200/60 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px] font-bold text-[#7D898C] line-through">{r.dead}</span>
                  </div>
                  <p className="text-[11px] text-[#7D898C] leading-relaxed mb-4">{r.why}</p>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-px bg-black/[0.06]" />
                    <span className="text-[10px] font-bold text-emerald-600">FIXED</span>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-[15px] font-bold text-[#111111]">{r.alive}</h3>
                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">{r.tag}</span>
                  </div>
                  <p className="text-[12px] text-[#4F5B5E] leading-relaxed mb-3">{r.how}</p>
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
        <section className="py-16 md:py-20 bg-[#111111] text-white">
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
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#111111] mb-4">Back the first filmed drop.</h2>
            <p className="text-[#4F5B5E] text-base mb-8 max-w-md mx-auto [text-wrap:balance]">Browse without a wallet. Give $1 in one tap. Every dollar stays on-chain until a delivery is filmed.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/home" className="btn-primary px-7 py-3.5 text-[14px]">
                Open the app
              </Link>
              <Link href="/money" className="btn-secondary px-7 py-3.5 text-[14px] font-medium">
                Follow every dollar →
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-black/[0.04] py-8 px-6 bg-[#F2F5F5]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Mark size={26} />
              <span className="text-[11px] text-[#7D898C]">Nothing given in the dark.</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-[#7D898C]">
              <Link href="/money" className="hover:text-[#4F5B5E]">
                Money
              </Link>
              <Link href="/agents" className="hover:text-[#4F5B5E]">
                Agents API
              </Link>
              <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#4F5B5E]">
                @umanity_xyz
              </a>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-[#4F5B5E]">
                GitHub
              </a>
              <span>&copy; 2026</span>
            </div>
          </div>
          <p className="max-w-5xl mx-auto text-[10.5px] text-[#9AA6A9] mt-4 text-center sm:text-left">
            Umanity is a crypto app, not a registered charity, and gifts are not tax-deductible.
            {UMANITY_MINT && ' $UMANITY is not an investment and comes with no promise of returns.'}
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
    how: UMANITY_MINT
      ? 'Gifts go 100% to drops. Every fee, from swaps or the $UMANITY pool, is split 50/50 by the program, and the Money tab traces each dollar.'
      : 'Gifts go 100% to drops. Every swap fee is split 50/50 by the program, and the Money tab traces each dollar.',
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
  // The token's fix shows once $UMANITY exists; until then the sixth fix is the wallet.
  UMANITY_MINT
    ? {
        dead: 'Tokens with no point',
        why: 'Launch, pump, dump. Nothing happens in the real world.',
        alive: 'A token that feeds people',
        how: '$UMANITY trades on Meteora. Its trading fees go to the program, which sends half to drops. No team tokens. Not an investment.',
        tag: '$UMANITY',
        stat: 'Fees claimed by the program',
      }
    : {
        dead: 'Wallets scare people off',
        why: 'A seed phrase, gas and a coin to buy before the first gift.',
        alive: 'A wallet in one tap',
        how: 'Create a Umanity wallet with Face ID or a passcode. It stays sealed on your device, and Umanity pays the network fee, so you never need SOL.',
        tag: 'Wallet',
        stat: 'No seed phrase, no gas',
      },
]

/** While no drop is open, the hero shows the fund that backs the next ones. */
function HeroFund() {
  const { data: money } = useMoney(60_000)
  const { openGive } = useUmanity()
  return (
    <div className="card p-6 md:p-7 !rounded-[24px] shadow-elevated">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">{FUND_GOAL ? 'The first filmed drop' : 'The Umanity fund'} · on Solana</p>
      <p className="text-[18px] font-bold tracking-tight leading-snug mt-3 [text-wrap:balance]">
        {FUND_GOAL ? `${FUND_GOAL} givers open the first filmed drop.${FUND_GOAL_DATE ? ` Or ${goalDateText(FUND_GOAL_DATE)}, whichever comes first.` : ''}` : 'No drop is open right now. The fund backs the next ones.'}
      </p>
      <div className="mt-5">
        {!money ? (
          <div className="skeleton h-[34px] w-28" />
        ) : FUND_GOAL ? (
          <p className="text-[34px] font-black tracking-[-0.03em] counter leading-none">
            {money.outside.fundGivers.toLocaleString('en-US')} <span className="text-[#9AA6A9]">of {FUND_GOAL}</span>
          </p>
        ) : (
          <p className="text-[34px] font-black tracking-[-0.03em] counter leading-none">{usdText(money.fund.balance, 2)}</p>
        )}
        <p className="text-[10.5px] text-[#4F5B5E] uppercase tracking-[0.12em] font-medium mt-1.5">{FUND_GOAL ? 'Givers so far, team not counted' : 'In the fund now'}</p>
        {process.env.NEXT_PUBLIC_CIRCLES_COLLECTION && (
          <Link href="/circles" className="inline-block text-[12.5px] font-semibold text-[#111111] hover:underline mt-3">
            The first hundred each hold a Circle →
          </Link>
        )}
      </div>
      <button onClick={() => openGive({ fund: true })} className="btn-primary w-full py-3.5 mt-5 !text-[15px]">
        Give to the fund
      </button>
      <p className="text-[11.5px] text-[#4F5B5E] text-center mt-2.5 [text-wrap:balance]">
        {FUND_GOAL ? 'From $1, with no refunds: the fund only pays into drops, and drops pay out on filmed proof.' : 'It only pays into drop pots, and drops pay out on filmed proof.'}
      </p>
    </div>
  )
}

/** The live next drop: a stranger sees the product working, not a description of it. */
function HeroDrop() {
  const { data: drops } = useDrops()
  const { openGive } = useUmanity()
  if (!drops) return <div className="skeleton h-[320px] !rounded-[24px]" />
  const drop = pickNextDrop(drops)
  if (!drop) return <HeroFund />
  return (
    <div className="card p-6 md:p-7 !rounded-[24px] shadow-elevated">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Filling now · {dayText(drop.deadline)}</p>
        <StatePill drop={drop} />
      </div>
      <Link href={dropHref(drop.id)} className="flex items-start gap-3 mt-3 group">
        <span className="w-11 h-11 rounded-[14px] bg-[#E8EDEE] flex items-center justify-center flex-shrink-0"><DropMark drop={drop} size={30} /></span>
        <span className="min-w-0">
          <span className="block text-[18px] font-bold tracking-tight leading-snug group-hover:underline [text-wrap:balance]">{drop.title}</span>
          <span className="block text-[12.5px] text-[#4F5B5E] mt-0.5 truncate">{drop.place}</span>
        </span>
      </Link>
      <div className="mt-5">
        <DropMeter drop={drop} size="sm" />
      </div>
      <button onClick={() => openGive({ dropId: drop.id })} className="btn-primary w-full py-3.5 mt-5 !text-[15px]">
        Give to this drop
      </button>
      <p className="text-[11.5px] text-[#4F5B5E] text-center mt-2.5">
        Pays on filmed proof. Refunded if it misses <span className="whitespace-nowrap">{dayText(drop.deadline)}</span>.
      </p>
    </div>
  )
}

/** Live totals under the hero, once there is something real to count. */
function StatsRow() {
  const { data: money } = useMoney(60_000)
  // Until a delivery has been paid for, the fund card above carries the live number.
  if (!money || money.totals.unlocked <= 0) return null
  return (
    <div className="flex items-center justify-center gap-10 px-6 py-6 border-y border-black/[0.04] bg-white/80">
      {[
        [usdText(money.totals.cameIn, 0), 'Given'],
        [usdText(money.totals.inPots, 0), 'In pots'],
        [usdText(money.totals.unlocked, 0), 'Delivered'],
      ].map(([v, l]) => (
        <div key={l} className="text-center">
          <p className="text-2xl font-bold counter tracking-tight">{v}</p>
          <p className="text-[10px] text-[#4F5B5E] uppercase tracking-[0.12em] font-medium mt-1">{l}</p>
        </div>
      ))}
    </div>
  )
}

const LOOP = [
  { title: 'Trade', body: UMANITY_MINT ? 'Swaps in the app pay 0.5%. $UMANITY trades pay its pool fee.' : 'Swaps in the app pay 0.5% when USDC is one side.' },
  { title: 'Split by code', body: 'The program sends half of every fee to the drops fund.' },
  { title: 'Fill drops', body: 'The fund and your gifts fill pots for real deliveries.' },
  { title: 'On camera', body: 'Every delivery is filmed and posted, here and on X.' },
]

/** A drop's four steps drawn as the Tally's states: the whole circle (give), open (it waits), closed (filmed), home (refunded). */
function StepMark({ state }: { state: string }) {
  const svg = state === 'give' ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-112 -112 224 224" width="44" height="44"><circle r="80" fill="#111111"/></svg>' : circleSvg({ n: 0, gifts: 0 }, { state: state as TallyState, turn: -30, held: 'plain', gap: 16, slide: 10, rim: 9 }, 44, 112)
  return <span className="w-11 h-11 block" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** Why using Umanity feeds people even when you are not giving. */
function LoopSection() {
  return (
    <section className="py-20 md:py-28 bg-[#E8EDEE]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] mb-3">The loop</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#111111] mb-3">Your trades feed people too.</h2>
          <p className="text-[#4F5B5E] text-base max-w-lg mx-auto">Gifts go 100% to drops. Everything else that earns a fee sends half of it there, and the program does the splitting.</p>
        </div>
        <div className="card p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {LOOP.map((s, i) => (
              <div key={s.title} className="flex flex-col gap-3">
                <div className={`h-1.5 rounded-full ${i === 0 ? 'bg-[#111111]' : 'bg-emerald-500'}`} />
                <span className="font-mono text-[11px] tracking-[0.06em]">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-[14px] font-bold">{s.title}</p>
                <p className="text-[12px] text-[#4F5B5E] leading-snug">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-black/[0.04]">
            <p className="text-[12px] text-[#4F5B5E]">Every split is a transaction you can open. So is every refund.</p>
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
            {proofs && proofs.length > 0 ? (
              <>
                <p className="text-[10px] font-bold text-[#7D898C] uppercase tracking-[0.2em] mb-3">Real world, real hands</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#111111] mb-4">Real deliveries. On camera.</h2>
                <p className="text-[#4F5B5E] text-base leading-relaxed mb-6">Every delivery is filmed and posted, here and on X, before a single dollar leaves its pot.</p>
                <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-semibold text-emerald-600 hover:underline">
                  Follow the deliveries on X →
                </a>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold text-[#7D898C] uppercase tracking-[0.2em] mb-3">The rule, already tested</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#111111] mb-4">Filmed or refunded.</h2>
                <p className="text-[#4F5B5E] text-base leading-relaxed mb-6">
                  Our first drop missed its date on 20 November. Nobody pressed a button: the code sent back the $6 our own team gave, and the fee money goes back to the fund. From the next drop on, every delivery is filmed before a dollar leaves its pot.
                </p>
                <a href={REFUND_TX} target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-semibold text-emerald-600 hover:underline">
                  See the refund on Solana ↗
                </a>
              </>
            )}
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
                        <p className="text-[10px] text-[#4F5B5E]">
                          Drop #{u.drop.id + 1} · {timeAgo(u.at)}
                        </p>
                        <p className="text-[12px] font-semibold leading-snug mt-0.5 line-clamp-2">{u.title}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#111111] text-white p-8 md:p-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/60 mb-4">The proof standard</p>
                <ul className="space-y-4">
                  {[
                    ['01', 'What it bought', "The drop's shopping list, hashed on-chain when it opens"],
                    ['02', 'Who received it', 'Video and photos of the hand-over itself'],
                    ['03', 'What it cost', 'Receipts, each file hashed on upload'],
                    ['04', 'A review window', 'Proof goes on-chain first; the pot unlocks only after the window'],
                  ].map(([i, t, s]) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-full border border-white/25 flex items-center justify-center flex-shrink-0 font-mono text-[11px]">{i}</span>
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
