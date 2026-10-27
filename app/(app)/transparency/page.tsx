'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { AccountLink, CopyButton, Icon, Pill, Skeleton, TxLink } from '@/components/shared/ui'
import { fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { useTransparency } from '@/components/transparency/data'
import { explorerAccount } from '@/lib/solana/constants'

export default function TransparencyPage() {
  const { report, error } = useTransparency()
  const { solPrice } = useUmanity()
  const usd = (sol: number) => (solPrice ? fmtUsd(sol * solPrice) : null)
  const r = report

  return (
    <div className="max-w-[1120px] mx-auto">
      <div className="max-w-[680px] animate-fade-up">
        <p className="eyebrow mb-3">Transparency</p>
        <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.02] tracking-[-0.01em]">Every rupee has a receipt.</h1>
        <p className="text-[16px] text-[#6e6e73] mt-4 leading-relaxed">This is the public ledger of Umanity: what came in, what is waiting in each vault, what was released after a proven delivery, and the fees that keep the field team moving. All of it is checkable on Solana.</p>
      </div>

      {/* Headline numbers */}
      <div className="card p-5 sm:p-6 mt-8 grid grid-cols-2 md:grid-cols-5 gap-5">
        {[
          ['Given so far', r ? `${fmtSol(r.totals.raisedSol, 2)} SOL` : null, r ? usd(r.totals.raisedSol) : null],
          ['Held in escrow', r ? `${fmtSol(r.totals.heldSol, 2)} SOL` : null, r ? usd(r.totals.heldSol) : null],
          ['Released after proof', r ? `${fmtSol(r.totals.releasedSol, 2)} SOL` : null, r ? usd(r.totals.releasedSol) : null],
          ['People giving', r ? String(r.totals.donors) : null, r && r.totals.crossChainGifts > 0 ? `${r.totals.crossChainGifts} cross-chain` : 'on-chain, every one'],
          ['Deliveries', r ? String(r.deliveries.length) : null, r && r.deliveries.length === 0 ? 'the first is being funded' : 'photographed and receipted'],
        ].map(([label, value, sub]) => (
          <div key={label as string}>
            <p className="eyebrow">{label}</p>
            {value == null ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="num text-[24px] font-bold mt-1 leading-none">{value}</p>}
            {sub && <p className="text-[11.5px] text-[#6e6e73] mt-1.5">{sub}</p>}
          </div>
        ))}
      </div>
      {error && <p className="text-[12.5px] text-[#c53030] mt-3">{error}</p>}

      {/* Vaults */}
      <section className="mt-12">
        <Header title="The vaults" sub="One program-owned vault per cause. The balance is the money waiting to be released." />
        <div className="card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#aeaeb2] border-b border-black/[0.06]">
            <span>Cause</span>
            <span className="text-right">Held</span>
            <span className="text-right">Raised</span>
            <span className="text-right">Released</span>
            <span className="w-28 text-right">Vault</span>
          </div>
          {!r ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {r.vaults.map((v) => (
                <li key={v.poolId} className="grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-x-4 gap-y-1 px-5 py-3.5 items-center">
                  <Link href={`/causes/${v.poolId}`} className="col-span-2 sm:col-span-1 text-[14px] font-semibold hover:underline truncate">
                    {v.name}
                  </Link>
                  <Cell label="Held" value={`${fmtSol(v.balanceSol, 3)} SOL`} strong />
                  <Cell label="Raised" value={`${fmtSol(v.raisedSol, 3)} SOL`} />
                  <Cell label="Released" value={`${fmtSol(v.releasedSol, 3)} SOL`} />
                  <span className="col-span-2 sm:col-span-1 sm:w-28 sm:text-right text-[12px]">{v.vaultPda ? <AccountLink address={v.vaultPda} /> : <span className="text-[#aeaeb2]">not created</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Releases */}
      <section className="mt-12">
        <Header title="Releases" sub="Each one is a milestone the donors approved after a delivery was proven." />
        {!r ? (
          <Skeleton className="h-24" />
        ) : r.releases.length === 0 ? (
          <EmptyBox icon="unlock" title="No releases yet" sub="Money leaves a vault only after a delivery is proven and the donors approve it. The first one will be listed here with its transaction." />
        ) : (
          <ul className="card divide-y divide-black/[0.06]">
            {r.releases.map((rel, i) => (
              <li key={`${rel.poolId}-${rel.milestoneIndex}-${i}`} className="px-5 py-4 flex items-start gap-4">
                <span className="w-9 h-9 rounded-full bg-[#ecfdf5] text-[#047857] flex items-center justify-center flex-shrink-0">
                  <Icon name="unlock" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug">{rel.description}</p>
                  <p className="text-[12.5px] text-[#6e6e73] mt-0.5">
                    <Link href={`/causes/${rel.poolId}`} className="hover:underline">
                      {rel.poolName}
                    </Link>{' '}
                    · milestone {rel.milestoneIndex + 1}
                    {rel.attestation && (
                      <>
                        {' '}
                        · oracle {rel.attestation.verdict} {rel.attestation.confidence}/100 · <span className="num">{rel.attestation.attestationHash.slice(0, 12)}…</span>
                      </>
                    )}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                    <Pill tone={rel.status === 'released' ? 'green' : 'gray'}>{rel.status}</Pill>
                    {rel.txSignature && <TxLink sig={rel.txSignature} label="Release transaction" />}
                  </div>
                </div>
                <p className="num text-[15px] font-bold flex-shrink-0">{fmtSol(rel.amountSol, 3)} SOL</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Deliveries */}
      <section className="mt-12">
        <Header title="Deliveries" sub="What the field team bought and handed over, with photos and receipts." />
        {!r ? (
          <Skeleton className="h-24" />
        ) : r.deliveries.length === 0 ? (
          <EmptyBox icon="truck" title="The first delivery is being funded" sub="As soon as a vault has enough for a round, the team buys, delivers and posts the proof here." />
        ) : (
          <ul className="card divide-y divide-black/[0.06]">
            {r.deliveries.map((d) => (
              <li key={d.id} className="px-5 py-4 flex items-start gap-4">
                <span className="w-9 h-9 rounded-full bg-black/[0.05] text-[#1d1d1f] flex items-center justify-center flex-shrink-0">
                  <Icon name="truck" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/causes/${d.poolId}`} className="text-[14px] font-semibold leading-snug hover:underline">
                    {d.title}
                  </Link>
                  <p className="text-[12.5px] text-[#6e6e73] mt-0.5">
                    {d.poolName}
                    {d.location ? ` · ${d.location}` : ''} · {new Date(d.deliveredAt ?? d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {d.media.length} {d.media.length === 1 ? 'file' : 'files'}
                    {d.attestation ? ` · oracle ${d.attestation.verdict}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="num text-[15px] font-bold">{fmtSol(d.amountSol, 3)} SOL</p>
                  {d.fiatAmount && <p className="text-[11.5px] text-[#6e6e73] num">{d.fiatAmount}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fees */}
      <section className="mt-12">
        <Header title="Fees that fund the field team" sub="Gifts carry no platform fee. These are the only ways Umanity earns, and they pay for the people who deliver." />
        <div className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            ['Dare settlements', `${((r?.fees.dareFeeBps ?? 150) / 100).toFixed(1)}%`, r ? `${fmtSol(r.fees.dareFeesSol, 3)} SOL collected` : null],
            ['Cross-chain routing', `${((r?.fees.intentsFeeBps ?? 50) / 100).toFixed(1)}%`, r ? `${fmtUsd(r.fees.intentsFeeUsd)} collected` : null],
            ['Oracle audits', '$0.01 each', r ? `${r.fees.x402Calls} audits · ${fmtUsd(r.fees.x402RevenueUsd)}` : null],
            ['Private routing', '0.25% share', r ? `${fmtSol(r.fees.routingFeesSol, 3)} SOL collected` : null],
          ].map(([label, rate, sub]) => (
            <div key={label as string}>
              <p className="eyebrow">{label}</p>
              <p className="num text-[22px] font-bold mt-1 leading-none">{rate}</p>
              {sub ? <p className="text-[11.5px] text-[#6e6e73] mt-1.5 num">{sub}</p> : <Skeleton className="h-4 w-24 mt-1.5" />}
            </div>
          ))}
        </div>
      </section>

      {/* Programs and wallets */}
      <section className="mt-12 grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <Header title="Programs and wallets" sub="Everything the money touches, with its address." compact />
          <ul className="space-y-3 text-[13px]">
            {[
              ['Escrow program', r?.programs.donations],
              ['Tips program', r?.programs.tips],
              ['Treasury (fees)', r?.wallets.treasury],
              ['Field team wallet (receives releases)', r?.wallets.orgWallet],
              ['Cross-chain vault', r?.wallets.crossChainVault],
              ['Authority', r?.wallets.authority],
            ]
              .filter(([, v]) => v)
              .map(([label, addr]) => (
                <li key={label as string} className="flex items-center justify-between gap-3">
                  <span className="text-[#6e6e73]">{label}</span>
                  <span className="flex items-center gap-2">
                    <AccountLink address={addr as string} />
                    <CopyButton text={addr as string} label="" />
                  </span>
                </li>
              ))}
          </ul>
          <p className="text-[11.5px] text-[#aeaeb2] mt-4">{r ? `Network: Solana ${r.network === 'mainnet-beta' ? 'mainnet' : r.network}. Generated ${timeAgo(r.generatedAt)} ago.` : ''}</p>
        </div>

        <div className="card p-5 bg-[#1d1d1f] text-white border-transparent">
          <h3 className="text-[17px] font-bold tracking-[-0.02em]">Verify it yourself</h3>
          <ol className="mt-4 space-y-3 text-[13.5px] text-white/80 leading-relaxed list-decimal pl-5">
            <li>
              Open any vault address above on Solscan. The balance is the money waiting in escrow. Nothing but the escrow program can move it.
            </li>
            <li>
              The program{' '}
              {r?.programs.donations && (
                <a href={explorerAccount(r.programs.donations)} target="_blank" rel="noopener noreferrer" className="num text-white underline underline-offset-2">
                  {r.programs.donations.slice(0, 6)}…{r.programs.donations.slice(-4)}
                </a>
              )}{' '}
              only releases through <span className="num">release_milestone_funds</span>, after <span className="num">approve_milestone</span>, and every release transaction is listed on this page.
            </li>
            <li>Each milestone account carries the oracle's attestation hash. Re-run an audit yourself for one cent in USDC: send an x402 payment to <span className="num">POST /api/x402/verify-milestone</span>.</li>
            <li>
              The code is open:{' '}
              <a href="https://github.com/shariqazeem/umanity" target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-2">
                github.com/shariqazeem/umanity
              </a>
              .
            </li>
          </ol>
        </div>
      </section>
    </div>
  )
}

function Header({ title, sub, compact }: { title: string; sub?: string; compact?: boolean }) {
  return (
    <div className={compact ? 'mb-4' : 'mb-4'}>
      <h2 className={`font-bold tracking-[-0.02em] ${compact ? 'text-[17px]' : 'text-[22px]'}`}>{title}</h2>
      {sub && <p className="text-[13.5px] text-[#6e6e73] mt-0.5">{sub}</p>}
    </div>
  )
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="sm:text-right text-[13px] num">
      <span className="sm:hidden text-[#aeaeb2] text-[11px] mr-1">{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </span>
  )
}

function EmptyBox({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="card px-6 py-8 flex items-start gap-4">
      <span className="w-10 h-10 rounded-full bg-black/[0.04] text-[#aeaeb2] flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[13.5px] text-[#6e6e73] mt-1 leading-relaxed max-w-[560px]">{sub}</p>
      </div>
    </div>
  )
}
