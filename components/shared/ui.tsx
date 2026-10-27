'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import { explorerTx, explorerAccount } from '@/lib/solana/constants'
import { GradientAvatar } from '@/components/shared/GradientAvatar'

/* ------------------------------------------------------------------ */
/* Icons: one small, consistent stroke set                              */
/* ------------------------------------------------------------------ */
const ICONS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  heart: 'M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z',
  heartFill: 'M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7s-1.5-5-4.5-5a2.5 2.5 0 0 0 0 5zM12 7s1.5-5 4.5-5a2.5 2.5 0 0 1 0 5z',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  chevronDown: 'm6 9 6 6 6-6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3m-4 4 4-4 4 4',
  flame: 'M12 22c4.4 0 7-2.9 7-6.6 0-3.1-1.9-5.6-3.6-7.6-.4 1.6-1.3 2.6-2.4 3.2 0-3.2-1.2-6.4-4-8 .2 3.3-1.4 4.9-2.9 6.6C4.7 11.2 5 13 5 15.4 5 19.1 7.6 22 12 22z',
  shield: 'M12 2 4 5.5v6C4 16.6 7.4 20.8 12 22c4.6-1.2 8-5.4 8-10.5v-6z',
  shieldCheck: 'M12 2 4 5.5v6C4 16.6 7.4 20.8 12 22c4.6-1.2 8-5.4 8-10.5v-6zM9 12l2 2 4-4',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2c3 3.3 3 16.7 0 20M12 2c-3 3.3-3 16.7 0 20',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z',
  external: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  wallet: 'M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H3zM16 14h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  spark: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  camera: 'M4 8h3l2-3h6l2 3h3v12H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8M8 16h5',
  pin: 'M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
  unlock: 'M6 11V8a6 6 0 0 1 11.5-2.4M5 11h14v10H5z',
  vote: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  users: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2',
  eyeOff: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c5 0 9 4 10 7-.4 1.1-1.1 2.2-2 3.2M6.6 6.6C4.6 8 3.4 10 3 12c1 3 5 7 9 7 1.6 0 3.1-.5 4.4-1.3',
  key: 'M14 10a4 4 0 1 1 1.2 2.8L8 20H5v-3l7.2-7.2A4 4 0 0 1 14 10z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  send: 'm3 11 18-8-8 18-2-7z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 21h16',
  menu: 'M4 7h16M4 12h16M4 17h16',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bank: 'M3 10 12 4l9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18',
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8, style }: { name: keyof typeof ICONS | string; size?: number; className?: string; strokeWidth?: number; style?: CSSProperties }) {
  const d = ICONS[name]
  if (!d) return null
  const fill = name === 'heartFill'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${className}`} style={style} aria-hidden>
      <path d={d} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  full?: boolean
  icon?: string
  iconRight?: string
}
export function Btn({ tone = 'primary', size = 'md', loading, full, icon, iconRight, className = '', children, disabled, ...rest }: BtnProps) {
  const sizes: Record<string, string> = {
    sm: 'h-8 px-3.5 text-[12.5px]',
    md: 'h-10 px-4.5 text-[13.5px]',
    lg: 'h-12 px-6 text-[15px]',
    xl: 'h-14 px-7 text-[16px]',
  }
  const iconSize = size === 'sm' ? 14 : size === 'xl' ? 20 : 16
  return (
    <button disabled={disabled || loading} className={`btn btn-${tone} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
}

