'use client'

import { useEffect, useRef, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon } from '@/components/shared/ui'
import { apiGet, apiSend, timeAgo } from '@/lib/client/api'

interface Notif {
  id: string
  type: string
  message: string
  fromUsername: string | null
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const { address } = useUmanity()
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!address) return
    let alive = true
    const load = () =>
      apiGet<{ notifications?: Notif[]; unreadCount?: number }>(`/api/social/notifications?address=${address}`)
        .then((d) => {
          if (!alive) return
          setItems(d.notifications ?? [])
          setUnread(d.unreadCount ?? 0)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [address])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!address) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      apiSend('/api/social/notifications', { address }, 'PATCH').catch(() => {})
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label="Notifications" className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] transition-colors">
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center counter">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown absolute right-0 top-full mt-2 w-[320px] max-h-[420px] overflow-y-auto bg-white rounded-2xl border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-50 animate-in">
          <div className="px-4 py-3 border-b border-black/[0.04]">
            <p className="text-[14px] font-bold">Notifications</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[#86868b]">Nothing yet. When your gift is delivered, you will hear it here first.</p>
          ) : (
            <ul className="divide-y divide-black/[0.04]">
              {items.slice(0, 30).map((n) => (
                <li key={n.id} className={`px-4 py-3 text-[13px] leading-snug ${n.read ? 'text-[#86868b]' : 'text-[#1d1d1f]'}`}>
                  <p>{n.message}</p>
                  <p className="text-[11px] text-[#aeaeb2] mt-1">{timeAgo(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
