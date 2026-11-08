'use client'

/**
 * The Umanity wallet: a self-custodial Solana keypair made in the browser.
 *
 * Its secret key is never stored in plain text. It is sealed with AES-256-GCM
 * under a key that comes either from a passkey (Face ID, Touch ID, Windows
 * Hello or a phone) through the WebAuthn PRF extension, or from a passcode of
 * at least 8 characters (PBKDF2, 600k rounds) where passkeys can't do that.
 * Only the address is readable while the wallet is locked. The key is unsealed
 * in memory to sign, and dropped after 15 idle minutes or a reload. It can be
 * backed up and imported into Phantom, Solflare or Backpack at any time.
 */
import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'

const VAULT_KEY = 'umanity.wallet.v2'
const LEGACY_KEYS = ['umanity.wallet.v1', 'umanity.demoWallet.v1']
const IDLE_MS = 15 * 60_000
const PBKDF2_ROUNDS = 600_000
export const MIN_PASSCODE = 8

export type WalletMethod = 'passkey' | 'passcode' | 'unprotected'

/** What is stored: the address in the clear, the secret key sealed. */
export type Vault = {
  v: 2
  address: string
  method: 'passkey' | 'passcode'
  /** PRF input (passkey) or PBKDF2 salt (passcode), base64url. */
  salt: string
  iv: string
  ct: string
  credentialId?: string
  rounds?: number
  createdAt: number
}

export interface UmanityWallet {
  publicKey: PublicKey
  method: WalletMethod
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

/** The device can't derive a key from this passkey; use a passcode instead. */
export class PasskeyUnavailable extends Error {
  constructor() {
    super("This device can't lock a wallet with a passkey. Use a passcode instead.")
  }
}

// ---------- bytes ----------

const enc = new TextEncoder()
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))
/** Every array here is backed by a plain ArrayBuffer; this tells WebCrypto's types so. */
const B = (u: Uint8Array) => u as unknown as BufferSource
export const toB64 = (u: Uint8Array) => btoa(Array.from(u, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const fromB64 = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

// ---------- sealing ----------

export async function keyFromPrf(prf: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', B(prf), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: B(new Uint8Array(32)), info: B(enc.encode('umanity-wallet-v2')) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function keyFromPasscode(passcode: string, salt: Uint8Array, rounds: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', B(enc.encode(passcode.normalize('NFKC'))), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: B(salt), iterations: rounds }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** AES-GCM with the address as associated data, so a vault can't be swapped onto another address. */
export async function seal(key: CryptoKey, secret: Uint8Array, address: string) {
  const iv = random(12)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: B(iv), additionalData: B(enc.encode(address)) }, key, B(secret)))
  return { iv: toB64(iv), ct: toB64(ct) }
}

export async function unseal(key: CryptoKey, vault: Pick<Vault, 'iv' | 'ct' | 'address'>): Promise<Keypair> {
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: B(fromB64(vault.iv)), additionalData: B(enc.encode(vault.address)) }, key, B(fromB64(vault.ct))))
  try {
    // Keypair keeps the array it's given, so it gets its own copy and the decrypted buffer is wiped.
    const kp = Keypair.fromSecretKey(new Uint8Array(plain))
    if (kp.publicKey.toBase58() !== vault.address) throw new Error('This wallet could not be opened')
    return kp
  } finally {
    plain.fill(0)
  }
}

// ---------- passkeys ----------

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } }
const prfInput = (salt: Uint8Array) => ({ prf: { eval: { first: B(salt) } } }) as AuthenticationExtensionsClientInputs

function prfOutput(cred: PublicKeyCredential): Uint8Array | null {
  const first = (cred.getClientExtensionResults() as PrfResults).prf?.results?.first
  return first ? new Uint8Array(first) : null
}

/** True when this browser can lock a wallet with a passkey (platform or phone, with PRF). */
export async function passkeysAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !window.isSecureContext) return false
    const caps = await (PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> }).getClientCapabilities?.()
    if (caps) return !!caps['extension:prf'] && !!(caps.passkeyPlatformAuthenticator || caps.userVerifyingPlatformAuthenticator || caps.hybridTransport)
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

async function passkeyPrf(credentialId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: B(random(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: B(credentialId) }],
      userVerification: 'required',
      timeout: 120_000,
      extensions: prfInput(salt),
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new DOMException('Cancelled', 'NotAllowedError')
  const out = prfOutput(cred)
  if (!out) throw new PasskeyUnavailable()
  return out
}

async function sealWithPasskey(kp: Keypair): Promise<Vault> {
  const address = kp.publicKey.toBase58()
  const salt = random(32)
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Umanity', id: location.hostname },
      user: { id: B(random(16)), name: `Umanity wallet ${address.slice(0, 4)}…${address.slice(-4)}`, displayName: 'Umanity wallet' },
      challenge: B(random(32)),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 120_000,
      extensions: prfInput(salt),
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new DOMException('Cancelled', 'NotAllowedError')
  const credentialId = new Uint8Array(cred.rawId)
  // Some authenticators hand back the PRF output when the passkey is made; others only say it works.
  let prf = prfOutput(cred)
  if (!prf) {
    if ((cred.getClientExtensionResults() as PrfResults).prf?.enabled === false) throw new PasskeyUnavailable()
    prf = await passkeyPrf(credentialId, salt)
  }
  try {
    const sealed = await seal(await keyFromPrf(prf), kp.secretKey, address)
    return { v: 2, address, method: 'passkey', salt: toB64(salt), credentialId: toB64(credentialId), createdAt: Date.now(), ...sealed }
  } finally {
    prf.fill(0)
  }
}

