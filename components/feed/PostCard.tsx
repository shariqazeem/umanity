'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Icon } from '@/components/shared/ui'
import { apiGet, apiSend, timeAgo } from '@/lib/client/api'
import type { FeedPost, CommentView } from '@/lib/data/social'
import { shownName } from '@/lib/client/names'

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '')

/** A post someone wrote: author row, text, and the like · comment · share bar. Gifts and proof have their own cards. */
export function PostCard({ post }: { post: FeedPost }) {
  if (post.type === 'joined') {
    return (
      <div className="card px-4 py-3 flex items-center gap-2.5">
        <Link href={`/u/${post.username}`}>
          <Avatar username={post.username} url={post.avatarUrl} size={28} />
        </Link>
        <p className="text-[12.5px] text-[#86868b] flex-1 min-w-0 truncate">
          <Link href={`/u/${post.username}`} className="font-semibold text-[#1d1d1f] hover:underline">
            @{post.username}
          </Link>{' '}
          joined Umanity
        </p>
        <span className="text-[10px] text-[#aeaeb2] flex-shrink-0">{timeAgo(post.createdAt)}</span>
      </div>
    )
  }

  return (
    <article className="card p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        <Link href={`/u/${post.username}`}>
          <Avatar username={post.username} url={post.avatarUrl} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/u/${post.username}`} className="text-[13px] font-semibold text-[#1d1d1f] hover:underline">
            {shownName(post.displayName, post.username) ?? `@${post.username}`}
          </Link>
          <p className="text-[10px] text-[#aeaeb2]">
            {shownName(post.displayName, post.username) ? `@${post.username} · ` : ''}
            {timeAgo(post.createdAt)}
          </p>
        </div>
      </div>

      {post.content && <p className="text-[14px] text-[#1d1d1f] leading-[1.5] mb-3 whitespace-pre-wrap break-words">{post.content}</p>}

      <ActionBar postId={post.id} likeCount={post.likeCount} liked={post.liked} commentCount={post.commentCount} shareText={`${post.content.slice(0, 200)}\n\nvia @umanity_xyz`} shareUrl={origin()} />
    </article>
  )
}

/** Like · comment · share row from the original card. */
export function ActionBar({ postId, likeCount, liked: likedInit, commentCount, shareText, shareUrl, right }: { postId: string; likeCount: number; liked?: boolean; commentCount: number; shareText: string; shareUrl: string; right?: React.ReactNode }) {
  const { address, ensureSigner, toast } = useUmanity()
  const [liked, setLiked] = useState(!!likedInit)
  const [likes, setLikes] = useState(likeCount)
  const [pop, setPop] = useState(false)
  const [comments, setComments] = useState<CommentView[] | null>(null)
  const [count, setCount] = useState(commentCount)
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

  return (
    <div>
      <div className="flex items-center gap-1 pt-2 border-t border-black/[0.03]">
        <button
          onClick={like}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${liked ? 'text-red-500 bg-red-50/50' : 'text-[#86868b] hover:text-red-500 hover:bg-red-50/30'}`}
          aria-pressed={liked}
        >
          <span className={`text-[14px] ${pop ? 'heart-pop' : ''}`}>{liked ? '❤️' : '♡'}</span>
          <span className="counter">{likes}</span>
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03] transition-all duration-200">
          <Icon name="chat" size={14} strokeWidth={2} />
          <span className="counter">{count}</span>
        </button>
        <button
          onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`, '_blank', 'noopener')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03] transition-all duration-200"
          aria-label="Share on X"
        >
          <XLogo />
        </button>
        {right && <span className="ml-auto">{right}</span>}
      </div>

      {comments && (
        <div className="mt-2.5 pt-2.5 border-t border-black/[0.03] content-reveal">
          {comments.length > 0 && (
            <div className="space-y-2 mb-2.5">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar username={c.username || 'u'} size={24} />
                  <div className="bg-[#f5f5f7] rounded-xl px-3 py-2 flex-1">
                    <span className="text-[11px] font-semibold text-[#1d1d1f]">@{c.username}</span>
                    <p className="text-[12px] text-[#1d1d1f]/80 leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="Write a comment..."
              className="input flex-1 !py-2 !px-3 !text-[12px] !rounded-lg"
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button onClick={send} disabled={!text.trim() || sending} className="btn-primary px-3 py-2 !text-[11px] !rounded-lg">
              {sending ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function XLogo({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
