'use client'

import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Card, Icon, Skeleton, Pill } from '@/components/shared/ui'
import { short } from '@/lib/client/api'
import { useAdmin } from './useAdmin'
import { DeliveryForm } from './DeliveryForm'
import { PastDeliveries } from './PastDeliveries'
import { BootstrapCard } from './BootstrapCard'

export function AdminConsole() {
  const { signer, openAuth, isMainnet } = useUmanity()
  const { isAdmin, error } = useAdmin()
  const [refreshKey, setRefreshKey] = useState(0)

  if (!signer) {
    return (
      <div className="max-w-[520px] mx-auto pt-6 sm:pt-12">
        <Card className="p-8 text-center">
          <span className="w-12 h-12 rounded-full bg-black/[0.05] text-[#6e6e73] flex items-center justify-center mx-auto">
            <Icon name="lock" size={20} />
          </span>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mt-5">Field team console</h1>
          <p className="text-[14px] text-[#6e6e73] mt-2">Sign in with a field-team wallet to post deliveries.</p>
          <Btn size="lg" className="mt-6" onClick={openAuth}>
            Sign in
          </Btn>
        </Card>
      </div>
    )
  }

  if (isAdmin === null) {
    return (
      <div className="max-w-[520px] mx-auto">
        <Skeleton className="h-40 !rounded-[20px]" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-[520px] mx-auto pt-6 sm:pt-12">
        <Card className="p-8 text-center">
          <span className="w-12 h-12 rounded-full bg-black/[0.05] text-[#6e6e73] flex items-center justify-center mx-auto">
            <Icon name="users" size={20} />
          </span>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mt-5">This console is for the Umanity field team</h1>
          <p className="text-[14px] text-[#6e6e73] mt-2">
            You are signed in as <span className="num">{short(signer.publicKey.toBase58())}</span>, which is not on the team list.
          </p>
          {error && <p className="text-[12px] text-[#aeaeb2] mt-3">{error}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[1040px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="eyebrow mb-2">Field team console</p>
          <h1 className="font-display text-[36px] leading-none">Post a delivery.</h1>
          <p className="text-[14px] text-[#6e6e73] mt-3 max-w-[560px]">Photos, receipts and a plain account of what was bought and for whom. Donors see it on the cause page, in their feed, and as a notification that their gift arrived.</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="green" dot>
            {short(signer.publicKey.toBase58())}
          </Pill>
          {!isMainnet && <Pill tone="gray">Devnet</Pill>}
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <Card className="p-5 sm:p-6">
          <DeliveryForm signer={signer} onPosted={() => setRefreshKey((k) => k + 1)} />
        </Card>
        <div className="space-y-4 lg:sticky lg:top-24">
          <PastDeliveries refreshKey={refreshKey} />
          <BootstrapCard signer={signer} />
        </div>
      </div>
    </div>
  )
}
