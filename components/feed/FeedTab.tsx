'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend, fmtSol, timeAgo, countdown } from '@/lib/client/api'
import { Card, Btn, Pill, Mono, Modal, TxLink, ChainBadge, Skeleton, Empty } from '@/components/shared/ui'
import { GradientAvatar } from '@/components/shared/GradientAvatar'
import { CAUSES, DEFAULT_CAUSE_ID } from '@/lib/causes'
import { createDareOnChain, boostDareOnChain } from '@/lib/client/solana'
import type { FeedPost } from '@/lib/data/social'
import type { DareView } from '@/lib/data/dares'
import type { ProposalView } from '@/lib/data/governance'
import type { PublicUser } from '@/lib/data/users'

type Item =
  | { type: 'post'; id: string; data: FeedPost }
  | { type: 'dare'; id: string; data: DareView }
  | { type: 'proposal'; id: string; data: ProposalView }
  | { type: 'suggested_follow'; id: string; data: PublicUser }

export function FeedTab({ onGive }: { onGive: (cause?: string, mode?: 'anychain' | 'solana') => void }) {
  const { address, user, toast, startDemo } = useUmanity()
  const [items, setItems] = useState<Item[] | null>(null)
  const [dares, setDares] = useState<DareView[]>([])
  const [composer, setComposer] = useState<'post' | 'dare'>('post')
  const [dareOpen, setDareOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const q = address ? `?address=${address}` : ''
      const [f, d] = await Promise.all([apiGet<{ feed?: Item[] }>(`/api/feed/smart${q}`), apiGet<{ dares?: DareView[] }>('/api/dares?status=open&limit=6')])
      setItems(f.feed ?? [])
      setDares(d.dares ?? [])
    } catch {
      setItems([])
    }
  }, [address])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const ensureSigner = async () => {
    if (address) return true
    toast('Starting an instant demo wallet…', 'info')
    const r = await startDemo()
    if (r.error) {
      toast(r.error, 'err')
      return false
    }
    return true
  }

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Feed</h2>
          <p className="text-[13px] text-[#52525B]">Giving is the content. Every card links to a Solana transaction.</p>
        </div>
        <Pill tone="coral">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36] animate-pulse" /> LIVE
        </Pill>
      </div>

      {/* Composer */}
      <Card className="p-4 mb-4">
        <div className="flex gap-1 mb-3 bg-[#F3F3F1] rounded-xl p-1 w-fit">
          <button onClick={() => setComposer('post')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${composer === 'post' ? 'bg-white shadow-sm' : 'text-[#52525B]'}`}>
            Post impact story
          </button>
          <button onClick={() => setComposer('dare')} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${composer === 'dare' ? 'bg-white shadow-sm text-[#D9431F]' : 'text-[#52525B]'}`}>
            ⚡ Launch a staked dare
          </button>
        </div>
        {composer === 'post' ? (
          <PostComposer onPosted={load} ensureSigner={ensureSigner} />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-[#52525B]">Lock SOL in a dare vault and challenge anyone to give. If they do not, the pot still goes to the cause.</p>
            <Btn tone="coral" onClick={async () => (await ensureSigner()) && setDareOpen(true)}>
              Create dare
            </Btn>
          </div>
        )}
      </Card>

      {/* Live dares rail */}
      {dares.length > 0 && (
        <div className="mb-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-3 w-max">
            {dares.map((d) => (
              <DareMini key={d.id} dare={d} onBoosted={load} ensureSigner={ensureSigner} />
            ))}
          </div>
        </div>
      )}

      {/* Stream */}
      {items === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-[20px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty title="The stream is quiet" sub="Make the first donation and it shows up here with its transaction." action={<Btn onClick={() => onGive(DEFAULT_CAUSE_ID, 'solana')}>Give 0.01 SOL</Btn>} />
      ) : (
        <div className="space-y-3 animate-stagger">
          {items.map((it) => {
            if (it.type === 'post') return <PostCard key={it.id} post={it.data} viewer={address} user={user} ensureSigner={ensureSigner} />
            if (it.type === 'dare') return <DareCard key={it.id} dare={it.data} onBoosted={load} ensureSigner={ensureSigner} />
            if (it.type === 'proposal') return <ProposalMini key={it.id} p={it.data} />
            if (it.type === 'suggested_follow') return <SuggestCard key={it.id} u={it.data} viewer={address} />
            return null
          })}
        </div>
      )}

      <DareComposer open={dareOpen} onClose={() => setDareOpen(false)} onCreated={load} />
    </div>
  )
}

