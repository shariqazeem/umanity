import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] page-bg flex items-center justify-center px-6">
      <div className="text-center animate-fade-up max-w-sm">
        <Image src="/logo.png" alt="Umanity" width={56} height={56} className="rounded-full mx-auto mb-8" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aeaeb2] mb-3">404</p>
        <h1 className="text-[32px] font-black tracking-[-0.04em] leading-tight">
          This page <span className="text-[#d4d4d4] line-through decoration-[#e5e5e5]">exists</span>
          <br />
          <span className="text-emerald-600">was never delivered.</span>
        </h1>
        <p className="text-[14px] text-[#86868b] mt-4 leading-relaxed">Unlike every gift on Umanity, this link has no proof behind it.</p>
        <div className="flex items-center justify-center gap-2 mt-8">
          <Link href="/home" className="btn-primary px-5 py-3 !text-[13px]">
            Open the feed
          </Link>
          <Link href="/give" className="btn-secondary px-5 py-3 !text-[13px]">
            ♡ Give
          </Link>
        </div>
      </div>
    </div>
  )
}
