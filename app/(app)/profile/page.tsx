'use client'

import { useUmanity } from '@/components/providers/UmanityProvider'
import { ProfileView } from '@/components/profile/ProfileView'
import { Btn, Icon, Skeleton } from '@/components/shared/ui'

export default function ProfilePage() {
  const { signer, user, profileLoading, openAuth } = useUmanity()

  if (!signer) {
    return (
      <div className="max-w-[560px] mx-auto pt-6 sm:pt-12">
        <div className="card p-8 sm:p-10 text-center">
          <span className="w-14 h-14 rounded-full bg-[#ecfdf5] text-[#047857] flex items-center justify-center mx-auto">
            <Icon name="shield" size={24} />
          </span>
          <h1 className="font-display text-[34px] leading-[1.05] mt-6">Your pass starts with a gift.</h1>
          <p className="text-[15px] text-[#6e6e73] leading-relaxed mt-4 max-w-[400px] mx-auto">
            Every gift adds to a Living Guardian pass that grows with your giving, your streak and your votes. Certificates, receipts and the deliveries you helped fund all live here.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-7">
            <Btn size="lg" onClick={openAuth} icon="bolt">
              Sign in
            </Btn>
          </div>
          <p className="text-[12px] text-[#aeaeb2] mt-4">Create a wallet in one tap, or connect one you already have.</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-[760px] mx-auto">
        <Skeleton className="h-[72px] w-[72px] !rounded-full" />
        <Skeleton className="h-[220px] mt-8 !rounded-[28px]" />
        {!profileLoading && <p className="text-[13px] text-[#6e6e73] mt-4">Setting up your profile…</p>}
      </div>
    )
  }

  return <ProfileView username={user.username} mode="own" />
}
