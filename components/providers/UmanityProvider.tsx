'use client'

/**
 * App-wide session: the active signer (a connected wallet or the Umanity
 * wallet kept in the browser, sealed with a passkey or a passcode), the
 * resolved profile, balance and SOL price, plus the global sheets (give,
 * sign-in, unlock, profile editor) any screen can open.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PublicKey, Transaction, VersionedTransaction, LAMPORTS_PER_SOL, type Keypair } from '@solana/web3.js'
import {
  forgetWallet as forgetStoredWallet,
  isUnlocked,
  keypairFromSecret,
  loadWallet,
  lockWallet,
  newKeypair,
  passkeysAvailable,
  protectWallet,
  revealSecret,
  setUnlocker,
  unlockWithPasskey,
  unprotectedKeypair,
  type UmanityWallet,
  type Vault,
  type WalletMethod,
} from '@/lib/client/wallet'
import { apiSend } from '@/lib/client/api'
import { usdcAccount } from '@/lib/umanity/usdc'
import { IS_MAINNET, SOLANA_CLUSTER } from '@/lib/solana/constants'
import type { PublicUser } from '@/lib/data/users'

export interface Signer {
  publicKey: PublicKey
  kind: 'wallet' | 'local'
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signMessage?(m: Uint8Array): Promise<Uint8Array>
}

export interface GiveRequest {
  /** A drop (program v3). When set, the drop give sheet opens instead of the cause flow. */
  dropId?: number
  causeId?: string
  /** Pre-fill an amount in USD (presets are USD-first). */
  amountUsd?: number
  /** Pre-fill an amount in SOL (used by "match" buttons). */
  amountSol?: number
  /** A dare being accepted by this gift. */
  dareId?: string
  /** 'solana' | 'anychain' */
  method?: 'solana' | 'anychain'
}

export type Toast = { id: number; msg: string; kind: 'ok' | 'err' | 'info'; action?: { label: string; href: string } }

/** How the wallet is being protected: Face ID or another passkey, or a passcode. */
export type Protect = { passkey: true } | { passcode: string }

/** What the unlock sheet is asking for. */
export type UnlockPrompt = { mode: 'unlock'; vault: Vault; reason: string } | { mode: 'protect'; reason: string }

interface Ctx {
  signer: Signer | null
  address: string | null
  user: PublicUser | null
  profileLoading: boolean
  balance: number | null
  /** USDC in the wallet, in dollars: what people give with (Umanity pays the SOL fees). */
  usdc: number | null
  solPrice: number | null
  network: 'devnet' | 'mainnet-beta'
  isMainnet: boolean
  local: UmanityWallet | null
  /** passkey | passcode | unprotected (an old wallet that still needs locking) */
  walletMethod: WalletMethod | null
  walletLocked: boolean
  /** Whether this browser can lock a wallet with a passkey; null until known. */
  canUsePasskeys: boolean | null
  /** Address of a wallet made or imported but not locked yet. */
  pendingWallet: string | null
  startNewWallet: () => string
  startImport: (secret: string) => { ok: boolean; error?: string }
  /** Locks the pending wallet (or an old unprotected one) and makes it the active wallet. */
  protectWallet: (how: Protect) => Promise<{ ok: boolean; error?: string }>
  /** Resolves true once the wallet can sign: unlocked, locked-in, or an external wallet. */
  ensureUnlocked: (reason?: string) => Promise<boolean>
  lockNow: () => void
  revealSecretKey: () => Promise<string | null>
  unlockPrompt: UnlockPrompt | null
  answerUnlock: (ok: boolean) => void
  forgetWallet: () => void
  connectWallet: () => void
  disconnectWallet: () => Promise<void>
  requestFaucet: () => Promise<{ ok: boolean; funded: boolean; error?: string }>
  refreshUser: () => Promise<void>
  refreshBalance: () => Promise<void>
  toast: (msg: string, kind?: Toast['kind'], action?: Toast['action']) => void
  toasts: Toast[]
  // sheets
  give: GiveRequest | null
  openGive: (req?: GiveRequest) => void
  closeGive: () => void
  authOpen: boolean
  openAuth: () => void
  closeAuth: () => void
  /** Returns the signer, or opens the sign-in sheet and returns null. */
  ensureSigner: () => Signer | null
  profileEditorOpen: boolean
  openProfileEditor: () => void
  closeProfileEditor: () => void
  walletSheetOpen: boolean
  openWalletSheet: () => void
  closeWalletSheet: () => void
}

const UmanityContext = createContext<Ctx | null>(null)

export function useUmanity() {
  const ctx = useContext(UmanityContext)
  if (!ctx) throw new Error('useUmanity outside provider')
  return ctx
}

