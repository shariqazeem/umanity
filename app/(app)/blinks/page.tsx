'use client'

/**
 * Blinks: every cause is a Solana Action anyone can post on X or embed. The
 * same endpoint powers wallets, Blink-aware clients and dial.to.
 */
import { useState } from 'react'
import { CAUSES } from '@/lib/causes'
import { IS_MAINNET } from '@/lib/solana/constants'
import { useOrigin } from '@/lib/client/useOrigin'

export default function BlinksPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const base = useOrigin()
  const actionUrl = (id: string) => `${base}/api/actions/donate/${id}`
  const dialUrl = (id: string) => `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl(id))}${IS_MAINNET ? '' : '&cluster=devnet'}`
  const copy = (id: string) =>
    navigator.clipboard.writeText(dialUrl(id)).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })

  return (
    <div>
      <section className="pt-2 mb-5">
        <h2 className="text-2xl font-bold tracking-[-0.02em] mb-1">Blinks</h2>
        <p className="text-[#86868b] text-sm max-w-xl">Every cause is a Solana Blink. Paste the link in a post on X, a group chat or a website, and anyone with a Solana wallet can give without leaving the page. The gift lands in the same escrow vault as every other gift.</p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-stagger">
        {CAUSES.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-2xl">{c.emoji}</div>
              <span className="pill bg-amber-50 text-amber-600 !text-[10px] font-semibold">⚡ Blink</span>
            </div>
            <h3 className="font-semibold">{c.name}</h3>
            <p className="text-xs text-[#86868b] mt-1">{c.impact}</p>
            <p className="font-mono text-[10px] text-[#aeaeb2] mt-3 break-all">{actionUrl(c.id).replace(/^https?:\/\//, '')}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => copy(c.id)} className="btn-primary flex-1 py-2.5 !text-[12px]">
                {copied === c.id ? '✓ Copied' : 'Copy Blink'}
              </button>
              <a href={dialUrl(c.id)} target="_blank" rel="noopener noreferrer" className="btn-secondary px-4 py-2.5 !text-[12px]">
                Try on dial.to ↗
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 mt-4">
        <p className="text-[13px] font-semibold">How it works</p>
        <p className="text-[12px] text-[#86868b] leading-relaxed mt-1">
          <span className="font-mono">GET /api/actions/donate/[cause]</span> returns the Action (title, icon, amounts). <span className="font-mono">POST</span> returns a transaction calling <span className="font-mono">donate</span> on the escrow program for the wallet to sign. Dares have their own Blink at <span className="font-mono">/api/actions/dare/[id]</span>.
        </p>
      </div>
    </div>
  )
}
