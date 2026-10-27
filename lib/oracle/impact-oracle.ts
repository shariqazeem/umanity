/**
 * AI Impact Oracle — audits a milestone's delivery evidence and returns a
 * signed-style attestation: verdict, confidence, per-check results, and a
 * SHA-256 attestation hash that is written on-chain via `attest_milestone`.
 *
 * Model backends (first configured wins):
 *   1. NEAR AI Cloud (confidential TEE inference, OpenAI-compatible) — NEAR_AI_API_KEY
 *   2. Anthropic Claude — ANTHROPIC_API_KEY
 *   3. Deterministic rule-based audit (no key) — honest about being rule-based
 */
import { createHash } from 'crypto'
import type { MilestoneEvidence, OracleAttestation } from '@/lib/db'

export interface OracleInput {
  milestoneId: string
  causeName: string
  milestoneDescription: string
  amountSol: number
  recipient: string
  deliveryMode: 'trust' | 'field' | 'partner'
  evidence: MilestoneEvidence | null
}

interface ModelVerdict {
  verdict: OracleAttestation['verdict']
  confidence: number
  summary: string
  checks: { name: string; passed: boolean; note?: string }[]
}

const SYSTEM = `You are the Umanity Impact Oracle. You audit evidence that a charity milestone was delivered in the real world before escrowed donations are released. Be strict, specific and concise. Judge: (1) does the evidence match the milestone description, (2) are receipts/invoices plausible for the amount, (3) is there independent corroboration (photos with location, third-party links, dates), (4) any sign of reuse, editing or inconsistency. Output only JSON: {"verdict":"verified"|"inconclusive"|"rejected","confidence":0-100,"summary":"one paragraph","checks":[{"name":"...","passed":true|false,"note":"..."}]}`

function buildPrompt(input: OracleInput): string {
  const ev = input.evidence
  const items = ev?.items?.map((i, n) => `  ${n + 1}. [${i.kind}] ${i.url ?? ''} ${i.sha256 ? `sha256=${i.sha256}` : ''} ${i.lat != null ? `geo=${i.lat},${i.lng}` : ''} ${i.note ?? ''}`.trim()).join('\n') || '  (no evidence items)'
  return `Cause: ${input.causeName}\nDelivery mode: ${input.deliveryMode === 'field' ? 'Umanity team delivers in person' : 'verified charity trust'}\nMilestone: ${input.milestoneDescription}\nEscrow to release: ${input.amountSol.toFixed(3)} SOL to ${input.recipient}\nEvidence summary: ${ev?.summary ?? '(none submitted)'}\nSubmitted by: ${ev?.submittedBy ?? 'unknown'} at ${ev?.submittedAt ?? 'unknown'}\nEvidence items:\n${items}\n\nReturn the JSON verdict.`
}

function parseVerdict(text: string): ModelVerdict | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as Partial<ModelVerdict>
    if (!j.verdict || typeof j.confidence !== 'number') return null
    return {
      verdict: (['verified', 'inconclusive', 'rejected'].includes(j.verdict) ? j.verdict : 'inconclusive') as ModelVerdict['verdict'],
      confidence: Math.max(0, Math.min(100, Math.round(j.confidence))),
      summary: String(j.summary ?? '').slice(0, 1500),
      checks: Array.isArray(j.checks) ? j.checks.slice(0, 12).map((c) => ({ name: String(c.name ?? 'check').slice(0, 80), passed: !!c.passed, note: c.note ? String(c.note).slice(0, 300) : undefined })) : [],
    }
  } catch {
    return null
  }
}

async function viaOpenAICompatible(baseUrl: string, apiKey: string, model: string, input: OracleInput): Promise<ModelVerdict | null> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 800, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(input) }] }),
    signal: AbortSignal.timeout(40_000),
  })
  if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return parseVerdict(j.choices?.[0]?.message?.content ?? '')
}

async function viaAnthropic(apiKey: string, input: OracleInput): Promise<ModelVerdict | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 800, temperature: 0, system: SYSTEM, messages: [{ role: 'user', content: buildPrompt(input) }] }),
    signal: AbortSignal.timeout(40_000),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { content?: { type: string; text?: string }[] }
  return parseVerdict(j.content?.map((c) => c.text ?? '').join('') ?? '')
}

/** Transparent rule-based audit when no model key is configured. */
function ruleBased(input: OracleInput): ModelVerdict {
  const ev = input.evidence
  const items = ev?.items ?? []
  const checks: ModelVerdict['checks'] = []
  const has = (k: string) => items.some((i) => i.kind === k)
  checks.push({ name: 'Evidence submitted', passed: !!ev && items.length > 0, note: ev ? `${items.length} item(s)` : 'nothing submitted' })
  checks.push({ name: 'Receipt or invoice present', passed: has('receipt') || has('invoice') })
  checks.push({ name: 'Visual proof (photo/video)', passed: has('photo') || has('video') })
  checks.push({ name: 'Location data', passed: items.some((i) => i.lat != null && i.lng != null) || has('geo'), note: input.deliveryMode === 'field' ? 'required for field deliveries' : 'optional for charity trusts' })
  checks.push({ name: 'Content hashes recorded', passed: items.some((i) => !!i.sha256) })
  checks.push({ name: 'Summary references milestone', passed: !!ev?.summary && input.milestoneDescription.split(' ').filter((w) => w.length > 4).some((w) => ev!.summary.toLowerCase().includes(w.toLowerCase())) })
  const passed = checks.filter((c) => c.passed).length
  const confidence = Math.round((passed / checks.length) * 100)
  const verdict: ModelVerdict['verdict'] = !ev || items.length === 0 ? 'rejected' : confidence >= 70 ? 'verified' : confidence >= 40 ? 'inconclusive' : 'rejected'
  return { verdict, confidence, summary: `Rule-based audit (no model key configured): ${passed}/${checks.length} checks passed for "${input.milestoneDescription}".`, checks }
}

export async function runImpactOracle(input: OracleInput): Promise<OracleAttestation> {
  let model = 'rules-v1'
  let verdict: ModelVerdict | null = null
  try {
    if (process.env.NEAR_AI_API_KEY) {
      model = `near-ai:${process.env.NEAR_AI_MODEL || 'zai-org/GLM-5.1-FP8'}`
      verdict = await viaOpenAICompatible(process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1', process.env.NEAR_AI_API_KEY, process.env.NEAR_AI_MODEL || 'zai-org/GLM-5.1-FP8', input)
    } else if (process.env.ANTHROPIC_API_KEY) {
      model = `anthropic:${process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'}`
      verdict = await viaAnthropic(process.env.ANTHROPIC_API_KEY, input)
    }
  } catch (e) {
    console.error('oracle model error, falling back to rules', e)
  }
  if (!verdict) {
    model = verdict === null && model !== 'rules-v1' ? `${model}+rules-fallback` : 'rules-v1'
    verdict = ruleBased(input)
  }
  const issuedAt = new Date().toISOString()
  const canonical = JSON.stringify({ milestoneId: input.milestoneId, evidence: input.evidence, verdict: verdict.verdict, confidence: verdict.confidence, checks: verdict.checks, model, issuedAt })
  const attestationHash = createHash('sha256').update(canonical).digest('hex')
  return { verdict: verdict.verdict, confidence: verdict.confidence, summary: verdict.summary, checks: verdict.checks, model, attestationHash, issuedAt }
}
