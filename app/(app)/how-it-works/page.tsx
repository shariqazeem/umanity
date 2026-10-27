'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Icon } from '@/components/shared/ui'
import { TIERS } from '@/lib/guardian'
import { CAUSES } from '@/lib/causes'
import { UMANITY_DONATIONS_PROGRAM_ID, UMANITY_TIPS_PROGRAM_ID, UMANITY_TREASURY, UMANITY_ORG_WALLET, IS_MAINNET, explorerAccount } from '@/lib/solana/constants'

const GITHUB = 'https://github.com/shariqazeem/umanity'

export default function HowItWorksPage() {
  const { openGive } = useUmanity()
  return (
    <article className="max-w-[720px] mx-auto">
      <header className="pt-2 pb-10">
        <p className="eyebrow mb-4">How Umanity works</p>
        <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.02]">Your gift waits until it has been delivered and proven.</h1>
        <p className="text-[17px] text-[#6e6e73] leading-[1.6] mt-6">
          Umanity is a giving app on Solana for people who want to see where the money went. A gift goes into a vault that no one can empty alone. The Umanity team buys what the cause needs, delivers it in person in Pakistan, and posts the photos and receipts. An oracle audits the proof, the donors of that cause vote, and only then does the vault release the money. Every step leaves a record on-chain that anyone can check.
        </p>
      </header>

      <Section eyebrow="The three steps" title="Give, wait, release.">
        <ol className="space-y-5">
          {[
            ['Choose a cause and give', 'You pick one of six causes and give in SOL from any Solana wallet, or in USDC, ETH, BTC, TON and 200+ other assets from 37 chains through a single deposit address. The gift lands in that cause’s vault.', 'A DonationRecord account is created with your address, the amount and the time. The vault balance rises by exactly that amount; the server reads the balance change from the chain before it credits you anything.'],
            ['The gift waits in escrow', 'The vault is a program-derived account. It has no private key. The only instructions that move money out are the milestone release, which needs a milestone marked approved, and refunds. The team cannot pay itself from it.', 'Pool, vault, campaign and milestone accounts live under the Umanity program. The campaign holds the target and the recipient; each milestone holds its share, its status and the oracle’s attestation hash.'],
            ['We deliver, prove it, you release it', 'The field team buys the goods, hands them over and posts photos, receipts and the location. The Impact Oracle audits the evidence. Every donor of that cause gets 72 hours to approve or reject. If the vote passes, the milestone is approved and the release instruction sends that share of the vault to the recipient wallet.', 'The attestation hash and confidence are written into the milestone account. The approval and the release are two separate instructions, both signed by the authority and both visible on the explorer.'],
          ].map(([title, body, chain], i) => (
            <li key={title} className="card p-6">
              <div className="flex items-start gap-4">
                <span className="font-display text-[34px] leading-none text-[#aeaeb2] w-8 flex-shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-[18px] font-bold tracking-[-0.02em]">{title}</h3>
                  <p className="text-[15px] text-[#1d1d1f] leading-[1.6] mt-2">{body}</p>
                  <p className="text-[13px] text-[#6e6e73] leading-relaxed mt-3 pl-3 border-l-2 border-[#10b981]/40">
                    <span className="font-semibold text-[#047857]">On-chain: </span>
                    {chain}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Custody" title="What the money can and cannot do.">
        <Prose>
          <p>There are three parties around every gift, and each can do exactly one thing.</p>
        </Prose>
        <dl className="mt-5 grid sm:grid-cols-3 gap-3">
          {[
            ['The vault', 'Holds the gift. Pays out only through the release instruction, and only to the recipient the campaign was created with.', 'lock'],
            ['The authority', 'The Umanity server key that creates campaigns, writes attestations, approves a milestone after a passed vote and sends the release. It cannot release a milestone that was not approved and cannot change the recipient.', 'key'],
            ['The donors', 'Everyone who gave to a cause votes on each of its milestones. Voting power is one point per thousandth of a SOL given. A rejected vote keeps the money in the vault.', 'vote'],
          ].map(([t, d, icon]) => (
            <div key={t} className="card p-5">
              <Icon name={icon} size={18} className="text-[#047857]" />
              <dt className="text-[15px] font-bold mt-3">{t}</dt>
              <dd className="text-[13.5px] text-[#6e6e73] leading-relaxed mt-1.5">{d}</dd>
            </div>
          ))}
        </dl>
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[#aeaeb2]">
                <th className="px-5 py-3 font-semibold">Money flow</th>
                <th className="px-5 py-3 font-semibold">Rate</th>
                <th className="px-5 py-3 font-semibold hidden sm:table-cell">Where it goes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {[
                ['Gifts to a cause', '0%', 'All of it into the cause vault. Umanity takes no platform fee on gifts.'],
                ['Dare settlement', '1.5%', 'Taken from the pot when a dare settles, enforced by the program, paid to the treasury.'],
                ['Cross-chain routing', '0.5%', 'The integrator share of the NEAR Intents or Aurora quote, paid to the treasury.'],
                ['Oracle audits', '$0.01 per call', 'USDC over x402, paid to the treasury by whoever requests the audit.'],
                ['Private route', '0.5% + 0.25%', 'MultiHopper’s routing fee and Umanity’s integrator share, when the private route is used.'],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td className="px-5 py-3 font-medium">{a}</td>
                  <td className="px-5 py-3 num">{b}</td>
                  <td className="px-5 py-3 text-[#6e6e73] hidden sm:table-cell">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose className="mt-4">
          <p>Fees and the treasury’s own giving fund the Field Fund: the money the team spends on the ground before a milestone is released, and the costs of getting there. The Field Fund is published on the transparency page.</p>
        </Prose>
      </Section>

      <Section eyebrow="Any chain in" title="You do not need SOL to give.">
        <Prose>
          <p>Pick a cause, choose the chain and asset you hold, and Umanity asks the NEAR Intents solver network for a live quote. You get one deposit address. Send the exact amount and the solvers settle it as SOL into the cause vault on Solana. There is nothing to bridge, no wrapped token, and no second transaction on your side.</p>
          <p>Umanity integrates both NEAR Intents and Aurora Intents, covering 37 chains and more than 200 assets at the time of writing, including USDC on Base and Ethereum, native BTC, TON and NEAR. If a deposit cannot be filled, the funds return to the refund address you entered.</p>
        </Prose>
      </Section>

      <Section eyebrow="Proof" title="The Impact Oracle and x402.">
        <Prose>
          <p>When the team posts a delivery, the evidence is attached to a milestone: a written account, photos, receipts, a location and a hash of every file. The Impact Oracle reads it and returns a verdict, a confidence score and a note per check. The attestation hash and the confidence are written into the milestone account on Solana, so the audit that preceded a release can always be found again.</p>
          <p>Anyone can request an audit, including a program. The endpoint is a paid HTTP route using the x402 protocol: a request without payment gets a 402 response describing the price, the client pays one cent in USDC on Solana, retries, and receives the verdict. That makes verification a service with a price rather than a favour.</p>
        </Prose>
        <pre className="mt-4 card p-4 text-[12.5px] overflow-x-auto num text-[#1d1d1f]">
          {`POST /api/x402/verify-milestone\n{ "milestoneId": "…" }\n→ 402 Payment Required  (0.01 USDC, Solana)\n→ 200 { verdict, confidence, checks[], attestationHash, onChainSignature }`}
        </pre>
      </Section>

      <Section eyebrow="Together" title="Dares.">
        <Prose>
          <p>A dare is a bet on a friend’s generosity. You stake SOL in a dare vault, name the person and the cause, and set a timer between ten minutes and thirty days. Friends can add to the pot from the app or from a Blink on X. If the person gives to that cause before the timer runs out, the pot goes to the cause and the dare is marked complete. If they do not, the pot goes to the cause anyway. The only thing a dare can lose is the challenge; the cause never does.</p>
        </Prose>
      </Section>

      <Section eyebrow="Identity" title="Your pass.">
        <Prose>
          <p>Every account carries a Living Guardian pass. Its score is your points plus small bonuses for streaks, consistency and votes, and the tier it unlocks changes what you can do.</p>
        </Prose>
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[#aeaeb2]">
                <th className="px-5 py-3 font-semibold">Tier</th>
                <th className="px-5 py-3 font-semibold">From</th>
                <th className="px-5 py-3 font-semibold">Perks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {TIERS.map((t) => (
                <tr key={t.tier}>
                  <td className="px-5 py-3 font-semibold">{t.tier}</td>
                  <td className="px-5 py-3 num text-[#6e6e73]">{t.min.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[#6e6e73]">{t.perks.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose className="mt-4">
          <p>Points come from giving: one SOL is a thousand points. Claiming a name, voting and completing dares add a little more. Each gift also mints an impact certificate, from bronze up to diamond for a full SOL, tied to the transaction that paid for it.</p>
        </Prose>
      </Section>

      <Section eyebrow="Open and verifiable" title="Check it yourself.">
        <Prose>
          <p>The code is public and every account on this page links to the live explorer. {IS_MAINNET ? 'The program runs on Solana mainnet.' : 'The program runs on Solana devnet today while the mainnet deployment is being prepared; the addresses below point at the current network.'}</p>
        </Prose>
        <dl className="mt-4 card divide-y divide-black/[0.06]">
          {[
            ['Escrow program', UMANITY_DONATIONS_PROGRAM_ID],
            ['Tips program', UMANITY_TIPS_PROGRAM_ID],
            ['Treasury', UMANITY_TREASURY],
            ['Recipient wallet (field deliveries)', UMANITY_ORG_WALLET],
          ].map(([label, addr]) => (
            <div key={label} className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
              <dt className="text-[13.5px] font-medium">{label}</dt>
              <dd>
                <a href={explorerAccount(addr)} target="_blank" rel="noopener noreferrer" className="num text-[12.5px] text-[#047857] hover:underline inline-flex items-center gap-1">
                  {addr.slice(0, 6)}…{addr.slice(-6)} <Icon name="arrowUpRight" size={12} />
                </a>
              </dd>
            </div>
          ))}
          <div className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <dt className="text-[13.5px] font-medium">Source code</dt>
            <dd>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-[#047857] hover:underline inline-flex items-center gap-1">
                github.com/shariqazeem/umanity <Icon name="arrowUpRight" size={12} />
              </a>
            </dd>
          </div>
        </dl>
        <Prose className="mt-4">
          <p>
            The six cause vaults, their balances and every release are listed on the <Link href="/transparency" className="text-[#047857] underline underline-offset-2">transparency page</Link>. Each cause page shows its own vault address and delivery log.
          </p>
        </Prose>
      </Section>

      <Section eyebrow="Questions" title="The short answers.">
        <div className="space-y-2">
          {[
            ['What does it cost to give?', 'Nothing beyond the Solana network fee, a fraction of a cent. Umanity takes no platform fee on gifts. Cross-chain gifts carry the 0.5% routing share described above, shown in the quote before you deposit.'],
            ['Who holds my money?', 'Nobody, in the ordinary sense. The gift sits in a program-derived vault on Solana. The Umanity authority can release an approved milestone to the recipient and nothing else. Your own wallet stays yours: the Umanity wallet created in the browser can be backed up and imported into Phantom, Solflare or Backpack at any time.'],
            ['What if my cross-chain deposit fails?', 'Quotes carry a deadline and an exact amount. If the solvers cannot fill the deposit, or you send less than quoted, the funds are returned to the refund address you entered on the origin chain.'],
            ['What happens if a vote fails?', 'The milestone stays unapproved and the money stays in the vault. The team can post more evidence and request a new vote. If a campaign passes its deadline with funds still locked, the program’s refund path lets donors claim their share back.'],
            ['Who actually delivers?', `Umanity’s own field team in Pakistan: ${CAUSES.map((c) => c.location).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. The team buys from local suppliers, hands over in person, and posts the receipts and photos under its own name. There is no partner charity in between.`],
            ['How do I verify a receipt?', 'Open the delivery on the cause page. Every file carries a sha256 hash; download it and hash it yourself to confirm it is the file the oracle audited. The milestone account on the explorer holds the attestation hash and confidence, and the release transaction shows the vault paying the recipient.'],
          ].map(([q, a]) => (
            <details key={q} className="card group">
              <summary className="list-none cursor-pointer px-5 py-4 flex items-center justify-between gap-4 text-[15px] font-semibold">
                {q}
                <Icon name="chevronDown" size={16} className="text-[#aeaeb2] transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 -mt-1 text-[14.5px] text-[#6e6e73] leading-[1.6]">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <div className="card p-8 text-center mt-12">
        <h2 className="font-display text-[32px] leading-none">Ready when you are.</h2>
        <p className="text-[14.5px] text-[#6e6e73] mt-3">Five dollars is three hot meals. You will see where it went.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
          <Btn tone="accent" size="lg" icon="heart" onClick={() => openGive()}>
            Give
          </Btn>
          <Link href="/causes" className="btn btn-secondary h-12 px-6 text-[15px]">
            See the causes
          </Link>
        </div>
      </div>
    </article>
  )
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="py-8 border-t border-black/[0.06]">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h2 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.025em] leading-tight mb-5">{title}</h2>
      {children}
    </section>
  )
}

function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-4 text-[16px] text-[#1d1d1f] leading-[1.65] [&_p]:m-0 ${className}`}>{children}</div>
}