export function UmanityProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  const walletModal = useWalletModal()
  const { connection } = useConnection()
  const [local, setLocal] = useState<UmanityWallet | null>(null)
  const [vault, setVault] = useState<Vault | null>(null)
  const [pendingWallet, setPendingWallet] = useState<string | null>(null)
  const pending = useRef<Keypair | null>(null)
  const [canUsePasskeys, setCanUsePasskeys] = useState<boolean | null>(null)
  const [unlockPrompt, setUnlockPrompt] = useState<UnlockPrompt | null>(null)
  const unlockWaiter = useRef<((ok: boolean) => void) | null>(null)
  const [, setLockTick] = useState(0)
  const [user, setUser] = useState<PublicUser | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [usdc, setUsdc] = useState<number | null>(null)
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [give, setGive] = useState<GiveRequest | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const toastId = useRef(0)

  useEffect(() => {
    const found = loadWallet()
    setLocal(found?.wallet ?? null)
    setVault(found?.vault ?? null)
    passkeysAvailable().then(setCanUsePasskeys)
  }, [])

  // SOL price, best effort, refreshed every 5 minutes.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/price', { cache: 'no-store' })
        const j = (await r.json()) as { usd?: number }
        if (!cancelled && j.usd) setSolPrice(j.usd)
      } catch {
        /* ignore */
      }
    }
    load()
    const t = setInterval(load, 300_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // A connected wallet takes precedence over the browser wallet.
  const signer: Signer | null = useMemo(() => {
    if (wallet.publicKey && wallet.signTransaction) {
      return { publicKey: wallet.publicKey, kind: 'wallet', signTransaction: wallet.signTransaction, signMessage: wallet.signMessage }
    }
    if (local) return { publicKey: local.publicKey, kind: 'local', signTransaction: local.signTransaction, signMessage: local.signMessage }
    return null
  }, [wallet.publicKey, wallet.signTransaction, wallet.signMessage, local])

  const address = signer?.publicKey.toBase58() ?? null

  const refreshUser = useCallback(async () => {
    if (!address) {
      setUser(null)
      return
    }
    setProfileLoading(true)
    try {
      const ref = typeof window !== 'undefined' ? localStorage.getItem('umanity.ref') : null
      // A cold server (deploy, restart) can take a moment; a profile must never stay unresolved.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await apiSend<{ user?: PublicUser }>('/api/profile/resolve', { address, referredBy: ref || undefined })
          if (r.user) {
            setUser(r.user)
            break
          }
        } catch {
          await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)))
        }
      }
    } finally {
      setProfileLoading(false)
    }
  }, [address])

  const refreshBalance = useCallback(async () => {
    if (!signer) {
      setBalance(null)
      setUsdc(null)
      return
    }
    try {
      const [l, t] = await Promise.all([
        connection.getBalance(signer.publicKey, 'confirmed'),
        connection.getTokenAccountBalance(usdcAccount(signer.publicKey), 'confirmed').catch(() => null),
      ])
      setBalance(l / LAMPORTS_PER_SOL)
      setUsdc(t ? Number(t.value.amount) / 1e6 : 0)
    } catch {
      /* ignore */
    }
  }, [signer, connection])

  useEffect(() => {
    refreshUser()
    refreshBalance()
  }, [refreshUser, refreshBalance])

  // Keep the balance fresh while the tab is visible.
  useEffect(() => {
    if (!signer) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refreshBalance()
    }, 20_000)
    return () => clearInterval(t)
  }, [signer, refreshBalance])

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'info', action?: Toast['action']) => {
    const id = ++toastId.current
    const text = msg.length > 180 ? `${msg.slice(0, 177)}…` : msg
    setToasts((t) => [...t, { id, msg: text, kind, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 4500)
  }, [])

  const requestFaucet = useCallback(async () => {
    if (IS_MAINNET || !signer) return { ok: false, funded: false, error: IS_MAINNET ? 'Not available on mainnet' : 'No wallet' }
    try {
      const r = await apiSend<{ success: boolean; funded?: boolean; error?: string; user?: PublicUser }>('/api/wallet/faucet', { address: signer.publicKey.toBase58() })
      if (r.user) setUser(r.user)
      setTimeout(refreshBalance, 1500)
      return { ok: r.success, funded: !!r.funded, error: r.success ? undefined : r.error }
    } catch (e) {
      return { ok: false, funded: false, error: e instanceof Error ? e.message : 'Faucet failed' }
    }
  }, [signer, refreshBalance])

  /** A fresh keypair, held in memory until it is locked with a passkey or passcode. */
  const startNewWallet = useCallback(() => {
    const kp = newKeypair()
    pending.current = kp
    setPendingWallet(kp.publicKey.toBase58())
    return kp.publicKey.toBase58()
  }, [])

  const startImport = useCallback((secret: string) => {
    try {
      const kp = keypairFromSecret(secret)
      pending.current = kp
      setPendingWallet(kp.publicKey.toBase58())
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Invalid key' }
    }
  }, [])

  const protect = useCallback(async (how: Protect) => {
    const kp = pending.current ?? unprotectedKeypair()
    if (!kp) return { ok: false, error: 'There is no wallet to lock' }
    try {
      const r = await protectWallet(kp, how)
      pending.current = null
      setPendingWallet(null)
      setVault(r.vault)
      setLocal(r.wallet)
      setLockTick((t) => t + 1)
      try {
        localStorage.setItem('umanity.entered', '1')
      } catch {
        /* ignore */
      }
      // Devnet only: the treasury tops a new wallet up so trying the app is one tap.
      if (!IS_MAINNET) apiSend('/api/wallet/faucet', { address: kp.publicKey.toBase58() }).then(() => setTimeout(refreshBalance, 1500)).catch(() => null)
      return { ok: true }
    } catch (e) {
      const err = e as Error & { name?: string }
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return { ok: false, error: 'Cancelled' }
      return { ok: false, error: err?.message || 'Could not lock the wallet' }
    }
  }, [refreshBalance])

  /** Opens the unlock sheet and waits for the person to unlock (true) or cancel (false). */
  const askUnlock = useCallback((prompt: UnlockPrompt) => {
    unlockWaiter.current?.(false)
    setUnlockPrompt(prompt)
    return new Promise<boolean>((resolve) => {
      unlockWaiter.current = resolve
    })
  }, [])

  const answerUnlock = useCallback((ok: boolean) => {
    setUnlockPrompt(null)
    setLockTick((t) => t + 1)
    unlockWaiter.current?.(ok)
    unlockWaiter.current = null
  }, [])

  const ensureUnlocked = useCallback(
    async (reason = 'Unlock your wallet to continue') => {
      // Connected wallets (Phantom and friends) ask for themselves.
      if (wallet.publicKey && wallet.signTransaction) return true
      if (!local) return false
      if (local.method === 'unprotected') return askUnlock({ mode: 'protect', reason: 'Lock your wallet before it holds real money' })
      if (isUnlocked()) return true
      if (!vault) return false
      if (vault.method === 'passkey') {
        // Straight to Face ID while the tap that started this still counts; the sheet is the fallback.
        try {
          await unlockWithPasskey(vault)
          setLockTick((t) => t + 1)
          return true
        } catch {
          return askUnlock({ mode: 'unlock', vault, reason })
        }
      }
      return askUnlock({ mode: 'unlock', vault, reason })
    },
    [wallet.publicKey, wallet.signTransaction, local, vault, askUnlock],
  )

  // A signature that finds the wallet locked (it idled out mid-flow) asks the same way.
  useEffect(() => {
    setUnlocker(() => ensureUnlocked())
    return () => setUnlocker(null)
  }, [ensureUnlocked])

  const lockNow = useCallback(() => {
    lockWallet()
    setLockTick((t) => t + 1)
  }, [])

  const revealSecretKey = useCallback(async () => {
    if (!(await ensureUnlocked('Unlock to see your secret key'))) return null
    try {
      return await revealSecret()
    } catch {
      return null
    }
  }, [ensureUnlocked])

  const forgetWallet = useCallback(() => {
    forgetStoredWallet()
    pending.current = null
    setPendingWallet(null)
    setLocal(null)
    setVault(null)
    setUser(null)
    setBalance(null)
  }, [])

  const connectWallet = useCallback(() => walletModal.setVisible(true), [walletModal])
  const disconnectWallet = useCallback(async () => {
    try {
      await wallet.disconnect()
    } catch {
      /* ignore */
    }
  }, [wallet])

  const openGive = useCallback((req?: GiveRequest) => setGive(req ?? {}), [])
  const closeGive = useCallback(() => setGive(null), [])
  const openAuth = useCallback(() => setAuthOpen(true), [])
  const closeAuth = useCallback(() => setAuthOpen(false), [])
  const ensureSigner = useCallback(() => {
    if (signer) return signer
    setAuthOpen(true)
    return null
  }, [signer])
  const openProfileEditor = useCallback(() => setProfileEditorOpen(true), [])
  const closeProfileEditor = useCallback(() => setProfileEditorOpen(false), [])
  const [walletSheetOpen, setWalletSheetOpen] = useState(false)
  const openWalletSheet = useCallback(() => setWalletSheetOpen(true), [])
  const closeWalletSheet = useCallback(() => setWalletSheetOpen(false), [])

  // Remember a referral code from ?ref= so the profile can credit it.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) localStorage.setItem('umanity.ref', ref.toLowerCase())
    } catch {
      /* ignore */
    }
  }, [])

  const value: Ctx = {
    signer,
    address,
    user,
    profileLoading,
    balance,
    usdc,
    solPrice,
    network: SOLANA_CLUSTER,
    isMainnet: IS_MAINNET,
    local,
    walletMethod: local?.method ?? null,
    walletLocked: !!local && local.method !== 'unprotected' && !isUnlocked(),
    canUsePasskeys,
    pendingWallet,
    startNewWallet,
    startImport,
    protectWallet: protect,
    ensureUnlocked,
    lockNow,
    revealSecretKey,
    unlockPrompt,
    answerUnlock,
    forgetWallet,
    connectWallet,
    disconnectWallet,
    requestFaucet,
    refreshUser,
    refreshBalance,
    toast,
    toasts,
    give,
    openGive,
    closeGive,
    authOpen,
    openAuth,
    closeAuth,
    ensureSigner,
    profileEditorOpen,
    openProfileEditor,
    closeProfileEditor,
    walletSheetOpen,
    openWalletSheet,
    closeWalletSheet,
  }
  return <UmanityContext.Provider value={value}>{children}</UmanityContext.Provider>
}
