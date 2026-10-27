'use client'

import { useEffect, useState } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletButton() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="bg-[#111] hover:bg-black rounded-full h-10 px-5 text-white text-[13px] font-medium whitespace-nowrap transition-all hover:shadow-lg hover:shadow-black/10">
        Connect
      </button>
    )
  }

  return <WalletMultiButton className="!bg-[#111] hover:!bg-black !rounded-full !h-10 !px-4 sm:!px-5 !text-[12px] sm:!text-[13px] !font-medium !whitespace-nowrap !transition-all hover:!shadow-lg hover:!shadow-black/10" />
}
