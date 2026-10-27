'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const POOLS = [
  { id: 'palestine-red-crescent', name: 'Palestine Red Crescent Society', category: 'Healthcare', type: 'Verified Charity Trust' },
  { id: 'turkish-red-crescent', name: 'Turkish Red Crescent (Kizilay)', category: 'Disaster Relief', type: 'Verified Charity Trust' },
  { id: 'mercy-corps', name: 'Mercy Corps', category: 'Food & Water', type: 'Verified Charity Trust' },
  { id: 'edhi-foundation', name: 'Edhi Foundation', category: 'Humanitarian', type: 'Verified Charity Trust' },
  { id: 'orphanage-aid', name: 'Local Orphanage Aid', category: 'Children', type: 'Physical Delivery' },
  { id: 'animal-rescue', name: 'Street Animal Rescue', category: 'Animal Welfare', type: 'Physical Delivery' },
]

export default function BlinksPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copyUrl = (poolId: string) => {
    const actionUrl = `${baseUrl}/api/actions/donate/${poolId}`
    const url = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}&cluster=devnet`
    navigator.clipboard.writeText(url)
    setCopiedId(poolId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen page-bg">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-black/[0.03]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="Umanity" width={32} height={32} className="rounded-full" />
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Solana Blinks
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 animate-fade-up">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Solana Blinks</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Donate to any Umanity charity pool from any X feed, website, or app that supports Solana Actions. Copy a Blink URL and share it anywhere.
          </p>
          <p className="text-[12px] text-gray-300 mt-2">
            Blinks use the Solana Actions API v2.1.3 — GET returns metadata, POST returns a partially-signed transaction.
          </p>
        </div>

        <div className="space-y-3 animate-stagger">
          {POOLS.map((pool) => {
            const actionUrl = `${baseUrl}/api/actions/donate/${pool.id}`
            const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}&cluster=devnet`
            const isCopied = copiedId === pool.id

            return (
              <div key={pool.id} className="card p-6 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{pool.name}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        pool.type === 'Verified Charity Trust'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : 'bg-blue-50 text-blue-600 border border-blue-200/60'
                      }`}>
                        {pool.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{pool.category}</p>

                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] bg-gray-50 border border-black/[0.04] rounded-lg px-3 py-2 text-gray-500 truncate font-mono">
                        {blinkUrl}
                      </code>
                      <a
                        href={blinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg text-xs font-medium border border-black/[0.06] text-[#86868b] hover:text-[#1d1d1f] hover:border-black/[0.12] transition-all"
                      >
                        Try
                      </a>
                      <button
                        onClick={() => copyUrl(pool.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                          isCopied
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'btn-primary'
                        }`}
                      >
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-black/[0.03] text-[11px] text-gray-300">
                  <span>GET → Action metadata</span>
                  <span className="text-gray-200">|</span>
                  <span>POST → Partially-signed tx</span>
                  <span className="text-gray-200">|</span>
                  <span>Amounts: 0.01, 0.05, 0.1, 0.5 SOL</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-300">
            All Blinks route to on-chain escrow vaults via Anchor programs. Transactions verifiable on Solscan.
          </p>
          <Link href="/" className="inline-block mt-4 btn-secondary px-6 py-2.5 text-[13px] rounded-xl">
            Back to App
          </Link>
        </div>
      </main>
    </div>
  )
}
