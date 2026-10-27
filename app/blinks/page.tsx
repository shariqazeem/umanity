'use client'

/**
 * Blinks: every cause is a Solana Action anyone can post on X or embed. The
 * same endpoint powers wallets, Blink-aware clients and dial.to.
 */
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CAUSES } from '@/lib/causes'
import { Btn, Icon, Img, Pill } from '@/components/shared/ui'
import { IS_MAINNET } from '@/lib/solana/constants'

export default function BlinksPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const actionUrl = (id: string) => `${base}/api/actions/donate/${id}`
  const dialUrl = (id: string) => `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl(id))}${IS_MAINNET ? '' : '&cluster=devnet'}`
  const copy = (id: string) => {
    navigator.clipboard.writeText(dialUrl(id)).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="min-h-[100dvh] bg-[#f5f5f7]">
      <header className="sticky top-0 z-50 glass hairline-b">
        <div className="container-app h-16 flex items-center gap-3">
          <Link href="/home" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Umanity" width={34} height={34} className="rounded-full" />
            <span className="text-[17px] font-bold tracking-[-0.02em]">Umanity</span>
          </Link>
          <Pill tone="gray" className="ml-2">
            Blinks
          </Pill>
          <Link href="/home" className="ml-auto btn btn-outline h-10 px-4.5 text-[13.5px]">
            Open app
          </Link>
        </div>
      </header>

      <main className="container-app py-10">
        <div className="max-w-[640px]">
          <p className="eyebrow mb-4">Solana Actions</p>
          <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.02]">Give from inside a post.</h1>
          <p className="text-[16px] text-[#6e6e73] mt-4 leading-relaxed">Each cause is a Blink: paste the link on X, in a group chat or on a website, and anyone with a Solana wallet can give without leaving the page. The gift lands in the same escrow vault as every other gift.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {CAUSES.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <div className="h-[150px] overflow-hidden">
                <Img src={c.image} alt={c.imageAlt} />
              </div>
              <div className="p-5">
                <h2 className="text-[17px] font-bold tracking-[-0.02em]">{c.name}</h2>
                <p className="text-[13px] text-[#6e6e73] mt-1">{c.impact}</p>
                <p className="num text-[11.5px] text-[#aeaeb2] mt-3 break-all">{actionUrl(c.id).replace(/^https?:\/\//, '')}</p>
                <div className="flex gap-2 mt-4">
                  <Btn size="sm" tone={copied === c.id ? 'secondary' : 'primary'} icon={copied === c.id ? 'check' : 'copy'} onClick={() => copy(c.id)}>
                    {copied === c.id ? 'Copied' : 'Copy Blink'}
                  </Btn>
                  <a href={dialUrl(c.id)} target="_blank" rel="noopener noreferrer" className="btn btn-outline h-8 px-3.5 text-[12.5px]">
                    Preview <Icon name="arrowUpRight" size={13} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-6 mt-10 max-w-[720px]">
          <h3 className="text-[16px] font-bold">For developers</h3>
          <p className="text-[13.5px] text-[#6e6e73] mt-1.5 leading-relaxed">
            <span className="num">GET /api/actions/donate/&lt;causeId&gt;</span> returns the Action metadata; <span className="num">POST</span> with <span className="num">{'{ account }'}</span> and an <span className="num">amount</span> query returns an unsigned transaction calling the escrow program&apos;s <span className="num">donate</span> instruction. Dares have their own Blink at <span className="num">/api/actions/dare/&lt;dareId&gt;</span>. CORS and <span className="num">actions.json</span> are configured.
          </p>
        </div>
      </main>
    </div>
  )
}
