'use client'

import { useUmanity } from '@/components/providers/UmanityProvider'

export function Toasts() {
  const { toasts } = useUmanity()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[min(92vw,420px)]">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-2xl shadow-xl text-[13px] font-medium animate-in ${t.kind === 'ok' ? 'bg-[#111113] text-white' : t.kind === 'err' ? 'bg-[#D9431F] text-white' : 'bg-white border border-[#ECECED] text-[#111113]'}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