async function sealWithPasscode(kp: Keypair, passcode: string): Promise<Vault> {
  if (passcode.length < MIN_PASSCODE) throw new Error(`Use at least ${MIN_PASSCODE} characters`)
  const address = kp.publicKey.toBase58()
  const salt = random(16)
  const sealed = await seal(await keyFromPasscode(passcode, salt, PBKDF2_ROUNDS), kp.secretKey, address)
  return { v: 2, address, method: 'passcode', salt: toB64(salt), rounds: PBKDF2_ROUNDS, createdAt: Date.now(), ...sealed }
}

// ---------- storage ----------

function readVault(): Vault | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Vault
    return v?.v === 2 && v.address && v.ct ? v : null
  } catch {
    return null
  }
}

function readLegacy(): Keypair | null {
  try {
    for (const k of LEGACY_KEYS) {
      const raw = localStorage.getItem(k)
      if (raw) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
    }
  } catch {
    /* unreadable: treat as absent */
  }
  return null
}

function storeVault(vault: Vault) {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault))
  } catch {
    throw new Error("This browser won't keep a wallet (private browsing?). Connect Phantom or another wallet instead.")
  }
  for (const k of LEGACY_KEYS) localStorage.removeItem(k)
}

// ---------- the session ----------

let session: { kp: Keypair; until: number } | null = null
let unlocker: (() => Promise<boolean>) | null = null

function remember(kp: Keypair, forever = false) {
  session = { kp, until: forever ? Number.POSITIVE_INFINITY : Date.now() + IDLE_MS }
}

function unlockedKeypair(): Keypair | null {
  if (!session) return null
  if (Date.now() > session.until) {
    session = null
    return null
  }
  if (Number.isFinite(session.until)) session.until = Date.now() + IDLE_MS
  return session.kp
}

/** The provider registers how to ask for Face ID or the passcode when a signature needs it. */
export function setUnlocker(fn: (() => Promise<boolean>) | null) {
  unlocker = fn
}

export function isUnlocked() {
  return !!session && Date.now() <= session.until
}

export function lockWallet() {
  session = null
}

async function keypairToSign(): Promise<Keypair> {
  let kp = unlockedKeypair()
  if (!kp && unlocker && (await unlocker())) kp = unlockedKeypair()
  if (!kp) throw new Error('Unlock your wallet to continue')
  return kp
}

function walletFor(publicKey: PublicKey, method: WalletMethod): UmanityWallet {
  const signOne = <T extends Transaction | VersionedTransaction>(tx: T, kp: Keypair) => {
    if (tx instanceof VersionedTransaction) tx.sign([kp])
    else tx.partialSign(kp)
    return tx
  }
  return {
    publicKey,
    method,
    async signTransaction(tx) {
      return signOne(tx, await keypairToSign())
    },
    async signAllTransactions(txs) {
      const kp = await keypairToSign()
      return txs.map((tx) => signOne(tx, kp))
    },
    async signMessage(message) {
      const kp = await keypairToSign()
      const nacl = await import('tweetnacl')
      return nacl.sign.detached(message, kp.secretKey)
    },
  }
}

// ---------- what the app calls ----------

/** The wallet kept in this browser, if any. A sealed wallet starts locked; an old unsealed one asks to be protected. */
export function loadWallet(): { wallet: UmanityWallet; vault: Vault | null } | null {
  if (typeof window === 'undefined') return null
  const vault = readVault()
  if (vault) return { wallet: walletFor(new PublicKey(vault.address), vault.method), vault }
  const legacy = readLegacy()
  if (legacy) {
    remember(legacy, true)
    return { wallet: walletFor(legacy.publicKey, 'unprotected'), vault: null }
  }
  return null
}

export function newKeypair() {
  return Keypair.generate()
}

/** Accepts a base58 secret key (Phantom export) or a JSON byte array (Solana CLI). */
export function keypairFromSecret(secret: string): Keypair {
  const s = secret.trim()
  const bytes = s.startsWith('[') ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s)
  if (bytes.length !== 64) throw new Error('That does not look like a Solana secret key')
  return Keypair.fromSecretKey(bytes)
}

/** The keypair of an old unsealed wallet, so it can be sealed. */
export function unprotectedKeypair(): Keypair | null {
  return session && !Number.isFinite(session.until) ? session.kp : null
}

/** Seals a keypair with a passkey or a passcode, stores it, and keeps it unlocked for this session. */
export async function protectWallet(kp: Keypair, how: { passkey: true } | { passcode: string }): Promise<{ wallet: UmanityWallet; vault: Vault }> {
  const vault = 'passkey' in how ? await sealWithPasskey(kp) : await sealWithPasscode(kp, how.passcode)
  storeVault(vault)
  remember(kp)
  return { wallet: walletFor(kp.publicKey, vault.method), vault }
}

export async function unlockWithPasskey(vault: Vault) {
  if (vault.method !== 'passkey' || !vault.credentialId) throw new Error('This wallet uses a passcode')
  const prf = await passkeyPrf(fromB64(vault.credentialId), fromB64(vault.salt))
  try {
    remember(await unseal(await keyFromPrf(prf), vault))
  } finally {
    prf.fill(0)
  }
}

export async function unlockWithPasscode(vault: Vault, passcode: string) {
  const key = await keyFromPasscode(passcode, fromB64(vault.salt), vault.rounds ?? PBKDF2_ROUNDS)
  try {
    remember(await unseal(key, vault))
  } catch {
    throw new Error("That passcode isn't right")
  }
}

/** The secret key for a backup. Asks to unlock first if needed. */
export async function revealSecret(): Promise<string> {
  return bs58.encode((await keypairToSign()).secretKey)
}

export function forgetWallet() {
  session = null
  try {
    localStorage.removeItem(VAULT_KEY)
    for (const k of LEGACY_KEYS) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
