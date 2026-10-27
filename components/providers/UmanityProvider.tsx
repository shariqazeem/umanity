'use client'

/**
 * App-wide session: the active signer (wallet-adapter wallet OR instant demo
 * wallet), the resolved profile, SOL price, and refresh helpers.
 * Profiles are resolved silently — no blocking onboarding anywhere.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { loadDemoWallet, createDemoWallet, clearDemoWallet, type DemoWallet } from '@/lib/client/demo-wallet'
import { apiGet, apiSend } from '@/lib/client/api'
import type { PublicUser } from '@/lib/data/users'

export interface Signer {
  publicKey: PublicKey
  kind: 'wallet' | 'demo'
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signMessage?(m: Uint8Array): Promise<Uint8Array>
}

interface Ctx {
  signer: Signer | null
  address: string | null
  user: PublicUser | null
  profileLoading: boolean
  balance: number | null
  solPrice: number | null
  demo: DemoWallet | null
  startDemo: () => Promise<{ funded: boolean; error?: string }>
  stopDemo: () => void
  refreshUser: () => Promise<void>
  refreshBalance: () => Promise<void>
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void
  toasts: { id: number; msg: string; kind: 'ok' | 'err' | 'info' }[]
}

const UmanityContext = createContext<Ctx | null>(null)

export function useUmanity() {
  const ctx = useContext(UmanityContext)
  if (!ctx) throw new Error('useUmanity outside provider')
  return ctx
}

export function UmanityProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  const { connection } = useConnection()
  const [demo, setDemo] = useState<DemoWallet | null>(null)
  const [user, setUser] = useState<PublicUser | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Ctx['toasts']>([])
  const toastId = useRef(0)

  useEffect(() => {
    setDemo(loadDemoWallet())
  }, [])

  // Price (best effort, cached 5 min)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { cache: 'no-store' })
        const j = (await r.json()) as { solana?: { usd?: number } }
        if (!cancelled && j.solana?.usd) setSolPrice(j.solana.usd)
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

  const signer: Signer | null = useMemo(() => {
    if (wallet.publicKey && wallet.signTransaction) {
      return { publicKey: wallet.publicKey, kind: 'wallet', signTransaction: wallet.signTransaction, signMessage: wallet.signMessage }
    }
    if (demo) return { publicKey: demo.publicKey, kind: 'demo', signTransaction: demo.signTransaction, signMessage: demo.signMessage }
    return null
  }, [wallet.publicKey, wallet.signTransaction, wallet.signMessage, demo])

  const address = signer?.publicKey.toBase58() ?? null

  const refreshUser = useCallback(async () => {
    if (!address) {
      setUser(null)
      return
    }
    setProfileLoading(true)
    try {
      const r = await apiSend<{ user?: PublicUser }>('/api/profile/resolve', { address })
      if (r.user) setUser(r.user)
    } catch {
      /* keep previous */
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

  const toast = useCallback((msg: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  const startDemo = useCallback(async () => {
    const w = loadDemoWallet() ?? createDemoWallet()
    setDemo(w)
    try {
      const r = await apiSend<{ success: boolean; funded?: boolean; error?: string; user?: PublicUser }>('/api/demo-wallet/fund', { address: w.publicKey.toBase58() })
      if (r.user) setUser(r.user)
      setTimeout(refreshBalance, 1500)
      return { funded: !!r.funded, error: r.success ? undefined : r.error }
    } catch (e) {
      return { funded: false, error: e instanceof Error ? e.message : 'Funding failed' }
    }
  }, [refreshBalance])

  const stopDemo = useCallback(() => {
    clearDemoWallet()
    setDemo(null)
    setUser(null)
    setBalance(null)
  }, [])

  const value: Ctx = { signer, address, user, profileLoading, balance, solPrice, demo, startDemo, stopDemo, refreshUser, refreshBalance, toast, toasts }
  return <UmanityContext.Provider value={value}>{children}</UmanityContext.Provider>
}

export { apiGet }
