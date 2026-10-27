'use client'

/**
 * App-wide session: the active signer (a connected wallet or the Umanity
 * wallet kept in the browser), the resolved profile, balance and SOL price,
 * plus the global sheets (give, sign-in, profile editor) any screen can open.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PublicKey, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { loadLocalWallet, createLocalWallet, importLocalWallet, forgetLocalWallet, type LocalWallet } from '@/lib/client/wallet'
import { apiSend } from '@/lib/client/api'
import { flushPendingGifts, pendingGiftCount } from '@/lib/client/pending-sync'
import { IS_MAINNET, SOLANA_CLUSTER } from '@/lib/solana/constants'
import type { PublicUser } from '@/lib/data/users'

export interface Signer {
  publicKey: PublicKey
  kind: 'wallet' | 'local'
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signMessage?(m: Uint8Array): Promise<Uint8Array>
}

export interface GiveRequest {
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

interface Ctx {
  signer: Signer | null
  address: string | null
  user: PublicUser | null
  profileLoading: boolean
  balance: number | null
  solPrice: number | null
  network: 'devnet' | 'mainnet-beta'
  isMainnet: boolean
  local: LocalWallet | null
  createWallet: () => Promise<{ ok: boolean; funded: boolean; error?: string }>
  importWallet: (secret: string) => { ok: boolean; error?: string }
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
  const [local, setLocal] = useState<LocalWallet | null>(null)
  const [user, setUser] = useState<PublicUser | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [give, setGive] = useState<GiveRequest | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const toastId = useRef(0)

  useEffect(() => {
    setLocal(loadLocalWallet())
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
      return
    }
    try {
      const l = await connection.getBalance(signer.publicKey, 'confirmed')
      setBalance(l / LAMPORTS_PER_SOL)
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

  // Replay gift records that failed after the transaction confirmed.
  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!pendingGiftCount()) return
      const n = await flushPendingGifts()
      if (alive && n > 0) {
        toast(n === 1 ? 'Your earlier gift is now recorded.' : `${n} earlier gifts are now recorded.`, 'ok')
        refreshUser()
      }
    }
    run()
    const t = setInterval(run, 45_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [toast, refreshUser])

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

  const createWallet = useCallback(async () => {
    const w = loadLocalWallet() ?? createLocalWallet()
    setLocal(w)
    try {
      localStorage.setItem('umanity.entered', '1')
    } catch {
      /* ignore */
    }
    if (IS_MAINNET) return { ok: true, funded: false }
    // On devnet the treasury tops the new wallet up so the first gift is one tap away.
    try {
      const r = await apiSend<{ success: boolean; funded?: boolean; error?: string; user?: PublicUser }>('/api/wallet/faucet', { address: w.publicKey.toBase58() })
      if (r.user) setUser(r.user)
      setTimeout(refreshBalance, 1500)
      return { ok: true, funded: !!r.funded, error: r.success ? undefined : r.error }
    } catch (e) {
      return { ok: true, funded: false, error: e instanceof Error ? e.message : 'Funding failed' }
    }
  }, [refreshBalance])

  const importWallet = useCallback((secret: string) => {
    try {
      setLocal(importLocalWallet(secret))
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Invalid key' }
    }
  }, [])

  const forgetWallet = useCallback(() => {
    forgetLocalWallet()
    setLocal(null)
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
    solPrice,
    network: SOLANA_CLUSTER,
    isMainnet: IS_MAINNET,
    local,
    createWallet,
    importWallet,
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
