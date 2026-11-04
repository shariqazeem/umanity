'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { CopyButton } from '@/components/shared/ui'
import { apiGet, fmtUsd, short, timeAgo } from '@/lib/client/api'
import { payWithX402 } from '@/lib/client/x402'
import { useOrigin } from '@/lib/client/useOrigin'
import { verifyReceipt } from '@/lib/receipt'
import { explorerTx, IS_MAINNET } from '@/lib/solana/constants'
import { pickNextDrop, useDrops } from '@/components/drops/hooks'
import { usdText } from '@/lib/umanity/drops'

interface Receipt {
  id: string
  endpoint: string
  resourceId: string | null
  payer: string | null
  amount: string
  status: string
  paymentSignature: string | null
  createdAt: string
}

type Step = { label: string; detail?: string; state: 'idle' | 'run' | 'ok' | 'err'; body?: string; link?: string }

const AMOUNTS = [1, 2, 5, 10]

export default function AgentsPage() {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const load = () =>
    apiGet<{ receipts?: Receipt[] }>('/api/x402/receipts')
      .then((d) => setReceipts(d.receipts ?? []))
      .catch(() => setReceipts([]))
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <section className="pt-2">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold tracking-[-0.02em]">Agents</h2>
          <span className="pill bg-emerald-50 text-emerald-700 !text-[10px] font-bold">x402</span>
        </div>
        <p className="text-[#86868b] text-sm max-w-xl">
          Any app, bot or AI agent can fill a drop with one HTTP request. The server answers 402, the agent pays in USDC on Solana, and the money goes into the drop&apos;s pot with the agent&apos;s wallet as the backer. If the drop misses its date, the refund goes back to that wallet. No accounts, no keys, no checkout.
        </p>
      </section>

      <Console onDone={load} />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: '♡', title: 'Fill a drop', path: 'POST /api/x402/give', price: '$1 and up', body: 'The payment is the gift. It lands in the pot in the same request, and a signed receipt comes back.' },
          { icon: '📋', title: 'See what is filling', path: 'GET /api/x402/give', price: 'free', body: 'Open drops, the room left in each pot, their dates, and how to pay.' },
          { icon: '🧾', title: 'Check the receipts', path: 'GET /api/x402/receipts', price: 'free', body: 'Every paid call with its settlement transaction on Solana.' },
        ].map((e) => (
          <div key={e.title} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-base">{e.icon}</div>
              <span className="text-[11px] font-bold counter text-emerald-600">{e.price}</span>
            </div>
            <p className="font-semibold text-[14px]">{e.title}</p>
            <p className="text-[10.5px] font-mono text-[#86868b] mt-0.5">{e.path}</p>
            <p className="text-[12px] text-[#86868b] leading-relaxed mt-2">{e.body}</p>
          </div>
        ))}
      </section>

      <Snippets />

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[15px]">Recent paid calls</h3>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Settled on Solana
          </span>
        </div>
        {receipts === null ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <p className="text-[12px] text-[#aeaeb2] text-center py-6">No paid calls yet. Run the console above to make the first one.</p>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {receipts.slice(0, 10).map((r) => (
              <li key={r.id} className="py-2.5 flex items-center gap-3 text-[12px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.status === 'settled' ? 'bg-emerald-500' : r.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <span className="font-mono text-[#525252] truncate flex-1">{r.endpoint.replace('/api/x402/', '')}</span>
                <span className="text-[#86868b] font-mono hidden sm:inline">{r.payer ? short(r.payer) : '—'}</span>
                <span className="font-semibold counter">${r.amount}</span>
                {r.paymentSignature && r.status === 'settled' ? (
                  <a href={explorerTx(r.paymentSignature)} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                    tx ↗
                  </a>
                ) : (
                  <span className="text-[#aeaeb2] capitalize w-8">{r.status === 'failed' ? 'void' : ''}</span>
                )}
                <span className="text-[#aeaeb2] w-8 text-right">{timeAgo(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Runs the real flow step by step: unpaid request → 402 → wallet signs → settlement → receipt. */
function Console({ onDone }: { onDone: () => void }) {
  const { signer, ensureSigner } = useUmanity()
  const origin = useOrigin()
  const { data: drops } = useDrops()
  const open = (drops ?? []).filter((d) => d.state === 'open' && !d.refundsOpen)
  const [picked, setPicked] = useState<number | null>(null)
  const drop = open.find((d) => d.id === picked) ?? pickNextDrop(drops)
  const [amount, setAmount] = useState(1)
  const [steps, setSteps] = useState<Step[]>([])
  const [running, setRunning] = useState(false)

  const set = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const run = async () => {
    const s = ensureSigner()
    if (!s || !drop) return
    setRunning(true)
    const body = { drop: drop.id + 1, amountUsd: amount, agent: 'umanity-console' }
    setSteps([
      { label: `POST /api/x402/give`, detail: 'request without payment', state: 'run' },
      { label: '402 Payment Required', detail: 'server states price, asset, network and payTo', state: 'idle' },
      { label: 'Sign USDC transfer', detail: 'exact scheme · facilitator pays the fee', state: 'idle' },
      { label: 'Verify → settle on Solana', detail: 'retry with PAYMENT-SIGNATURE', state: 'idle' },
      { label: '200 OK · receipt', detail: 'gift in the pot, refunds go to your wallet', state: 'idle' },
    ])
    try {
      const first = await fetch('/api/x402/give', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      set(0, { state: 'ok', detail: `HTTP ${first.status}` })
      const reqHeader = first.headers.get('payment-required')
      let decoded = ''
      if (reqHeader) {
        try {
          decoded = JSON.stringify(JSON.parse(atob(reqHeader)), null, 2)
        } catch {
          decoded = reqHeader
        }
      } else {
        decoded = await first.text()
      }
      if (first.status !== 402) throw new Error(`Expected 402, got ${first.status}: ${decoded.slice(0, 200)}`)
      set(1, { state: 'ok', body: decoded })
      set(2, { state: 'run' })
      const res = await payWithX402<{ success?: boolean; receipt?: Record<string, unknown>; error?: string }>(s, '/api/x402/give', body)
      if (!res.ok) {
        set(2, { state: 'err', detail: res.error || `HTTP ${res.status}` })
        throw new Error(res.error || 'Payment failed')
      }
      set(2, { state: 'ok', detail: 'signed in your wallet' })
      set(3, { state: 'ok', detail: res.settlement?.transaction ? `tx ${short(res.settlement.transaction, 6)}` : 'settled', body: res.settlement ? JSON.stringify(res.settlement, null, 2) : undefined })
      const receipt = (res.data as { receipt?: Record<string, unknown> & { drop?: string | null; proof?: { signer?: string } } } | undefined)?.receipt
      const track = receipt?.drop
      const signed = receipt ? verifyReceipt(receipt) : false
      set(4, {
        state: 'ok',
        detail: signed ? `receipt signature valid (ed25519, signer ${short(receipt?.proof?.signer ?? '')})` : 'gift recorded',
        body: JSON.stringify(res.data, null, 2),
        link: track ?? undefined,
      })
      onDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      setSteps((st) => {
        const i = st.findIndex((x) => x.state === 'run' || x.state === 'idle')
        return st.map((x, j) => (j === i ? { ...x, state: 'err', detail: /insufficient|balance|funds|0x1\b/i.test(msg) ? `This wallet needs ${fmtUsd(amount)} USDC${IS_MAINNET ? '' : ' on devnet (faucet.circle.com)'}` : msg } : x))
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="p-5 md:p-6 border-b border-black/[0.04]">
        <p className="text-xs font-medium text-emerald-600 uppercase tracking-widest mb-3">Live console</p>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#86868b] mb-1.5">Drop</p>
            <div className="flex flex-wrap gap-1.5">
              {open.length === 0 && <p className="text-[12px] text-[#aeaeb2] h-8 flex items-center">No drop is filling right now.</p>}
              {open.map((d) => (
                <button key={d.id} onClick={() => setPicked(d.id)} className={`h-8 px-2.5 rounded-full text-[12px] font-medium transition-all ${d.id === drop?.id ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] text-[#525252] hover:bg-black/[0.07]'}`}>
                  {d.emoji} #{d.id + 1} {d.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#86868b] mb-1.5">Amount (USDC)</p>
            <div className="flex gap-1.5">
              {AMOUNTS.map((a) => (
                <button key={a} onClick={() => setAmount(a)} className={`h-8 px-3 rounded-lg text-[12px] font-semibold counter transition-all ${a === amount ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] hover:bg-black/[0.07]'}`}>
                  ${a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={run} disabled={running || !drop} className="btn-primary px-5 py-3 !text-[13px]">
            {running ? 'Running…' : drop ? `▶ Pay ${usdText(amount)} into Drop #${drop.id + 1} via x402` : 'No drop is filling'}
          </button>
          <p className="text-[11px] text-[#aeaeb2]">{signer ? 'Your wallet plays the agent.' : 'Sign in; your wallet plays the agent.'}</p>
        </div>
      </div>

      <div className="terminal m-3 md:m-4 p-4 min-h-[180px]">
        {steps.length === 0 ? (
          <div className="text-[#6b7280]">
            <p>
              <span className="text-emerald-400">$</span> curl -X POST {origin}/api/x402/give \
            </p>
            <p className="pl-4">-H &apos;content-type: application/json&apos; -d &apos;{`{"drop":${(drop?.id ?? 0) + 1},"amountUsd":${amount}}`}&apos;</p>
            <p className="mt-2">
              <span className="text-amber-300">HTTP/1.1 402 Payment Required</span>
            </p>
            <p>payment-required: eyJ4NDAyVmVyc2lvbiI6Mi…</p>
            <p className="mt-3 text-[#9ca3af]"># Press ▶ to run the whole flow with your wallet.</p>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={i}>
                <p className="flex items-center gap-2">
                  <span className={s.state === 'ok' ? 'text-emerald-400' : s.state === 'err' ? 'text-red-400' : s.state === 'run' ? 'text-amber-300 animate-pulse' : 'text-[#4b5563]'}>{s.state === 'ok' ? '✓' : s.state === 'err' ? '✗' : s.state === 'run' ? '●' : '○'}</span>
                  <span className={s.state === 'idle' ? 'text-[#4b5563]' : 'text-white'}>{s.label}</span>
                  {s.detail && <span className="text-[#6b7280]">— {s.detail}</span>}
                </p>
                {s.body && <pre className="mt-1.5 ml-5 text-[11px] text-[#9ca3af] whitespace-pre-wrap break-all max-h-56 overflow-y-auto">{s.body}</pre>}
                {s.link && (
                  <a href={s.link.replace(/^https?:\/\/[^/]+/, '')} className="inline-block mt-2 ml-5 text-[12px] font-semibold text-emerald-400 hover:underline">
                    → Open the drop this gift is in
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function Snippets() {
  const [tab, setTab] = useState<'ts' | 'mcp' | 'curl'>('ts')
  const origin = useOrigin()
  const code = {
    ts: `import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { createKeyPairSignerFromBytes } from '@solana/kit'

const signer = await createKeyPairSignerFromBytes(secretKey)
const client = new x402Client().register('solana:*', new ExactSvmScheme(signer))
const pay = wrapFetchWithPayment(fetch, client)

// 402 → sign → settle → receipt, in one call
const res = await pay('${origin}/api/x402/give', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ drop: 1, amountUsd: 5, agent: 'my-agent' }),
})
console.log(await res.json()) // { receipt: { gift, settlement, pot, rules, proof } }`,
    mcp: `// claude_desktop_config.json — give from Claude, Cursor or any MCP client
{
  "mcpServers": {
    "umanity": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": {
        "UMANITY_URL": "${origin}",
        "SOLANA_AGENT_SECRET": "[...]"
      }
    }
  }
}
// tools: list_drops · get_drop · give`,
    curl: `curl -i -X POST ${origin}/api/x402/give \\
  -H 'content-type: application/json' \\
  -d '{"drop":1,"amountUsd":5}'

HTTP/1.1 402 Payment Required
payment-required: <base64 JSON: scheme exact · network solana · asset USDC · payTo · amount>

# Retry with PAYMENT-SIGNATURE: <base64 signed USDC transfer>
HTTP/1.1 200 OK
payment-response: <base64 JSON: success · transaction · network · payer>`,
  }[tab]
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="font-bold text-[15px]">Integrate in a minute</h3>
        <div className="flex gap-1.5">
          {(
            [
              ['ts', 'TypeScript'],
              ['mcp', 'MCP'],
              ['curl', 'curl'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${tab === k ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <pre className="terminal p-4 overflow-x-auto text-[11.5px] leading-relaxed whitespace-pre">{code}</pre>
      <div className="flex items-center justify-between mt-3">
        <p className="text-[11px] text-[#86868b]">
          A gift the drop can&apos;t take is refused before payment, so the agent is never charged for it. <Link href="/money" className="text-emerald-600 hover:underline">Every dollar is on Money →</Link>
        </p>
        <CopyButton text={code} />
      </div>
    </section>
  )
}
