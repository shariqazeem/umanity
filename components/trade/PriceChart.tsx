'use client'

import { useId, useMemo, useRef, useState } from 'react'

export type ChartPoint = { t: number; p: number }

const W = 600

/** Tiny prices the way traders read them: 0.0000150 → 0.0₄150. */
export function priceText(n: number) {
  if (!(n > 0)) return '$0'
  if (n >= 0.01) return `$${n < 1 ? n.toPrecision(3) : n.toFixed(4)}`
  const digits = n.toFixed(14).slice(2)
  const zeros = digits.length - digits.replace(/^0+/, '').length
  const sig = digits.slice(zeros, zeros + 3).replace(/0+$/, '') || '0'
  const sub = String(zeros).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
  return `$0.0${sub}${sig}`
}

const clock = (t: number, span: number) =>
  new Date(t * 1000).toLocaleString([], span > 2 * 86_400 ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })

/**
 * The price line, drawn to fit its box. Press, hover or drag for the price at
 * any moment; a vertical swipe still scrolls the page.
 */
export function PriceChart({ points, height = 168, onHover }: { points: ChartPoint[]; height?: number; onHover?: (p: ChartPoint | null) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const fillId = `fill-${useId().replace(/:/g, '')}`
  const [at, setAt] = useState<number | null>(null)
  const span = points.length > 1 ? points[points.length - 1].t - points[0].t : 1
  const up = points.length < 2 || points[points.length - 1].p >= points[0].p
  const flat = points.every((p) => p.p === points[0]?.p)
  const color = up ? '#10b981' : '#ef4444'

  const geo = useMemo(() => {
    const t0 = points[0]?.t ?? 0
    const ps = points.map((p) => p.p)
    let lo = Math.min(...ps)
    let hi = Math.max(...ps)
    if (hi === lo) {
      // A flat line sits in the middle instead of on the floor.
      const pad = hi * 0.05 || 1e-12
      lo -= pad
      hi += pad
    }
    const padY = (hi - lo) * 0.14
    lo -= padY
    hi += padY
    const xs = points.map((p) => ((p.t - t0) / Math.max(1, span)) * W)
    const ys = points.map((p) => height - ((p.p - lo) / (hi - lo)) * height)
    const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
    return { xs, ys, line, area: `${line} L${W},${height} L0,${height} Z` }
  }, [points, height, span])

  const pick = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect()
    if (!r || !points.length) return
    const x = ((clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < geo.xs.length; i++) if (Math.abs(geo.xs[i] - x) < Math.abs(geo.xs[best] - x)) best = i
    setAt(best)
    onHover?.(points[best])
  }
  const leave = () => {
    setAt(null)
    onHover?.(null)
  }

  if (!points.length) return <div className="skeleton" style={{ height }} />
  const hx = at != null ? geo.xs[at] : null
  const hy = at != null ? geo.ys[at] : null

  return (
    <div className="relative select-none" style={{ height }}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible touch-pan-y"
        role="img"
        aria-label={`Price from ${priceText(points[0].p)} to ${priceText(points[points.length - 1].p)}`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={leave}
        onPointerCancel={leave}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${fillId})`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hx != null && <line x1={hx} x2={hx} y1="0" y2={height} stroke="#1d1d1f" strokeOpacity="0.18" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      {flat && at == null && height >= 100 && (
        <span className="absolute left-1/2 -translate-x-1/2 top-3 text-[11px] text-[#86868b] bg-white/80 rounded-full px-2.5 py-0.5 pointer-events-none whitespace-nowrap">
          No price change in this window
        </span>
      )}
      {hx != null && hy != null && at != null && (
        <>
          <span className="absolute w-2.5 h-2.5 rounded-full border-2 border-white pointer-events-none" style={{ left: `calc(${(hx / W) * 100}% - 5px)`, top: hy - 5, background: color }} />
          <span
            className="absolute -top-1 px-2 py-0.5 rounded-full bg-[#1d1d1f] text-white text-[10.5px] font-semibold counter pointer-events-none whitespace-nowrap"
            style={{ left: `clamp(0px, calc(${(hx / W) * 100}% - 40px), calc(100% - 92px))` }}
          >
            {clock(points[at].t, span)}
          </span>
        </>
      )}
    </div>
  )
}
