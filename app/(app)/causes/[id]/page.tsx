'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Empty, Icon, Img, Pill, SectionTitle, Skeleton } from '@/components/shared/ui'
import { fmtSol, fmtUsd } from '@/lib/client/api'
import { getCause } from '@/lib/causes'
import { useCauseDetail, useIsAdmin, useVoting } from '@/components/causes/data'
import { UpdateCard } from '@/components/causes/UpdateCard'
import { GiveCard, EscrowBox } from '@/components/causes/GiveCard'
import { Supporters, GiftsList, DaresList } from '@/components/causes/People'

export default function CausePage() {
  const { id } = useParams<{ id: string }>()
  const { address, openGive, solPrice, user } = useUmanity()
  const { detail, loading, notFound, reload } = useCauseDetail(id, address)
  const voting = useVoting(address)
  const isAdmin = useIsAdmin(address)
  const meta = id ? getCause(id) : undefined

  if (notFound || (!loading && !detail)) {
    return (
      <div className="max-w-[640px] mx-auto">
        <Empty icon="heart" title="We could not find that cause" sub="It may have moved. Every cause we run is listed on the causes page." action={<Link href="/causes" className="btn btn-primary h-11 px-6 text-[14px]">See all causes</Link>} />
      </div>
    )
  }

  const cause = detail?.pool ?? meta
  if (!cause) return <CausePageSkeleton />

  const refresh = () => {
    reload()
    voting.reload()
  }

  const share = () => {
    const origin = window.location.origin
    const text = `${cause.name} on Umanity: ${cause.impact} Gifts are held in escrow on Solana until the delivery is proven.\n\n${origin}/causes/${cause.id}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const fundedByViewer = !!user && (detail?.supporters.some((s) => s.address === address) || detail?.gifts.some((g) => g.address === address)) === true
  const held = detail?.heldSol ?? 0

  return (
    <div className="max-w-[1120px] mx-auto pb-20 lg:pb-0">
      {/* Breadcrumb + share */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <nav className="text-[12.5px] text-[#6e6e73] flex items-center gap-1.5 min-w-0">
          <Link href="/causes" className="hover:text-[#1d1d1f]">
            Causes
          </Link>
          <Icon name="chevronRight" size={12} />
          <span className="text-[#1d1d1f] font-medium truncate">{cause.name}</span>
        </nav>
        <Btn tone="outline" size="sm" icon="share" onClick={share}>
          Share
        </Btn>
      </div>

      {/* Hero */}
      <section className="relative rounded-[28px] overflow-hidden h-[300px] sm:h-[400px] lg:h-[440px] bg-black/[0.06] img-fade animate-fade-in">
        {cause.image && <Img src={cause.image} alt={cause.imageAlt} />}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 z-10">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Pill tone="white">{cause.category}</Pill>
            {cause.location && (
              <Pill tone="white">
                <Icon name="pin" size={11} /> {cause.location}
              </Pill>
            )}
            {cause.deliveryMode === 'field' && (
              <Pill tone="white">
                <Icon name="truck" size={11} /> Delivered by hand
              </Pill>
            )}
          </div>
          <h1 className="font-display text-white text-[40px] sm:text-[56px] lg:text-[64px] leading-[0.98] tracking-[-0.01em] max-w-[720px]">{cause.name}</h1>
          <p className="text-white/85 text-[15px] sm:text-[17px] mt-3 max-w-[560px] leading-relaxed">{cause.tagline}</p>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-8">
        <div className="min-w-0 space-y-10">
          {/* Numbers strip */}
          <div className="grid grid-cols-3 gap-4 card p-5">
            {[
              ['Held in escrow', detail?.heldSol ?? 0],
              ['Raised', detail?.raisedSol ?? 0],
              ['Released', detail?.releasedSol ?? 0],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p className="eyebrow">{l}</p>
                {loading ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="num text-[22px] sm:text-[26px] font-bold mt-1 leading-none">{fmtSol(v as number, 2)} SOL</p>}
                <p className="text-[11.5px] text-[#6e6e73] mt-1 num">{solPrice && !loading ? fmtUsd((v as number) * solPrice) : ''}</p>
              </div>
            ))}
          </div>

          {/* Story */}
          <section>
            <SectionTitle title="The story" />
            <p className="text-[16px] leading-[1.7] text-[#1d1d1f]">{cause.story}</p>
          </section>

          {/* Units */}
          {cause.units.length > 0 && (
            <section>
              <SectionTitle title="What your gift buys" sub="Prices from our last purchases; they move with the market." />
              <ul className="card divide-y divide-black/[0.06]">
                {cause.units.map((u) => (
                  <li key={u.label} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="num text-[17px] font-bold w-16 flex-shrink-0">${u.usd % 1 === 0 ? u.usd : u.usd.toFixed(2)}</span>
                    <Icon name="arrowRight" size={15} className="text-[#aeaeb2]" />
                    <span className="text-[14.5px]">one {u.label}</span>
                    <button onClick={() => openGive({ causeId: cause.id, amountUsd: u.usd })} className="ml-auto text-[12.5px] font-semibold text-[#047857] hover:underline">
                      Give this
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Updates */}
          <section>
            <SectionTitle title="Delivery updates" sub="Photos, receipts and the proof that lets donors release the money." />
            {loading ? (
              <Skeleton className="h-48" />
            ) : detail && detail.updates.length > 0 ? (
              <div className="space-y-4">
                {detail.updates.map((u) => (
                  <UpdateCard key={u.id} update={u} isAdmin={isAdmin} myVote={u.proposal ? voting.myVotes[u.proposal.id] ?? null : null} power={voting.power} onVote={voting.vote} onExecute={voting.execute} onChange={refresh} fundedByViewer={fundedByViewer} />
                ))}
              </div>
            ) : (
              <div className="card">
                <Empty icon="camera" title="The first delivery is being funded" sub={`When the team delivers, the photos and receipts appear here and the donors vote on the release. ${held > 0 ? `${fmtSol(held, 2)} SOL is already waiting in the vault.` : ''}`} action={<Btn tone="accent" icon="heart" onClick={() => openGive({ causeId: cause.id })}>Help fund it</Btn>} />
              </div>
            )}
          </section>

          {/* Supporters */}
          <section>
            <SectionTitle title="Supporters" sub={detail && detail.supporterCount > 0 ? `${detail.supporterCount} ${detail.supporterCount === 1 ? 'person has' : 'people have'} given to this cause.` : undefined} />
            {loading ? <Skeleton className="h-24" /> : <Supporters supporters={detail?.supporters ?? []} count={detail?.supporterCount ?? 0} friends={detail?.friendsWhoGave ?? []} onGive={() => openGive({ causeId: cause.id })} />}
          </section>

          {detail && detail.gifts.length > 0 && (
            <section>
              <SectionTitle title="Recent gifts" />
              <GiftsList gifts={detail.gifts} />
            </section>
          )}

          {detail && detail.dares.length > 0 && (
            <section>
              <SectionTitle title="Open dares for this cause" sub="Friends daring friends to give. The cause wins either way." />
              <DaresList dares={detail.dares} />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <GiveCard cause={cause} />
            <EscrowBox held={detail?.heldSol ?? 0} raised={detail?.raisedSol ?? 0} released={detail?.releasedSol ?? 0} vault={detail?.vault.address ?? ''} poolPda={detail?.vault.poolPda ?? ''} campaign={detail?.campaign ?? null} />
          </div>
        </aside>
        <div className="lg:hidden space-y-4">
          <GiveCard cause={cause} />
          <EscrowBox held={detail?.heldSol ?? 0} raised={detail?.raisedSol ?? 0} released={detail?.releasedSol ?? 0} vault={detail?.vault.address ?? ''} poolPda={detail?.vault.poolPda ?? ''} campaign={detail?.campaign ?? null} />
        </div>
      </div>

      {/* Mobile give bar */}
      <div className="lg:hidden fixed left-0 right-0 z-40 glass border-t border-black/[0.06] px-5 py-2.5 flex items-center gap-3" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-[#6e6e73] num">{fmtSol(held, 2)} SOL held in escrow</p>
          <p className="text-[12.5px] font-semibold truncate">{cause.impact}</p>
        </div>
        <Btn tone="accent" size="lg" icon="heart" onClick={() => openGive({ causeId: cause.id })}>
          Give
        </Btn>
      </div>
    </div>
  )
}

function CausePageSkeleton() {
  return (
    <div className="max-w-[1120px] mx-auto">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-[300px] sm:h-[400px] lg:h-[440px] !rounded-[28px]" />
      <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-8">
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}
