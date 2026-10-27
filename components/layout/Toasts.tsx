'use client'

import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon } from '@/components/shared/ui'

export function Toasts() {
  const { toasts } = useUmanity()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[min(92vw,440px)] pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-[var(--shadow-lg)] text-[13.5px] font-medium animate-in ${t.kind === 'ok' ? 'bg-[#1d1d1f] text-white' : t.kind === 'err' ? 'bg-[#e5484d] text-white' : 'bg-white border border-black/[0.06] text-[#1d1d1f]'}`}>
          {t.kind === 'ok' && <Icon name="check" size={16} className="text-[#34d399]" />}
          {t.kind === 'err' && <Icon name="info" size={16} />}
          <span className="flex-1">{t.msg}</span>
          {t.action && (
            <a href={t.action.href} target="_blank" rel="noopener noreferrer" className={`text-[12px] font-semibold underline underline-offset-2 ${t.kind === 'info' ? 'text-[#047857]' : 'text-white/90'}`}>
              {t.action.label}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
