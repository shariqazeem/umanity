/**
 * Umanity MCP server: lets Claude (Desktop, Code) or any MCP client fill a
 * Umanity drop and follow it to its filmed delivery.
 *
 * Gifts are paid over x402 (USDC on Solana) from an agent wallet that only
 * this local process holds, with a per-gift and a per-session cap. Reading
 * drops needs no wallet.
 *
 *   npx tsx mcp/server.ts            (stdio transport)
 *
 * Env:
 *   UMANITY_URL              app URL (default http://localhost:3000)
 *   SOLANA_AGENT_SECRET      agent wallet secret key as a JSON byte array, or
 *   AGENT_KEYPAIR_PATH       path to a Solana CLI keypair file
 *   UMANITY_MAX_GIFT_USD     cap per gift (default 5)
 *   UMANITY_MAX_SESSION_USD  cap for this session (default 20)
 *
 * stdout is the MCP channel: everything else goes to stderr.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit'
import { verifyReceipt } from '../lib/receipt'

const BASE = (process.env.UMANITY_URL || 'http://localhost:3000').replace(/\/$/, '')
const MAX_GIFT = Number(process.env.UMANITY_MAX_GIFT_USD || 5)
const MAX_SESSION = Number(process.env.UMANITY_MAX_SESSION_USD || 20)
let spent = 0

const log = (...a: unknown[]) => console.error('[umanity-mcp]', ...a)

async function loadSigner(): Promise<KeyPairSigner | null> {
  try {
    let raw = process.env.SOLANA_AGENT_SECRET
    if (!raw && process.env.AGENT_KEYPAIR_PATH) {
      const p = process.env.AGENT_KEYPAIR_PATH.replace(/^~/, os.homedir())
      raw = fs.readFileSync(path.resolve(p), 'utf8')
    }
    if (!raw) return null
    return await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(raw)))
  } catch (e) {
    log('could not load the agent wallet:', e instanceof Error ? e.message : e)
    return null
  }
}

async function getJson<T>(p: string): Promise<T> {
  const res = await fetch(`${BASE}${p}`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${p} → HTTP ${res.status}`)
  return (await res.json()) as T
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] })

async function main() {
  const signer = await loadSigner()
  log(`app ${BASE} · agent wallet ${signer ? signer.address : 'not configured (read-only)'} · caps $${MAX_GIFT}/gift, $${MAX_SESSION}/session`)

  const server = new McpServer({ name: 'umanity', version: '3.0.0' })

  type Drop = { id: number; title: string; place: string; emoji: string; unit: { name: string; usd: number; people: number }; potUsd: number; goalUsd: number; capUsd: number; deadline: number; state: string; refundsOpen: boolean; backers: number }
  const dropLine = (d: Drop) =>
    `• Drop #${d.id + 1}: ${d.emoji} ${d.title} (${d.place}). $${d.potUsd.toFixed(2)} of $${d.goalUsd.toFixed(0)} from ${d.backers} backers; 1 ${d.unit.name} = $${d.unit.usd} and helps ${d.unit.people}. ${d.state === 'open' && !d.refundsOpen ? `Filling until ${new Date(d.deadline * 1000).toDateString()}, room for $${Math.max(0, d.capUsd - d.potUsd).toFixed(2)}.` : d.refundsOpen ? 'Missed its date: refunds open.' : `State: ${d.state}.`}`

  server.registerTool(
    'list_drops',
    {
      title: 'List Umanity drops',
      description: 'Drops are real, filmed deliveries. Each has a USDC pot on Solana that pays out only after the delivery is proven, and refunds every backer if it misses its date.',
      inputSchema: {},
    },
    async () => {
      const d = await getJson<{ drops?: Drop[] }>('/api/drops')
      const list = d.drops ?? []
      if (!list.length) return text('No drops yet. The first one opens soon.')
      return text(`${list.map(dropLine).join('\n')}\n\nFill one with the "give" tool (drop number + amountUsd).`)
    }
  )

  server.registerTool(
    'get_drop',
    {
      title: 'One drop in detail',
      description: 'What a drop buys, its pot, its backers, its proof (when posted) and every on-chain step so far.',
      inputSchema: { drop: z.number().int().positive().describe('Drop number as shown in the app, e.g. 1') },
    },
    async ({ drop }) => {
      const d = await getJson<{ drop?: Drop & { story: string; items: { name: string; qty: number; usd: number }[]; updates: { kind: string; title: string; proofTx: string | null }[]; timeline: { kind: string; signature: string }[] } }>(`/api/drops/${drop - 1}`)
      const x = d.drop
      if (!x) return text('No such drop.')
      return text(
        [
          dropLine(x),
          x.story,
          x.items?.length ? `Buys: ${x.items.map((i) => `${i.qty} × ${i.name} ($${i.usd})`).join(', ')}` : '',
          x.updates?.length ? `Updates: ${x.updates.map((u) => `${u.kind === 'proof' ? 'PROOF' : 'update'}: ${u.title}${u.proofTx ? ` (tx ${u.proofTx})` : ''}`).join('; ')}` : 'No proof posted yet.',
          x.timeline?.length ? `On-chain: ${x.timeline.map((t) => `${t.kind} ${t.signature.slice(0, 12)}…`).join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      )
    }
  )

  server.registerTool(
    'give',
    {
      title: 'Fill a drop',
      description: `Put USDC into a Umanity drop over x402. The payment settles on Solana and goes into the drop's pot with this agent's wallet as the backer, so a missed date refunds that wallet. Returns a signed receipt. Caps: $${MAX_GIFT} per gift, $${MAX_SESSION} per session.`,
      inputSchema: {
        drop: z.number().int().positive().optional().describe('Drop number from list_drops (defaults to the next drop)'),
        amountUsd: z.number().min(1).describe('Amount in USD, paid in USDC (at least $1)'),
        note: z.string().max(40).optional().describe('Name shown on the gift, e.g. "claude-on-behalf-of-sam"'),
      },
    },
    async ({ drop, amountUsd, note }) => {
      if (!signer) return text('No agent wallet is configured. Set SOLANA_AGENT_SECRET or AGENT_KEYPAIR_PATH for this MCP server (a wallet holding a little USDC).')
      if (amountUsd > MAX_GIFT) return text(`That is above the per-gift cap of $${MAX_GIFT}. Ask the user to raise UMANITY_MAX_GIFT_USD if they mean it.`)
      if (spent + amountUsd > MAX_SESSION) return text(`That would pass this session's cap of $${MAX_SESSION} ($${spent.toFixed(2)} given so far).`)
      const client = new x402Client().register('solana:*', new ExactSvmScheme(signer)).setSpendControls({ maxAmountPerPayment: `$${MAX_GIFT}` })
      const pay = wrapFetchWithPayment(fetch, client)
      const res = await pay(`${BASE}/api/x402/give`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drop, amountUsd, agent: note || 'claude-mcp' }) })
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; receipt?: Record<string, unknown> & { gift?: { drop?: { number?: number; title?: string }; amountUsd?: string }; pot?: { status?: string; give?: string }; settlement?: { transaction?: string }; drop?: string } }
      if (!res.ok || !body.receipt) return text(`The gift did not go through (HTTP ${res.status}): ${body.message || body.error || 'unknown error'}. Nothing was charged unless a settlement transaction is shown.`)
      spent += amountUsd
      const r = body.receipt
      const pr = res.headers.get('payment-response')
      const settlement = r.settlement?.transaction ?? (pr ? (decodePaymentResponseHeader(pr) as { transaction?: string }).transaction : undefined)
      return text(
        [
          `Put $${r.gift?.amountUsd} USDC into Drop #${r.gift?.drop?.number}: ${r.gift?.drop?.title}.`,
          `Payment settled on Solana: ${settlement ?? 'pending'}`,
          `Pot: ${r.pot?.status === 'in_pot' ? `in the pot (tx ${r.pot.give})` : (r.pot?.status ?? 'unknown')}`,
          `Receipt signature: ${verifyReceipt(r) ? 'valid (ed25519, Umanity authority)' : 'not signed'}`,
          r.drop ? `Watch it: ${r.drop}` : '',
          `Session total: $${spent.toFixed(2)} of $${MAX_SESSION}.`,
        ]
          .filter(Boolean)
          .join('\n')
      )
    }
  )

  await server.connect(new StdioServerTransport())
  log('ready')
}

main().catch((e) => {
  log(e)
  process.exit(1)
})
