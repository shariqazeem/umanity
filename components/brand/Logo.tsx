import { markSvg } from '@/lib/umanity/tally'

/** The mark: Circle 0, cut in two (lib/umanity/tally.ts). Below 64 px it draws the small cut. */
export function Mark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return <span className={`inline-block shrink-0 leading-none ${className}`} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markSvg(size) }} />
}

/** The mark and the wordmark "umanity", in Anek Latin 800. size is the wordmark's font size in px. */
export function Lockup({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center text-[#111111] ${className}`} style={{ gap: Math.round(size * 0.24) }} aria-label="Umanity">
      <Mark size={Math.round(size * 1.05)} />
      <span className="font-extrabold leading-none tracking-[-0.02em]" style={{ fontSize: size }}>umanity</span>
    </span>
  )
}