function PostComposer({ onPosted, ensureSigner }: { onPosted: () => void; ensureSigner: () => Promise<boolean> }) {
  const { address, user, toast } = useUmanity()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!(await ensureSigner())) return
    setBusy(true)
    const r = await apiSend<{ success: boolean; error?: string }>('/api/social/post', { address, content: text.trim() })
    setBusy(false)
    if (!r.success) return toast(r.error || 'Could not post', 'err')
    setText('')
    toast('Posted', 'ok')
    onPosted()
  }
  return (
    <div className="flex gap-3">
      <GradientAvatar username={user?.username || 'you'} size="md" />
      <div className="flex-1">
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={2} placeholder="Share an impact story, tag a cause, call someone out…" className="input resize-none !text-[13px]" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-[#A1A1AA]">{text.length}/500</span>
          <Btn size="sm" onClick={submit} loading={busy} disabled={!text.trim()}>
            Post
          </Btn>
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, viewer, user, ensureSigner }: { post: FeedPost; viewer: string | null; user: PublicUser | null; ensureSigner: () => Promise<boolean> }) {
  const { toast } = useUmanity()
  const [liked, setLiked] = useState(!!post.liked)
  const [likes, setLikes] = useState(post.likeCount)
  const [comments, setComments] = useState<{ id: string; username: string; text: string; createdAt: string }[] | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(post.commentCount)

  const like = async () => {
    if (!(await ensureSigner())) return
    const next = !liked
    setLiked(next)
    setLikes((n) => n + (next ? 1 : -1))
    const r = await apiSend<{ likeCount?: number }>('/api/social/like', { address: viewer, postId: post.id }, next ? 'POST' : 'DELETE')
    if (typeof r.likeCount === 'number') setLikes(r.likeCount)
  }
  const toggleComments = async () => {
    if (comments) return setComments(null)
    const r = await apiGet<{ comments?: typeof comments }>(`/api/social/comment?postId=${post.id}`)
    setComments(r.comments ?? [])
  }
  const comment = async () => {
    if (!(await ensureSigner()) || !commentText.trim()) return
    const r = await apiSend<{ comment?: { id: string; username: string; text: string; createdAt: string } }>('/api/social/comment', { address: viewer, postId: post.id, text: commentText.trim() })
    if (r.comment) {
      setComments((c) => [...(c ?? []), r.comment!])
      setCommentCount((n) => n + 1)
      setCommentText('')
    }
  }
  const share = () => {
    const base = window.location.origin
    const blink = post.properties.poolId ? `https://dial.to/?action=solana-action:${encodeURIComponent(`${base}/api/actions/donate/${post.properties.poolId}`)}&cluster=devnet` : base
    const text = `${post.content.slice(0, 180)}\n\n${blink}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const typePill: Record<string, { label: string; tone: 'emerald' | 'coral' | 'indigo' | 'amber' | 'gray' | 'shield' }> = {
    donation: { label: 'Donation', tone: 'emerald' },
    impact_dare: { label: 'Dare', tone: 'coral' },
    dare_accepted: { label: 'Dare update', tone: 'coral' },
    proof: { label: 'Escrow release', tone: 'indigo' },
    vote: { label: 'Vote', tone: 'amber' },
    joined: { label: 'Joined', tone: 'gray' },
    milestone: { label: 'Milestone', tone: 'indigo' },
    intent: { label: 'Cross-chain', tone: 'indigo' },
  }
  const tp = typePill[post.type]

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <GradientAvatar username={post.username} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold truncate">{post.displayName || `@${post.username}`}</span>
            <span className="text-[12px] text-[#A1A1AA]">@{post.username} · {timeAgo(post.createdAt)}</span>
            {tp && <Pill tone={tp.tone}>{tp.label}</Pill>}
            {post.properties.route === 'multihopper' && <Pill tone="shield">🛡️ discreet</Pill>}
          </div>
          <p className="text-[14px] text-[#111113] leading-relaxed mt-1.5 whitespace-pre-wrap">{post.content}</p>
          {post.properties.sourceChain && <ChainBadge chain={post.properties.sourceChain} className="mt-2" />}
          <div className="flex items-center gap-4 mt-3 text-[12px] text-[#52525B]">
            <button onClick={like} className={`flex items-center gap-1 hover:text-[#111113] ${liked ? 'text-[#D9431F]' : ''}`}>
              <span className={liked ? 'heart-pop' : ''}>{liked ? '♥' : '♡'}</span> <Mono>{likes}</Mono>
            </button>
            <button onClick={toggleComments} className="flex items-center gap-1 hover:text-[#111113]">
              💬 <Mono>{commentCount}</Mono>
            </button>
            <button onClick={share} className="hover:text-[#111113]">
              Share{post.properties.poolId ? ' Blink' : ''} on X
            </button>
            {post.txSignature && <TxLink sig={post.txSignature} />}
          </div>
          {comments && (
            <div className="mt-3 pt-3 border-t border-[#F3F3F1] space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="text-[12px]">
                  <span className="font-semibold">@{c.username}</span> <span className="text-[#52525B]">{c.text}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={commentText} onChange={(e) => setCommentText(e.target.value.slice(0, 500))} onKeyDown={(e) => e.key === 'Enter' && comment()} placeholder={user ? 'Reply…' : 'Start a demo wallet to reply'} className="input !py-2 !text-[12px]" />
                <Btn size="sm" onClick={comment} disabled={!commentText.trim()}>
                  Reply
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function useTicker(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [seconds])
  return left
}

function BoostButton({ dare, onBoosted, ensureSigner, size = 'sm' }: { dare: DareView; onBoosted: () => void; ensureSigner: () => Promise<boolean>; size?: 'sm' | 'md' }) {
  const { signer, toast, refreshBalance } = useUmanity()
  const { connection } = useConnection()
  const [busy, setBusy] = useState(false)
  const boost = async (sol: number) => {
    if (!(await ensureSigner()) || !signer || !dare.darePda) return
    setBusy(true)
    try {
      const sig = await boostDareOnChain(connection, signer, dare.darePda, sol)
      const r = await apiSend<{ success: boolean; error?: string }>(`/api/dares/${dare.id}/boost`, { backer: signer.publicKey.toBase58(), signature: sig })
      if (!r.success) throw new Error(r.error)
      toast(`Boosted the pot by ${sol} SOL`, 'ok')
      refreshBalance()
      onBoosted()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Boost failed', 'err')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Btn tone="coral" size={size} onClick={() => boost(0.05)} loading={busy} disabled={dare.status !== 'open' || !dare.darePda}>
      Boost pot +0.05 SOL
    </Btn>
  )
}

function DareMini({ dare, onBoosted, ensureSigner }: { dare: DareView; onBoosted: () => void; ensureSigner: () => Promise<boolean> }) {
  const left = useTicker(dare.secondsLeft)
  return (
    <div className="dare-card w-[260px] p-3.5 flex-shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <Pill tone="coral">⚡ DARE</Pill>
        <Mono className="text-[11px] font-semibold text-[#D9431F]">{countdown(left)}</Mono>
      </div>
      <p className="text-[12px] font-semibold leading-snug line-clamp-2">
        @{dare.targetHandle}: {dare.text}
      </p>
      <div className="flex items-center justify-between mt-2.5">
        <div>
          <Mono className="text-[15px] font-bold">{fmtSol(dare.pot, 3)} SOL</Mono>
          <p className="text-[10px] text-[#52525B]">
            {dare.backerCount} backers · {dare.poolEmoji} {dare.poolName}
          </p>
        </div>
        <BoostButton dare={dare} onBoosted={onBoosted} ensureSigner={ensureSigner} />
      </div>
    </div>
  )
}

function DareCard({ dare, onBoosted, ensureSigner }: { dare: DareView; onBoosted: () => void; ensureSigner: () => Promise<boolean> }) {
  const left = useTicker(dare.secondsLeft)
  const blink = typeof window !== 'undefined' ? `https://dial.to/?action=solana-action:${encodeURIComponent(`${window.location.origin}/api/actions/dare/${dare.id}`)}&cluster=devnet` : ''
  return (
    <div className="dare-card p-4">
      <div className="flex items-start gap-3">
        <GradientAvatar username={dare.creator.username || 'x'} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold">@{dare.creator.username}</span>
            <span className="text-[12px] text-[#A1A1AA]">dared</span>
            <span className="text-[13px] font-bold">@{dare.targetHandle}</span>
            <Pill tone="coral">{dare.status === 'open' ? countdown(left) : dare.status}</Pill>
          </div>
          <p className="text-[14px] mt-1.5">{dare.text}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="px-3 py-2 rounded-xl bg-white border border-[#FFD9CF]">
              <Mono className="text-[18px] font-bold text-[#D9431F]">{fmtSol(dare.pot, 3)} SOL</Mono>
              <p className="text-[10px] text-[#52525B]">pot · {dare.backerCount} backers · → {dare.poolEmoji} {dare.poolName}</p>
            </div>
            <BoostButton dare={dare} onBoosted={onBoosted} ensureSigner={ensureSigner} size="md" />
            <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(`⚡ @${dare.targetHandle} has been dared on @umanity_xyz: "${dare.text}" — ${fmtSol(dare.pot, 3)} SOL on the line for ${dare.poolName}. Boost the pot from X:\n${blink}`)}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[#52525B] hover:text-[#111113]">
              Share Blink on X
            </a>
            {dare.createTxSignature && <TxLink sig={dare.createTxSignature} label="escrow tx" />}
          </div>
          <p className="text-[10px] text-[#A1A1AA] mt-2">Completed → pot to the cause. Expired → pot still to the cause. 1.5% protocol fee on settlement, enforced on-chain.</p>
        </div>
      </div>
    </div>
  )
}

function ProposalMini({ p }: { p: ProposalView }) {
  const yes = p.results[0]?.percentage ?? 0
  return (
    <Card className="p-4 border-l-4 border-l-indigo-400">
      <div className="flex items-center gap-2 mb-1">
        <Pill tone="indigo">Vote open</Pill>
        <span className="text-[11px] text-[#A1A1AA]">closes {timeAgo(p.closes_at)}</span>
      </div>
      <p className="text-[14px] font-semibold">{p.title}</p>
      <p className="text-[12px] text-[#52525B] mt-1 line-clamp-2">{p.description}</p>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 h-2 rounded-full bg-[#F3F3F1] overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${yes}%` }} />
        </div>
        <Mono className="text-[12px] font-semibold">{yes.toFixed(0)}% approve</Mono>
        <Mono className="text-[12px] text-[#52525B]">{fmtSol(p.escrowAmount, 3)} SOL</Mono>
      </div>
      <a href="?tab=govern" className="inline-block mt-2 text-[12px] font-semibold text-indigo-700 hover:underline">
        Review evidence & vote →
      </a>
    </Card>
  )
}

function SuggestCard({ u, viewer }: { u: PublicUser; viewer: string | null }) {
  const { toast } = useUmanity()
  const [done, setDone] = useState(false)
  const follow = async () => {
    if (!viewer) return toast('Start a demo wallet or connect to follow', 'info')
    await apiSend('/api/social/follow', { followerAddress: viewer, followeeAddress: u.address })
    setDone(true)
  }
  return (
    <Card className="p-3.5 flex items-center gap-3">
      <GradientAvatar username={u.username} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">Suggested</p>
        <p className="text-[13px] font-semibold truncate">@{u.username}</p>
        <p className="text-[11px] text-[#52525B] truncate">{u.bio || `${fmtSol(u.totalDonated, 3)} SOL given`}</p>
      </div>
      <Btn size="sm" tone={done ? 'secondary' : 'primary'} onClick={follow} disabled={done}>
        {done ? 'Following' : 'Follow'}
      </Btn>
    </Card>
  )
}

function DareComposer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { signer, toast, refreshBalance } = useUmanity()
  const { connection } = useConnection()
  const [target, setTarget] = useState('')
  const [text, setText] = useState('')
  const [poolId, setPoolId] = useState(DEFAULT_CAUSE_ID)
  const [stake, setStake] = useState(0.05)
  const [hours, setHours] = useState(48)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ username: string; address: string }[]>([])

  const search = async (q: string) => {
    setTarget(q)
    if (q.length < 2) return setResults([])
    const r = await apiGet<{ profiles?: { username: string; address: string }[] }>(`/api/social/search?q=${encodeURIComponent(q)}`)
    setResults((r.profiles ?? []).slice(0, 5))
  }

  const create = async () => {
    if (!signer) return
    setBusy(true)
    try {
      const targetUser = results.find((r) => r.username === target)
      const { signature, darePda } = await createDareOnChain(connection, signer, { poolId, targetHandle: target, text, stakeSol: stake, hours, targetWallet: targetUser?.address ?? null })
      const r = await apiSend<{ success: boolean; error?: string }>('/api/dares', { creator: signer.publicKey.toBase58(), targetHandle: target, poolId, text, hours, signature, darePda })
      if (!r.success) throw new Error(r.error)
      toast(`Dare live. ${stake} SOL locked on-chain.`, 'ok')
      refreshBalance()
      onCreated()
      onClose()
      setText('')
      setTarget('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create dare', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-[17px] font-bold">⚡ Launch a staked dare</h3>
        <p className="text-[12px] text-[#52525B] mb-4">Your stake goes into an on-chain dare vault. Completed or not, it ends in the cause&apos;s escrow.</p>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Dare who</label>
        <div className="relative mb-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A1A1AA]">@</span>
          <input value={target} onChange={(e) => search(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username or x handle" className="input !pl-8" />
        </div>
        {results.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {results.map((r) => (
              <button key={r.address} onClick={() => setTarget(r.username)} className="text-[11px] px-2 py-1 rounded-lg bg-[#F3F3F1] hover:bg-[#EAEAE6]">
                @{r.username}
              </button>
            ))}
          </div>
        )}
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1 mt-2">The dare</label>
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} placeholder="Match this and post the receipt" className="input mb-3" />
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Cause</label>
        <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className="input !py-2.5 mb-3">
          {CAUSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Stake</label>
            <div className="flex gap-1.5">
              {[0.05, 0.1, 0.5].map((s) => (
                <button key={s} onClick={() => setStake(s)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold ${stake === s ? 'bg-[#111113] text-white' : 'bg-[#F3F3F1]'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Timer</label>
            <div className="flex gap-1.5">
              {[24, 48, 168].map((h) => (
                <button key={h} onClick={() => setHours(h)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold ${hours === h ? 'bg-[#111113] text-white' : 'bg-[#F3F3F1]'}`}>
                  {h === 168 ? '7d' : `${h}h`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Btn tone="coral" size="lg" className="w-full mt-5" onClick={create} loading={busy} disabled={!target || !text || !signer}>
          Lock {stake} SOL & send dare
        </Btn>
      </div>
    </Modal>
  )
}
