'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Icon, Img, Progress, Pill } from '@/components/shared/ui'
import { CAUSES } from '@/lib/causes'
import { useStats } from '@/lib/client/hooks'
import { apiGet, fmtSol, fmtUsd } from '@/lib/client/api'
import { UMANITY_DONATIONS_PROGRAM_ID, explorerAccount } from '@/lib/solana/constants'
import type { PoolView } from '@/lib/data/donations'
import type { CampaignView } from '@/lib/data/governance'

export default function Landing() {
  const router = useRouter()
  const { openGive, openAuth, signer, solPrice, isMainnet } = useUmanity()
  const stats = useStats(60_000)
  const [pools, setPools] = useState<Record<string, PoolView>>({})
  const [campaigns, setCampaigns] = useState<Record<string, CampaignView>>({})

  // Returning people go straight to the app; ?stay=1 shows this page anyway.
  useEffect(() => {
    try {
      const stay = new URLSearchParams(window.location.search).has('stay')
      if (!stay && localStorage.getItem('umanity.entered') === '1') router.replace('/home')
    } catch {
      /* ignore */
    }
  }, [router])

  useEffect(() => {
    apiGet<{ pools?: PoolView[] }>('/api/pools')
      .then((d) => setPools(Object.fromEntries((d.pools ?? []).map((p) => [p.id, p]))))
      .catch(() => {})
    apiGet<{ campaigns?: CampaignView[] }>('/api/campaigns')
      .then((d) => setCampaigns(Object.fromEntries((d.campaigns ?? []).map((c) => [c.pool_id, c]))))
      .catch(() => {})
  }, [])

  const usd = (sol: number) => (solPrice ? fmtUsd(sol * solPrice) : null)
  const hero = CAUSES[0]
  const second = CAUSES[4]
  const third = CAUSES[1]

  return (
    <div className="min-h-[100dvh] bg-white text-[#1d1d1f]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass hairline-b">
        <div className="container-app h-16 flex items-center gap-6">
          <Link href="/?stay=1" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Umanity" width={34} height={34} className="rounded-full" priority />
            <span className="text-[17px] font-bold tracking-[-0.02em]">Umanity</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {[
              ['/causes', 'Causes'],
              ['/how-it-works', 'How it works'],
              ['/transparency', 'Transparency'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="px-3.5 h-9 inline-flex items-center rounded-full text-[13.5px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signer ? (
              <Link href="/home" className="btn btn-outline h-10 px-4.5 text-[13.5px]">
                Open app
              </Link>
            ) : (
              <Btn tone="ghost" onClick={openAuth} className="hidden sm:inline-flex">
                Sign in
              </Btn>
            )}
            <Btn tone="accent" icon="heart" onClick={() => openGive()}>
              Give
            </Btn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container-app pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <div className="animate-fade-up">
            <p className="eyebrow mb-5">Giving on Solana · Delivered in person in Pakistan</p>
            <h1 className="font-display text-[46px] sm:text-[62px] lg:text-[72px] leading-[0.98] tracking-[-0.02em]">
              Give to real people.
              <br />
              <span className="italic text-[#047857]">Watch it reach them.</span>
            </h1>
            <p className="text-[17px] sm:text-[19px] text-[#6e6e73] leading-[1.55] mt-7 max-w-[520px]">
              Your gift waits in escrow on Solana. The Umanity team buys what is needed, delivers it by hand, and posts the photos and receipts. The money moves only when you and the other donors say so.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Btn tone="accent" size="xl" icon="heart" onClick={() => openGive()}>
                Start giving
              </Btn>
              <Link href="/causes" className="btn btn-secondary h-14 px-7 text-[16px]">
                See the causes <Icon name="arrowRight" size={18} />
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-[13px] text-[#6e6e73]">
              {[
                ['lock', 'Escrowed on Solana'],
                ['shieldCheck', 'Proof before release'],
                ['globe', 'Give from 37 chains'],
              ].map(([icon, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <Icon name={icon} size={15} className="text-[#047857]" /> {label}
                </span>
              ))}
            </div>
          </div>

          {/* Photo collage */}
          <div className="relative h-[420px] sm:h-[520px] animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <div className="absolute left-0 top-0 w-[68%] h-[72%] rounded-[32px] overflow-hidden shadow-[var(--shadow-lg)]">
              <Img src={hero.image} alt={hero.imageAlt} />
            </div>
            <div className="absolute right-0 top-[14%] w-[44%] h-[42%] rounded-[28px] overflow-hidden shadow-[var(--shadow-lg)] border-4 border-white">
              <Img src={second.image} alt={second.imageAlt} />
            </div>
            <div className="absolute right-[8%] bottom-0 w-[48%] h-[40%] rounded-[28px] overflow-hidden shadow-[var(--shadow-lg)] border-4 border-white">
              <Img src={third.image} alt={third.imageAlt} />
            </div>
            <div className="absolute left-[6%] bottom-[6%] card p-4 w-[240px] shadow-[var(--shadow-lg)] float">
              <p className="eyebrow">Held in escrow right now</p>
              <p className="num text-[26px] font-bold mt-1 leading-none">{stats ? `${fmtSol(stats.totalEscrowed, 2)} SOL` : '—'}</p>
              <p className="text-[12px] text-[#6e6e73] mt-1">{stats && usd(stats.totalEscrowed) ? `${usd(stats.totalEscrowed)} · ` : ''}released only after proof</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live numbers */}
      <section className="border-y border-black/[0.06] bg-[#fafafa]">
        <div className="container-app py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            ['Given so far', stats ? `${fmtSol(stats.totalDonations, 2)} SOL` : '—', stats ? usd(stats.totalDonations) : null],
            ['Waiting in escrow', stats ? `${fmtSol(stats.totalEscrowed, 2)} SOL` : '—', 'moves only on approval'],
            ['People giving', stats ? String(stats.totalDonors) : '—', 'on-chain, every one'],
            ['Cross-chain gifts', stats ? String(stats.crossChainCount) : '—', 'via NEAR Intents'],
          ].map(([label, value, sub]) => (
            <div key={label as string}>
              <p className="eyebrow">{label}</p>
              <p className="num text-[28px] font-bold mt-1 leading-none">{value}</p>
              {sub && <p className="text-[12px] text-[#6e6e73] mt-1.5">{sub}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container-app py-20 md:py-28">
        <div className="max-w-[640px]">
          <p className="eyebrow mb-4">How it works</p>
          <h2 className="font-display text-[38px] sm:text-[48px] leading-[1.02]">Three steps. No black hole.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {[
            ['1', 'Choose a cause and give', 'SOL from your wallet, or USDC, ETH, BTC and 200+ assets from 37 chains. One tap, one deposit address, nothing to bridge.', 'heart'],
            ['2', 'It waits in escrow', 'A Solana program holds the gift in a vault that nobody can empty alone. You can watch the balance on-chain the whole time.', 'lock'],
            ['3', 'We deliver and prove it, you release it', 'The team buys and hands over the goods, posts photos and receipts, an AI oracle audits them, and the donors vote the money out.', 'shieldCheck'],
          ].map(([n, title, body, icon]) => (
            <div key={n} className="card p-7">
              <div className="flex items-center justify-between">
                <span className="font-display text-[40px] leading-none text-[#aeaeb2]">{n}</span>
                <span className="w-10 h-10 rounded-full bg-[#ecfdf5] text-[#047857] flex items-center justify-center">
                  <Icon name={icon} size={18} />
                </span>
              </div>
              <h3 className="text-[19px] font-bold tracking-[-0.02em] mt-6">{title}</h3>
              <p className="text-[14.5px] text-[#6e6e73] leading-relaxed mt-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Causes */}
      <section className="bg-[#f5f5f7] py-20 md:py-28">
        <div className="container-app">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="max-w-[640px]">
              <p className="eyebrow mb-4">The causes</p>
              <h2 className="font-display text-[38px] sm:text-[48px] leading-[1.02]">Six things we deliver by hand.</h2>
              <p className="text-[16px] text-[#6e6e73] mt-4 leading-relaxed">Each one has its own vault, its own delivery log and its own receipts. Pick the one that moves you.</p>
            </div>
            <Link href="/causes" className="btn btn-outline h-11 px-5 text-[14px]">
              All causes <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {CAUSES.map((c) => {
              const p = pools[c.id]
              const camp = campaigns[c.id]
              const raised = p?.totalDonated ?? 0
              const target = camp?.target_amount ?? 0
              return (
                <Link key={c.id} href={`/causes/${c.id}`} className="card card-hover overflow-hidden group block">
                  <div className="relative h-[200px] overflow-hidden">
                    <Img src={c.image} alt={c.imageAlt} className="group-hover:scale-[1.03] transition-transform duration-700" />
                    <span className="absolute top-3 left-3">
                      <Pill tone="white">{c.category}</Pill>
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-[18px] font-bold tracking-[-0.02em]">{c.name}</h3>
                    <p className="text-[13.5px] text-[#6e6e73] mt-1 leading-relaxed">{c.tagline}</p>
                    <p className="text-[13px] text-[#047857] font-semibold mt-3">{c.impact}</p>
                    {target > 0 && (
                      <div className="mt-4">
                        <Progress value={raised} max={target} />
                        <p className="text-[12px] text-[#6e6e73] mt-1.5 num">
                          {fmtSol(raised, 2)} of {fmtSol(target, 0)} SOL toward the next delivery
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Why people stay */}
      <section className="container-app py-20 md:py-28">
        <div className="max-w-[640px]">
          <p className="eyebrow mb-4">Why people come back</p>
          <h2 className="font-display text-[38px] sm:text-[48px] leading-[1.02]">Giving that gives something back.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          {[
            ['camera', 'See your gift arrive', 'When a delivery you funded happens, you get the photos, the receipts and a note that says: you helped fund this. Not a thank-you email. The actual thing.'],
            ['vote', 'You hold the keys', 'Every donor of a cause votes on whether the proof is good enough before a single lamport leaves the vault. Umanity cannot pay itself.'],
            ['spark', 'A pass that grows with you', 'Your Living Guardian pass evolves with your giving, your streak and your votes. Tiers unlock perks and a seat at the table for how the Field Fund is spent.'],
            ['bolt', 'Give together', 'Dare a friend to match you. Stake SOL on it. Whether they deliver or not, the cause wins and the feed sees it.'],
          ].map(([icon, title, body]) => (
            <div key={title} className="card p-7 flex gap-5">
              <span className="w-11 h-11 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center flex-shrink-0">
                <Icon name={icon} size={19} />
              </span>
              <div>
                <h3 className="text-[18px] font-bold tracking-[-0.02em]">{title}</h3>
                <p className="text-[14.5px] text-[#6e6e73] leading-relaxed mt-1.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof */}
      <section className="bg-[#1d1d1f] text-white py-20 md:py-28">
        <div className="container-app grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <p className="eyebrow !text-white/50 mb-4">Built to be checked</p>
            <h2 className="font-display text-[38px] sm:text-[48px] leading-[1.02]">Every rupee has a receipt. Every receipt has a hash.</h2>
            <p className="text-[16px] text-white/70 leading-relaxed mt-5 max-w-[520px]">Umanity is open source and verifiable end to end. The escrow program, the oracle attestations and every release live on Solana where anyone, including you, can audit them.</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/transparency" className="btn btn-white h-11 px-5 text-[14px]">
                Open the ledger
              </Link>
              <a href="https://github.com/shariqazeem/umanity" target="_blank" rel="noopener noreferrer" className="btn h-11 px-5 text-[14px] bg-white/10 text-white hover:bg-white/15">
                Source on GitHub <Icon name="arrowUpRight" size={15} />
              </a>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              ['Escrow program', 'Anchor program with 14 instructions: pool vaults, donation records, campaigns, milestones and staked dares.', 'lock'],
              ['Impact Oracle', 'Delivery evidence is audited by an AI oracle; the attestation hash is written into the milestone account on-chain.', 'shieldCheck'],
              ['Paid per audit, x402', 'Any person or agent can pay one cent in USDC over HTTP to re-run an audit. Revenue, not a grant.', 'bolt'],
              ['Any chain in', 'NEAR Intents and Aurora turn USDC on Base, ETH, BTC or TON into SOL in a cause vault with one deposit.', 'globe'],
            ].map(([title, body, icon]) => (
              <div key={title} className="rounded-[20px] bg-white/[0.06] border border-white/[0.08] p-5">
                <Icon name={icon} size={18} className="text-[#34d399]" />
                <h3 className="text-[15px] font-bold mt-4">{title}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-1.5">{body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="container-app mt-12 pt-8 border-t border-white/10 text-[12px] text-white/40 flex flex-wrap gap-x-6 gap-y-2">
          <span>
            Program{' '}
            <a href={explorerAccount(UMANITY_DONATIONS_PROGRAM_ID)} target="_blank" rel="noopener noreferrer" className="num text-white/60 hover:text-white underline underline-offset-2">
              {UMANITY_DONATIONS_PROGRAM_ID.slice(0, 8)}…{UMANITY_DONATIONS_PROGRAM_ID.slice(-6)}
            </a>
          </span>
          <span>{isMainnet ? 'Solana mainnet' : 'Solana devnet (mainnet launch in progress)'}</span>
          <span>x402 endpoint: POST /api/x402/verify-milestone</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-app py-24 md:py-32 text-center">
        <h2 className="font-display text-[44px] sm:text-[60px] leading-[1]">Start with five dollars.</h2>
        <p className="text-[17px] text-[#6e6e73] mt-5 max-w-[460px] mx-auto leading-relaxed">That is three hot meals, or a rabies shot for a street dog, or a blanket before the cold. You will see where it went.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-9">
          <Btn tone="accent" size="xl" icon="heart" onClick={() => openGive({ amountUsd: 5 })}>
            Give $5
          </Btn>
          <Btn tone="secondary" size="xl" onClick={openAuth}>
            Create your wallet
          </Btn>
        </div>
      </section>

      <footer className="border-t border-black/[0.06] py-10">
        <div className="container-app flex flex-col sm:flex-row items-center justify-between gap-4 text-[12.5px] text-[#aeaeb2]">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Umanity" width={26} height={26} className="rounded-full" />
            <span>Umanity · give to real people</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/how-it-works" className="hover:text-[#1d1d1f]">
              How it works
            </Link>
            <Link href="/transparency" className="hover:text-[#1d1d1f]">
              Transparency
            </Link>
            <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f]">
              @umanity_xyz
            </a>
            <a href="https://github.com/shariqazeem/umanity" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f]">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
