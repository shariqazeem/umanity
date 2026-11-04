'use client'

import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Card, Icon, Skeleton, Pill } from '@/components/shared/ui'
import { short } from '@/lib/client/api'
import { useAdmin } from './useAdmin'
import { DropsConsole } from './DropsConsole'

export function AdminConsole() {
  const { signer, openAuth, isMainnet } = useUmanity()
  const { isAdmin, error } = useAdmin()

  if (!signer) {
    return (
      <div className="max-w-[520px] mx-auto pt-6 sm:pt-12">
        <Card className="p-8 text-center">
          <span className="w-12 h-12 rounded-full bg-black/[0.05] text-[#86868b] flex items-center justify-center mx-auto">
            <Icon name="lock" size={20} />
          </span>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mt-5">Field team console</h1>
          <p className="text-[14px] text-[#86868b] mt-2">Sign in with a team wallet to run drops.</p>
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
          <span className="w-12 h-12 rounded-full bg-black/[0.05] text-[#86868b] flex items-center justify-center mx-auto">
            <Icon name="users" size={20} />
          </span>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mt-5">This console is for the Umanity field team</h1>
          <p className="text-[14px] text-[#86868b] mt-2">
            You are signed in as <span className="num">{short(signer.publicKey.toBase58())}</span>, which is not on the team list.
          </p>
          {error && <p className="text-[12px] text-[#aeaeb2] mt-3">{error}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="eyebrow mb-2">Team console</p>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Run the drops.</h1>
          <p className="text-[14px] text-[#86868b] mt-3 max-w-[560px]">Open a drop, post updates while it fills, post the filmed proof when it is delivered, and unlock it after review. If a drop can&apos;t happen, call it off and everyone is refunded.</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="green" dot>
            {short(signer.publicKey.toBase58())}
          </Pill>
          {!isMainnet && <Pill tone="gray">Devnet</Pill>}
        </div>
      </div>
      <DropsConsole signer={signer} />
    </div>
  )
}
