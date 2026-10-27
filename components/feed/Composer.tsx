'use client'

import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Btn, Icon } from '@/components/shared/ui'
import { apiSend } from '@/lib/client/api'
import type { FeedPost } from '@/lib/data/social'

export function Composer({ onPosted, onDare }: { onPosted: (post: FeedPost) => void; onDare: () => void }) {
  const { user, address, ensureSigner, toast } = useUmanity()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const focus = () => {
    if (!ensureSigner()) return
    setOpen(true)
  }

  const submit = async () => {
    const s = ensureSigner()
    if (!s || !text.trim()) return
    setBusy(true)
    try {
      const r = await apiSend<{ success: boolean; error?: string; post?: FeedPost }>('/api/social/post', { address: address ?? s.publicKey.toBase58(), content: text.trim() })
      if (!r.success || !r.post) throw new Error(r.error || 'Could not post')
      setText('')
      setOpen(false)
      onPosted(r.post)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-3">
        <Avatar username={user?.username || 'you'} url={user?.avatarUrl} size={36} />
        {open ? (
          <div className="flex-1 min-w-0">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="What did giving look like for you today?"
              className="input resize-none !py-2.5 !text-[14px]"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11.5px] text-[#aeaeb2] num">{text.length}/500</span>
              <div className="flex items-center gap-2">
                <Btn tone="ghost" size="sm" onClick={() => (setOpen(false), setText(''))}>
                  Cancel
                </Btn>
                <Btn size="sm" onClick={submit} loading={busy} disabled={!text.trim()}>
                  Post
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button onClick={focus} className="flex-1 text-left h-10 px-4 rounded-full bg-black/[0.04] text-[14px] text-[#aeaeb2] hover:bg-black/[0.06] transition-colors truncate">
              Share an update…
            </button>
            <Btn tone="outline" size="md" icon="bolt" onClick={() => ensureSigner() && onDare()} className="flex-shrink-0">
              <span className="hidden sm:inline">Dare a friend</span>
              <span className="sm:hidden">Dare</span>
            </Btn>
          </>
        )}
      </div>
    </div>
  )
}
