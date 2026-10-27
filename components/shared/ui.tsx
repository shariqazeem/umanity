'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { explorerTx, explorerAccount } from '@/lib/solana/constants'

export function Pill({ children, tone = 'gray', className = '' }: { children: ReactNode; tone?: 'gray' | 'emerald' | 'coral' | 'indigo' | 'amber' | 'shield' | 'dark'; className?: string }) {
  const tones: Record<string, string> = {
    gray: 'bg-[#F3F3F1] text-[#52525B]',
    emerald: 'bg-emerald-50 text-emerald-700',
    coral: 'bg-[#FFF1ED] text-[#D9431F]',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
    shield: 'bg-[#0F172A] text-[#38BDF8]',
    dark: 'bg-[#111113] text-white',
  }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${tones[tone]} ${className}`}>{children}</span>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'ghost' | 'emerald' | 'coral' | 'outline'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }
export function Btn({ tone = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  const tones: Record<string, string> = {
    primary: 'bg-[#111113] text-white hover:bg-black shadow-sm',
    secondary: 'bg-[#F3F3F1] text-[#111113] hover:bg-[#EAEAE6]',
    ghost: 'bg-transparent text-[#52525B] hover:bg-black/[0.04] hover:text-[#111113]',
    emerald: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    coral: 'bg-[#FF5A36] text-white hover:bg-[#E84E2C] shadow-sm',
    outline: 'bg-white border border-[#ECECED] text-[#111113] hover:border-[#111113]',
  }
  const sizes: Record<string, string> = { sm: 'h-8 px-3 text-[12px] rounded-lg', md: 'h-10 px-4 text-[13px] rounded-xl', lg: 'h-12 px-6 text-[14px] rounded-xl' }
  return (
    <button disabled={disabled || loading} className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${tones[tone]} ${sizes[size]} ${className}`} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin ${className}`} />
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white border border-[#ECECED] rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${onClick ? 'cursor-pointer hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{children}</span>
}

export function Modal({ open, onClose, children, width = 'max-w-md' }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!mounted || !open) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-5">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} />
      <div className={`relative bg-white rounded-t-[24px] sm:rounded-[24px] w-full ${width} max-h-[92vh] overflow-y-auto shadow-2xl animate-in`}>{children}</div>
    </div>,
    document.body
  )
}

export function TxLink({ sig, label = 'Solscan', cluster }: { sig: string; label?: string; cluster?: string }) {
  if (!sig || sig.startsWith('offchain') || sig.startsWith('intent_')) return null
  return (
    <a href={explorerTx(sig, cluster)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline">
      {label} <span aria-hidden>↗</span>
    </a>
  )
}

export function AccountLink({ address, label, cluster }: { address: string; label?: string; cluster?: string }) {
  return (
    <a href={explorerAccount(address, cluster)} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-[#52525B] hover:text-[#111113] hover:underline">
      {label ?? `${address.slice(0, 4)}…${address.slice(-4)}`}
    </a>
  )
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#111113]">{title}</h2>
        {sub && <p className="text-[13px] text-[#52525B] mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <Card className="p-10 text-center">
      <p className="font-semibold text-[15px] text-[#111113]">{title}</p>
      {sub && <p className="text-[13px] text-[#52525B] mt-1 max-w-sm mx-auto">{sub}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  )
}

export function Progress({ value, max, tone = 'dark', segments }: { value: number; max: number; tone?: 'dark' | 'emerald' | 'coral'; segments?: number[] }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = tone === 'emerald' ? 'bg-emerald-500' : tone === 'coral' ? 'bg-[#FF5A36]' : 'bg-[#111113]'
  return (
    <div className="relative h-2 rounded-full bg-[#F3F3F1] overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      {segments?.map((s, i) => (
        <div key={i} className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${s}%` }} />
      ))}
    </div>
  )
}

export function ChainBadge({ chain, className = '' }: { chain: string | null | undefined; className?: string }) {
  if (!chain) return null
  const label = chain.toUpperCase()
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r from-indigo-50 to-emerald-50 text-indigo-700 border border-indigo-100 ${className}`}>
      {label} <span className="text-[#52525B] font-normal">via NEAR Intents</span>
    </span>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5 group" aria-pressed={on}>
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-[#0F172A]' : 'bg-[#E5E5E3]'}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
      {label && <span className="text-[13px] font-medium text-[#111113]">{label}</span>}
    </button>
  )
}
