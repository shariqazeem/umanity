'use client'

import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Btn, Icon, TxLink } from '@/components/shared/ui'
import { apiGet, apiSend, timeAgo } from '@/lib/client/api'
import type { CommentView } from '@/lib/data/social'

/** Like · comment · share · tx row, shared by every post-like card. */
export function PostActions({ postId, likeCount, liked: likedInit, commentCount: commentInit, txSignature, shareText, shareUrl, right }: { postId: string; likeCount: number; liked?: boolean; commentCount: number; txSignature?: string | null; shareText: string; shareUrl: string; right?: React.ReactNode }) {
  const { address, ensureSigner, toast } = useUmanity()
  const [liked, setLiked] = useState(!!likedInit)
  const [likes, setLikes] = useState(likeCount)
  const [pop, setPop] = useState(false)
  const [comments, setComments] = useState<CommentView[] | null>(null)
  const [count, setCount] = useState(commentInit)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const like = async () => {
    const s = ensureSigner()
    if (!s) return
    const next = !liked
    setLiked(next)
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)))
    if (next) {
      setPop(true)
      setTimeout(() => setPop(false), 450)
    }
    try {
      const r = await apiSend<{ likeCount?: number }>('/api/social/like', { address: address ?? s.publicKey.toBase58(), postId }, next ? 'POST' : 'DELETE')
      if (typeof r.likeCount === 'number') setLikes(r.likeCount)
    } catch {
      /* keep optimistic */
    }
  }

  const toggleComments = async () => {
    if (comments) return setComments(null)
    try {
      const r = await apiGet<{ comments?: CommentView[] }>(`/api/social/comment?postId=${postId}`)
      setComments(r.comments ?? [])
    } catch {
      setComments([])
    }
  }

  const send = async () => {
    const s = ensureSigner()
    if (!s || !text.trim()) return
    setSending(true)
    try {
      const r = await apiSend<{ success: boolean; error?: string; comment?: CommentView }>('/api/social/comment', { address: address ?? s.publicKey.toBase58(), postId, text: text.trim() })
      if (!r.success || !r.comment) throw new Error(r.error || 'Could not reply')
      setComments((c) => [...(c ?? []), r.comment!])
      setCount((n) => n + 1)
      setText('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reply', 'err')
    } finally {
      setSending(false)
    }
  }

  const share = () => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`, '_blank', 'noopener')
  }

  return (
    <div>
      <div className="flex items-center gap-1 mt-3 -ml-2 text-[#6e6e73]">
        <button onClick={like} className={`inline-flex items-center gap-1.5 h-8 px-2 rounded-full hover:bg-black/[0.04] transition-colors ${liked ? 'text-[#047857]' : ''}`} aria-pressed={liked}>
          <span className={pop ? 'heart-pop inline-flex' : 'inline-flex'}>
            <Icon name={liked ? 'heartFill' : 'heart'} size={16} />
          </span>
          <span className="text-[12.5px] num">{likes > 0 ? likes : ''}</span>
        </button>
        <button onClick={toggleComments} className="inline-flex items-center gap-1.5 h-8 px-2 rounded-full hover:bg-black/[0.04] transition-colors">
          <Icon name="chat" size={16} />
          <span className="text-[12.5px] num">{count > 0 ? count : ''}</span>
        </button>
        <button onClick={share} className="inline-flex items-center gap-1.5 h-8 px-2 rounded-full hover:bg-black/[0.04] transition-colors" aria-label="Share">
          <Icon name="share" size={16} />
        </button>
        {txSignature && (
          <span className="ml-1">
            <TxLink sig={txSignature} label="Transaction" />
          </span>
        )}
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {comments && (
        <div className="mt-2 pt-3 border-t border-black/[0.06] space-y-2.5">
          {comments.length === 0 && <p className="text-[12.5px] text-[#aeaeb2]">No replies yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar username={c.username || 'u'} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug">
                  <span className="font-semibold">{c.displayName || `@${c.username}`}</span> <span className="text-[#6e6e73]">{c.text}</span>
                </p>
                <p className="text-[11px] text-[#aeaeb2] mt-0.5">{timeAgo(c.createdAt)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Reply…"
              className="input !h-10 !py-0 !text-[13px] !rounded-full"
            />
            <Btn size="md" onClick={send} loading={sending} disabled={!text.trim()}>
              Reply
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