export function IconBtn({ icon, label, size = 36, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: number }) {
  return (
    <button aria-label={label} title={label} className={`inline-flex items-center justify-center rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors ${className}`} style={{ width: size, height: size }} {...rest}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block w-4 h-4 border-2 border-current/25 border-t-current rounded-full animate-spin ${className}`} />
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */
export function Card({ children, className = '', onClick, as = 'div', style }: { children: ReactNode; className?: string; onClick?: () => void; as?: 'div' | 'section' | 'article'; style?: CSSProperties }) {
  const Tag = as
  return (
    <Tag onClick={onClick} style={style} className={`card ${onClick ? 'card-hover cursor-pointer' : ''} ${className}`}>
      {children}
    </Tag>
  )
}

export function Pill({ children, tone = 'gray', className = '', dot }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'dark' | 'white'; className?: string; dot?: boolean }) {
  const tones: Record<string, string> = {
    gray: 'bg-black/[0.05] text-[#6e6e73]',
    green: 'bg-[#ecfdf5] text-[#047857]',
    amber: 'bg-[#fffbeb] text-[#b45309]',
    red: 'bg-[#fff1f1] text-[#c53030]',
    blue: 'bg-[#eff6ff] text-[#1d4ed8]',
    dark: 'bg-[#1d1d1f] text-white',
    white: 'bg-white/90 text-[#1d1d1f] shadow-sm',
  }
  return (
    <span className={`pill ${tones[tone]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${tone === 'green' ? 'bg-[#10b981]' : tone === 'red' ? 'bg-[#e5484d]' : tone === 'amber' ? 'bg-[#d97706]' : 'bg-current'} ${tone === 'green' ? 'animate-pulse' : ''}`} />}
      {children}
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-black/[0.06] ${className}`} />
}

export function Progress({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`progress ${className}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ title, sub, action, icon = 'spark' }: { title: string; sub?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="w-12 h-12 rounded-full bg-black/[0.04] text-[#aeaeb2] flex items-center justify-center mx-auto mb-4">
        <Icon name={icon} size={22} />
      </div>
      <p className="font-semibold text-[15px] text-[#1d1d1f]">{title}</p>
      {sub && <p className="text-[13.5px] text-[#6e6e73] mt-1 max-w-sm mx-auto leading-relaxed">{sub}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, size = 'md', className = '' }: { label: string; value: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const v = size === 'lg' ? 'text-[32px]' : size === 'sm' ? 'text-[18px]' : 'text-[24px]'
  return (
    <div className={className}>
      <p className="eyebrow">{label}</p>
      <p className={`num font-bold text-[#1d1d1f] mt-1 leading-none ${v}`}>{value}</p>
      {sub && <p className="text-[12px] text-[#6e6e73] mt-1.5">{sub}</p>}
    </div>
  )
}

export function Field({ label, hint, children, right }: { label: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-semibold text-[#1d1d1f]">{label}</span>
        {right}
      </span>
      {children}
      {hint && <span className="block text-[11.5px] text-[#aeaeb2] mt-1.5">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={`inline-flex bg-black/[0.05] rounded-full p-1 ${className}`}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-all ${value === o.value ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5" aria-pressed={on}>
      <span className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${on ? 'bg-[#10b981]' : 'bg-black/[0.12]'}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      {label && <span className="text-[13.5px] font-medium text-[#1d1d1f]">{label}</span>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */
export function Img({ src, alt, className = '', sizes: _sizes, ...rest }: { src: string; alt: string; className?: string; sizes?: string } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  // Remote photography comes from a CDN that already serves WebP/AVIF; a plain
  // <img> keeps the build free of per-host image config.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={`img-cover ${className}`} {...rest} />
}

export function Avatar({ username, url, size = 36, className = '' }: { username: string; url?: string | null; size?: number; className?: string }) {
  if (url) {
    return (
      <span className={`inline-block rounded-full overflow-hidden flex-shrink-0 bg-black/[0.05] ${className}`} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={username} className="w-full h-full object-cover" />
      </span>
    )
  }
  const s = size <= 24 ? 'sm' : size <= 36 ? 'md' : size <= 48 ? 'lg' : 'xl'
  return <GradientAvatar username={username} size={s} className={`!rounded-full ${className}`} />
}

/* ------------------------------------------------------------------ */
/* Sheet / dialog                                                      */
/* ------------------------------------------------------------------ */
export function Sheet({ open, onClose, children, width = 'md', title, noPadding, hideClose }: { open: boolean; onClose: () => void; children: ReactNode; width?: 'sm' | 'md' | 'lg'; title?: ReactNode; noPadding?: boolean; hideClose?: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!mounted || !open) return null
  const w = width === 'sm' ? 'sm:max-w-[420px]' : width === 'lg' ? 'sm:max-w-[760px]' : 'sm:max-w-[520px]'
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 backdrop animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white w-full ${w} max-h-[94dvh] sm:max-h-[88vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] shadow-[var(--shadow-lg)] sheet-enter`}>
        <div className="sm:hidden flex justify-center pt-3">
          <span className="w-9 h-1 rounded-full bg-black/[0.12]" />
        </div>
        {(title || !hideClose) && (
          <div className={`flex items-center justify-between ${title ? 'px-6 pt-5' : 'px-4 pt-3'} ${title ? 'pb-1' : 'pb-0'}`}>
            {title ? <h3 className="text-[19px] font-bold tracking-[-0.02em]">{title}</h3> : <span />}
            {!hideClose && <IconBtn icon="x" label="Close" onClick={onClose} className="-mr-2" />}
          </div>
        )}
        <div className={noPadding ? '' : 'px-6 pb-6 pt-3'}>{children}</div>
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */
export function TxLink({ sig, label = 'View transaction', cluster, className = '' }: { sig: string | null | undefined; label?: string; cluster?: string; className?: string }) {
  if (!sig || sig.startsWith('offchain') || sig.startsWith('intent_')) return null
  return (
    <a href={explorerTx(sig, cluster)} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-[12px] font-medium text-[#047857] hover:underline ${className}`}>
      {label} <Icon name="arrowUpRight" size={12} />
    </a>
  )
}

export function AccountLink({ address, label, cluster, className = '' }: { address: string; label?: string; cluster?: string; className?: string }) {
  return (
    <a href={explorerAccount(address, cluster)} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 num text-[12px] text-[#6e6e73] hover:text-[#1d1d1f] hover:underline ${className}`}>
      {label ?? `${address.slice(0, 4)}…${address.slice(-4)}`} <Icon name="arrowUpRight" size={11} />
    </a>
  )
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`num ${className}`}>{children}</span>
}

export function SectionTitle({ title, sub, right, className = '' }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[#1d1d1f]">{title}</h2>
        {sub && <p className="text-[13.5px] text-[#6e6e73] mt-0.5">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Btn
      tone="secondary"
      size="sm"
      icon={done ? 'check' : 'copy'}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? 'Copied' : label}
    </Btn>
  )
}
