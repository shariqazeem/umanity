/**
 * Umanity MCP server — lets Claude (Desktop, Code) or any MCP client give to a
 * Umanity cause and follow the gift to its delivery.
 *
 * Gifts are paid over x402 (USDC on Solana) from an agent wallet that only
 * this local process holds, with a per-gift and a per-session cap. Reading
 * causes, deliveries and gift journeys needs no wallet.
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

  const server = new McpServer({ name: 'umanity', version: '1.0.0' })

  server.registerTool(
    'list_causes',
    {
      title: 'List Umanity causes',
      description: 'The causes Umanity delivers by hand in Pakistan, with what sits in each escrow vault on Solana and what the next delivery is.',
      inputSchema: {},
    },
    async () => {
      const d = await getJson<{ causes?: { id: string; name: string; impact: string; heldSol: number; raisedSol: number; supporterCount: number; nextMilestone: { index: number; description: string; thresholdSol: number } | null }[] }>('/api/causes')
      const lines = (d.causes ?? []).map(
        (c) => `• ${c.id} — ${c.name}: ${c.impact} In escrow ${c.heldSol.toFixed(3)} SOL, raised ${c.raisedSol.toFixed(3)} SOL from ${c.supporterCount} donors.${c.nextMilestone ? ` Next: delivery #${c.nextMilestone.index + 1}, ${c.nextMilestone.description}.` : ''}`
      )
      return text(`${lines.join('\n')}\n\nGive with the "give" tool (causeId + amountUsd).`)
    }
  )

  server.registerTool(
    'recent_deliveries',
    {
      title: 'Recent deliveries',
      description: 'Deliveries the field team posted, with the AI audit verdict and whether the donors released the money.',
      inputSchema: { causeId: z.string().optional().describe('Limit to one cause, e.g. clean-water') },
    },
    async ({ causeId }) => {
      const d = await getJson<{ updates?: { title: string; poolName: string; location: string | null; createdAt: string; attestation: { verdict: string; confidence: number } | null; milestone: { status: string } | null; releaseTxSignature: string | null }[] }>(`/api/field/updates?limit=10${causeId ? `&poolId=${encodeURIComponent(causeId)}` : ''}`)
      const list = d.updates ?? []
      if (!list.length) return text('No deliveries posted yet for that cause.')
      return text(
        list
          .map((u) => `• ${u.poolName}: ${u.title}${u.location ? ` (${u.location})` : ''} — ${new Date(u.createdAt).toDateString()}. Audit: ${u.attestation ? `${u.attestation.verdict} ${u.attestation.confidence}/100` : 'pending'}. ${u.releaseTxSignature ? 'Released on-chain.' : `Release: ${u.milestone?.status ?? 'pending'}.`}`)
          .join('\n')
      )
    }
  )

  server.registerTool(
    'give',
    {
      title: 'Give to a cause',
      description: `Give USDC to a Umanity cause over x402. The payment settles on Solana and lands in the cause's escrow; returns a signed receipt and a link to follow the gift. Caps: $${MAX_GIFT} per gift, $${MAX_SESSION} per session.`,
      inputSchema: {
        causeId: z.string().describe('One of the ids from list_causes'),
        amountUsd: z.number().positive().describe('Amount in USD (paid in USDC)'),
        note: z.string().max(40).optional().describe('Name shown on the gift, e.g. "claude-on-behalf-of-sam"'),
      },
    },
    async ({ causeId, amountUsd, note }) => {
      if (!signer) return text('No agent wallet is configured. Set SOLANA_AGENT_SECRET or AGENT_KEYPAIR_PATH for this MCP server (a wallet holding a little USDC).')
      if (amountUsd > MAX_GIFT) return text(`That is above the per-gift cap of $${MAX_GIFT}. Ask the user to raise UMANITY_MAX_GIFT_USD if they mean it.`)
      if (spent + amountUsd > MAX_SESSION) return text(`That would pass this session's cap of $${MAX_SESSION} ($${spent.toFixed(2)} given so far).`)
      const client = new x402Client().register('solana:*', new ExactSvmScheme(signer)).setSpendControls({ maxAmountPerPayment: `$${MAX_GIFT}` })
      const pay = wrapFetchWithPayment(fetch, client)
      const res = await pay(`${BASE}/api/x402/give`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ causeId, amountUsd, agent: note || 'claude-mcp' }) })
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; receipt?: Record<string, unknown> & { gift?: { cause?: { name?: string }; amountUsd?: string }; escrow?: { status?: string; deposit?: string }; settlement?: { transaction?: string }; track?: string } }
      if (!res.ok || !body.receipt) return text(`The gift did not go through (HTTP ${res.status}): ${body.message || body.error || 'unknown error'}. Nothing was charged unless a settlement transaction is shown.`)
      spent += amountUsd
      const r = body.receipt
      const pr = res.headers.get('payment-response')
      const settlement = r.settlement?.transaction ?? (pr ? (decodePaymentResponseHeader(pr) as { transaction?: string }).transaction : undefined)
      return text(
        [
          `Gave $${r.gift?.amountUsd} USDC to ${r.gift?.cause?.name}.`,
          `Payment settled on Solana: ${settlement ?? 'pending'}`,
          `Escrow: ${r.escrow?.status === 'deposited' ? `deposited (tx ${r.escrow.deposit})` : r.escrow?.status ?? 'unknown'}`,
          `Receipt signature: ${verifyReceipt(r) ? 'valid (ed25519, Umanity program authority)' : 'not signed'}`,
          r.track ? `Follow it: ${r.track}` : '',
          `Session total: $${spent.toFixed(2)} of $${MAX_SESSION}.`,
        ]
          .filter(Boolean)
          .join('\n')
      )
    }
  )

  server.registerTool(
    'follow_gift',
    {
      title: 'Follow a gift',
      description: 'Where a gift is now: given, escrowed, delivered, audited, voted, released, with the transaction for each step.',
      inputSchema: { ref: z.string().describe('Gift id or transaction signature (the "track" link ends with it)') },
    },
    async ({ ref }) => {
      const d = await getJson<{ journey?: { cause: { name: string }; amountSol: number; steps: { title: string; state: string; detail: string; tx?: string | null }[] } }>(`/api/gifts/${encodeURIComponent(ref.split('/').pop() ?? ref)}`)
      const j = d.journey
      if (!j) return text('Gift not found.')
      return text(`${j.amountSol.toFixed(4)} SOL to ${j.cause.name}\n${j.steps.map((s) => `${s.state === 'done' ? '✓' : s.state === 'active' ? '…' : '○'} ${s.title} — ${s.detail}${s.tx ? ` (tx ${s.tx})` : ''}`).join('\n')}`)
    }
  )

  await server.connect(new StdioServerTransport())
  log('ready')
}

main().catch((e) => {
  log(e)
  process.exit(1)
})
