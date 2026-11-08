/**
 * Talking to NEAR from the server: views, and calls from the bot account that
 * wait for the whole receipt chain (a release waits for the MPC network's
 * signature, which arrives a few seconds to two minutes later). Server-only.
 */
import { createHash } from 'crypto'
import bs58 from 'bs58'
import { Account, FailoverRpcProvider, JsonRpcProvider, KeyPairSigner, actions, getTransactionLastResult, type KeyPairString } from 'near-api-js'
import { NEAR_RPC_URLS } from './config'

type Outcome = Awaited<ReturnType<FailoverRpcProvider['viewTransactionStatus']>>

let provider: FailoverRpcProvider | null = null
export function nearProvider() {
  provider ??= new FailoverRpcProvider(NEAR_RPC_URLS.map((url) => new JsonRpcProvider({ url })))
  return provider
}

export async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await nearProvider().callFunction({ contractId, method, args })) as T
}

export function nearAccount(accountId: string, secretKey: string) {
  return new Account(accountId, nearProvider(), KeyPairSigner.fromSecretKey(secretKey as KeyPairString))
}

/** The server's bot: the guard's registrar, and the payer of gas for verdicts and releases. */
export function botAccount(): Account | null {
  const id = process.env.NEAR_ACCOUNT_ID?.trim()
  const key = process.env.NEAR_PRIVATE_KEY?.trim()
  return id && key ? nearAccount(id, key) : null
}

/** The first failure message in an outcome, e.g. the guard's own panic text. */
export function failureOf(outcome: Outcome): string | null {
  const statuses = [outcome.status, ...(outcome.receipts_outcome ?? []).map((r) => r.outcome.status)]
  for (const s of statuses) {
    if (s && typeof s === 'object' && 'Failure' in s) {
      const text = JSON.stringify(s.Failure)
      const panic = /"ExecutionError":"([^"]+)"/.exec(text)?.[1]
      return (panic ?? text).replace(/^Smart contract panicked: /, '')
    }
  }
  return null
}

export type CallResult<T> = { value: T; txHash: string }

/**
 * Signs and sends one function call, then waits until every receipt has run.
 * Throws the contract's own message when any receipt fails.
 */
export async function callAndWait<T>(account: Account, a: { contractId: string; method: string; args: Record<string, unknown>; tgas: number; depositYocto?: bigint }, timeoutMs = 150_000): Promise<CallResult<T>> {
  const p = nearProvider()
  const signed = await account.createSignedTransaction({
    receiverId: a.contractId,
    actions: [actions.functionCall(a.method, a.args, BigInt(a.tgas) * 10n ** 12n, a.depositYocto ?? 0n)],
  })
  const txHash = bs58.encode(createHash('sha256').update(signed.transaction.encode()).digest())
  let outcome: Outcome | null = null
  try {
    outcome = await p.sendTransactionUntil(signed, 'EXECUTED_OPTIMISTIC')
  } catch (e) {
    // The RPC gives up after ~10 s; the transaction keeps going. Poll it by hash.
    if (!/timeout|timed out|TIMEOUT/i.test(String((e as Error)?.message ?? e))) throw e
  }
  const deadline = Date.now() + timeoutMs
  while (!outcome || !isDone(outcome)) {
    if (Date.now() > deadline) throw new Error(`NEAR transaction ${txHash} has not finished yet`)
    await new Promise((r) => setTimeout(r, 2500))
    try {
      outcome = await p.viewTransactionStatus({ txHash, accountId: account.accountId, waitUntil: 'EXECUTED_OPTIMISTIC' })
    } catch {
      // not visible yet
    }
  }
  const failed = failureOf(outcome)
  if (failed) throw Object.assign(new Error(failed), { txHash })
  return { value: getTransactionLastResult(outcome) as T, txHash }
}

function isDone(o: Outcome) {
  const s = o.status as unknown
  return Boolean(s && typeof s === 'object' && ('SuccessValue' in (s as object) || 'Failure' in (s as object)))
}
