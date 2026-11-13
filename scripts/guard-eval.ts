/**
 * Runs Umanity's AI checker on test proofs for Drop #1 exactly as the NEAR guard would, and checks every
 * answer the way the guard contract does: NEAR AI's TEE must have signed `<model>:<sha256(request)>:
 * <sha256(response)>` with a key the mainnet guard trusts, and the answer must read as one verdict.
 *
 *   npx tsx scripts/guard-eval.ts             ask the TEE (needs NEAR_AI_API_KEY in .env.local)
 *   npx tsx scripts/guard-eval.ts --verify    recheck the saved answers offline: no key needed
 *
 * Read-only on NEAR mainnet: the request comes from guard.umanity.near's `checker_request` view, and
 * nothing is written on-chain. Inputs: docs/guard-eval/cases.json and docs/guard-eval/images/ (served from
 * this repo). Outputs: docs/guard-eval/results.json and docs/guard-eval/runs/<case>.{request,response}.json,
 * the exact bytes that were signed.
 */
import dotenv from 'dotenv'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import nacl from 'tweetnacl'

dotenv.config({ path: '.env.local' })
process.env.NEAR_NETWORK = 'mainnet'
process.env.NEAR_GUARD_CONTRACT = 'guard.umanity.near'

const DIR = path.join(process.cwd(), 'docs/guard-eval')
const RUNS = path.join(DIR, 'runs')
const IMAGES_URL = 'https://raw.githubusercontent.com/shariqazeem/umanity/mainnet/docs/guard-eval/images/'
const DROP_ID = 0 // Drop #1 on Solana mainnet
const AT = '2026-11-13T12:00:00.000Z' // a fixed time, so every bundle (and its hash) is reproducible

type Case = { id: string; expect: 'APPROVE' | 'REJECT'; attack: string; title: string; body: string; media: { kind: string; file: string }[] }
type Result = {
  id: string; expect: string; verdict: string | null; reason: string; pass: boolean; attack: string
  chat_id: string; signer: string; signature: string; signed_text: string
  request_sha256: string; response_sha256: string; bundle_sha256: string; checks: Record<string, boolean>
}

const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')

/** The guard's `read_answer`: exactly one `content` string that starts with `VERDICT: `, read as JSON. */
function readAnswer(response: string): { approve: boolean; reason: string } {
  let start = -1
  for (const pattern of ['"content":"VERDICT: ', '"content": "VERDICT: ']) {
    let at = response.indexOf(pattern)
    while (at !== -1) {
      if (start !== -1) throw new Error('The response holds more than one answer')
      start = at + pattern.length - 'VERDICT: '.length
      at = response.indexOf(pattern, at + 1)
    }
  }
  if (start === -1) throw new Error('The answer does not start with a verdict')
  let end = start
  while (end < response.length && response[end] !== '"') end += response[end] === '\\' ? 2 : 1
  const text = JSON.parse(`"${response.slice(start, end)}"`) as string
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const first = (lines[0] ?? '').replace(/\.+$/, '')
  if (first !== 'VERDICT: APPROVE' && first !== 'VERDICT: REJECT') throw new Error('The verdict is neither APPROVE nor REJECT')
  const reason = lines.find((l) => l.startsWith('REASON:'))?.slice(7).trim().slice(0, 200) ?? ''
  return { approve: first === 'VERDICT: APPROVE', reason }
}

/** The guard's `verify`: the TEE's ed25519 signature over model:sha256(request):sha256(response), by a trusted key. */
function check(model: string, trusted: string[], request: string, response: string, signer: string, signature: string, signedText: string) {
  const text = `${model}:${sha256(request)}:${sha256(response)}`
  const checks = {
    'signed by a key the guard trusts': trusted.includes(signer),
    'signed text is model:sha256(request):sha256(response)': signedText === text,
    'ed25519 signature is valid': nacl.sign.detached.verify(Buffer.from(text, 'utf8'), Buffer.from(signature, 'hex'), Buffer.from(signer, 'hex')),
  }
  return { checks, ok: Object.values(checks).every(Boolean) }
}

