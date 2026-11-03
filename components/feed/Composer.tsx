'use client'

import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { apiSend } from '@/lib/client/api'
import type { FeedPost } from '@/lib/data/social'

/** The original composer card, plus the dare launcher. */
export function Composer({ onPosted, onDare }: { onPosted: (post: FeedPost) => void; onDare: () => void }) {
  const { address, user, ensureSigner, toast } = useUmanity()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  if (!address) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
          <span className="text-xs">✦</span>
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium">Sign in to post, dare and vote</p>
          <p className="text-[11px] text-[#86868b]">Browsing is open to everyone. A wallet takes one tap.</p>
        </div>
        <button onClick={() => ensureSigner()} className="btn-primary px-4 py-2 !text-[12px]">
          Sign in
        </button>
      </div>
    )
  }

  const post = async () => {
    const s = ensureSigner()
    if (!s || !text.trim()) return
    setBusy(true)
    try {
      const r = await apiSend<{ success: boolean; error?: string; post?: FeedPost }>('/api/social/post', { address: address ?? s.publicKey.toBase58(), content: text.trim() })
      if (!r.success || !r.post) throw new Error(r.error || 'Could not post')
      onPosted(r.post)
      setText('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Avatar username={user?.username || 'u'} url={user?.avatarUrl} size={40} />
        <div className="flex-1 min-w-0">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="Share your impact…" rows={2} className="input resize-none !text-sm" />
          <div className="flex justify-between items-center mt-2 gap-2">
            <button onClick={onDare} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[12px] font-semibold hover:bg-amber-100 transition-colors">
              ⚡ Dare a friend
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#aeaeb2] counter">{text.length}/500</span>
              <button onClick={post} disabled={!text.trim() || busy} className="btn-primary px-5 py-2 !text-xs">
                {busy ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
