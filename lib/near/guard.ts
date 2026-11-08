/**
 * The NEAR guard (near/guard): the contract that holds the rules for releasing
 * a Solana pot. Typed views and the bot's calls. Server-only.
 */
import { GUARD_CONTRACT } from './config'
import { botAccount, callAndWait, view } from './client'

export type GuardChecker = { model: string; system: string; params: string }

export type GuardConfig = {
  owner: string
  registrar: string | null
  council: string[]
  mpc: string
  solana_program: string
  release_path: string
  release_key: string | null
  checker: GuardChecker | null
  ai_signers: string[]
  review_ms: string
  min_review_ms: string
}

export type GuardDrop = { account: string; meta_hash: string }

export type GuardVerdict = {
  drop: string
  proof: string
  approve: boolean
  model: string
  signer: string
  request_hash: string
  response_hash: string
  reason: string
  at_ms: string
  review_ends_ms: string
  vetoed_by: string | null
  releases_signed: number
}

const id = (dropId: number) => String(dropId)

function bot() {
  const a = botAccount()
  if (!a) throw new Error('NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY are not set on this server')
  return a
}

export const guardConfig = () => view<GuardConfig>(GUARD_CONTRACT, 'get_config')
export const guardDrop = (dropId: number) => view<GuardDrop | null>(GUARD_CONTRACT, 'get_drop', { drop_id: id(dropId) })
export const guardVerdict = (dropId: number, proof: string) => view<GuardVerdict | null>(GUARD_CONTRACT, 'get_verdict', { drop_id: id(dropId), proof })
export const releaseBlocker = (dropId: number, proof: string) => view<string | null>(GUARD_CONTRACT, 'release_blocker', { drop_id: id(dropId), proof })
/** The exact request body the guard will check the TEE's signature against. */
export const checkerRequest = (dropId: number, meta: string, bundle: string) => view<string>(GUARD_CONTRACT, 'checker_request', { drop_id: id(dropId), meta, bundle })

export function registerDrop(dropId: number, account: string, metaHash: string) {
  return callAndWait<null>(bot(), { contractId: GUARD_CONTRACT, method: 'register_drop', args: { drop_id: id(dropId), account, meta_hash: metaHash }, tgas: 30, depositYocto: 0n })
}

/** Storage for one verdict costs ~0.005 NEAR; 0.02 is attached and the rest comes back. */
export function submitVerdict(a: { dropId: number; meta: string; bundle: string; response: string; signer: string; signature: string }) {
  return callAndWait<GuardVerdict>(bot(), {
    contractId: GUARD_CONTRACT,
    method: 'submit_verdict',
    args: { drop_id: id(a.dropId), meta: a.meta, bundle: a.bundle, response: a.response, signer: a.signer, signature: a.signature },
    tgas: 100,
    depositYocto: 2n * 10n ** 22n,
  })
}

/** Asks the guard to have the MPC network sign `message` (a serialized Solana message). Resolves to the signature, base58. */
export function requestRelease(dropId: number, message: Uint8Array) {
  return callAndWait<string>(bot(), {
    contractId: GUARD_CONTRACT,
    method: 'request_release',
    args: { drop_id: id(dropId), message: Buffer.from(message).toString('base64') },
    tgas: 120,
    depositYocto: 0n,
  })
}