async function main() {
  const verifyOnly = process.argv.includes('--verify')
  const { guardConfig, checkerRequest } = await import('@/lib/near/guard')
  const config = await guardConfig()
  const model = config.checker!.model
  const trusted = config.ai_signers

  if (verifyOnly) {
    const results = JSON.parse(fs.readFileSync(path.join(DIR, 'results.json'), 'utf8')) as Result[]
    let bad = 0
    for (const r of results) {
      const request = fs.readFileSync(path.join(RUNS, `${r.id}.request.json`), 'utf8')
      const response = fs.readFileSync(path.join(RUNS, `${r.id}.response.json`), 'utf8')
      const { ok } = check(model, trusted, request, response, r.signer, r.signature, r.signed_text)
      const answer = readAnswer(response)
      const same = (answer.approve ? 'APPROVE' : 'REJECT') === r.verdict
      if (!ok || !same) bad++
      console.log(`${ok && same ? '✓' : '✗'} ${r.id.padEnd(16)} ${r.verdict}  signature ${ok ? 'valid' : 'INVALID'}`)
    }
    console.log(bad ? `\n${bad} answer(s) failed the check` : `\nAll ${results.length} answers were signed by the TEE key guard.umanity.near trusts.`)
    process.exit(bad ? 1 : 0)
  }

  const { askTheTee } = await import('@/lib/near/checker')
  const { canonicalJson } = await import('@/lib/umanity/drops')
  const cases = JSON.parse(fs.readFileSync(path.join(DIR, 'cases.json'), 'utf8')) as Case[]
  const only = process.argv.find((a) => a.startsWith('--case='))?.slice(7)

  // Drop #1's public promise, exactly as hashed on Solana.
  const drop = ((await (await fetch(`https://umanity.gives/api/drops/${DROP_ID}`)).json()) as { drop: { meta: string; metaHash: string } }).drop
  if (sha256(drop.meta) !== drop.metaHash) throw new Error("The promise doesn't match its hash on Solana")
  console.log(`Drop #1's promise: sha256 ${drop.metaHash.slice(0, 16)}… matches Solana\nChecker: ${model}\nTrusted TEE keys: ${trusted.map((k) => k.slice(0, 8) + '…').join(', ')}\n`)

  fs.mkdirSync(RUNS, { recursive: true })
  const previous: Result[] = fs.existsSync(path.join(DIR, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'results.json'), 'utf8')) : []
  const results: Result[] = []
  for (const c of cases) {
    if (only && c.id !== only) {
      const kept = previous.find((r) => r.id === c.id)
      if (kept) results.push(kept)
      continue
    }
    const media = c.media.map((m) => ({ url: IMAGES_URL + m.file, kind: m.kind, sha256: sha256(fs.readFileSync(path.join(DIR, 'images', m.file))) }))
    const bundle = canonicalJson({ v: 1, drop: DROP_ID, title: c.title, body: c.body, xPostUrl: null, media, at: AT })
    const request = await checkerRequest(DROP_ID, drop.meta, bundle)
    const tee = await askTheTee(request, model)
    const { checks, ok } = check(model, trusted, request, tee.response, tee.signer, tee.signature, tee.text)
    let verdict: string | null = null
    let reason = ''
    try {
      const a = readAnswer(tee.response)
      verdict = a.approve ? 'APPROVE' : 'REJECT'
      reason = a.reason
    } catch (e) {
      reason = (e as Error).message
    }
    fs.writeFileSync(path.join(RUNS, `${c.id}.request.json`), request)
    fs.writeFileSync(path.join(RUNS, `${c.id}.response.json`), tee.response)
    const pass = ok && verdict === c.expect
    results.push({
      id: c.id, expect: c.expect, verdict, reason, pass, attack: c.attack,
      chat_id: tee.chatId, signer: tee.signer, signature: tee.signature, signed_text: tee.text,
      request_sha256: sha256(request), response_sha256: sha256(tee.response), bundle_sha256: sha256(bundle), checks,
    })
    console.log(`${pass ? '✓' : '✗'} ${c.id.padEnd(16)} expected ${c.expect.padEnd(7)} got ${String(verdict).padEnd(7)} signature ${ok ? 'valid' : 'INVALID'}\n    ${reason}`)
  }
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  const passed = results.filter((r) => r.pass).length
  console.log(`\n${passed} of ${results.length} cases as expected. Results: docs/guard-eval/results.json`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
