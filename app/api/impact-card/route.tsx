import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const username = searchParams.get('username') || 'anonymous'
  const totalDonated = searchParams.get('totalDonated') || '0.00'
  const donationCount = searchParams.get('donationCount') || '0'
  const tier = searchParams.get('tier') || 'Bronze'
  const rewardPoints = searchParams.get('rewardPoints') || '0'

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#111111" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="border-glow" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="#10b981" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.3"/>
    </linearGradient>
    <clipPath id="rounded-outer">
      <rect x="0" y="0" width="1200" height="630" rx="0" ry="0"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#111111"/>

  <!-- Subtle gradient accent overlay -->
  <rect width="1200" height="630" fill="url(#accent)"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="3" fill="url(#border-glow)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.03">
    <line x1="300" y1="0" x2="300" y2="630" stroke="white" stroke-width="1"/>
    <line x1="600" y1="0" x2="600" y2="630" stroke="white" stroke-width="1"/>
    <line x1="900" y1="0" x2="900" y2="630" stroke="white" stroke-width="1"/>
    <line x1="0" y1="210" x2="1200" y2="210" stroke="white" stroke-width="1"/>
    <line x1="0" y1="420" x2="1200" y2="420" stroke="white" stroke-width="1"/>
  </g>

  <!-- Umanity Logo: white "U" in rounded square -->
  <rect x="60" y="50" width="44" height="44" rx="12" fill="white"/>
  <text x="82" y="81" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#111111" text-anchor="middle" dominant-baseline="central">U</text>

  <!-- Umanity text -->
  <text x="118" y="77" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="18" font-weight="700" fill="white" letter-spacing="1.5" dominant-baseline="central">Umanity</text>

  <!-- "Impact Card" label -->
  <text x="230" y="77" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="500" fill="#6b7280" dominant-baseline="central">Impact Card</text>

  <!-- Username -->
  <text x="60" y="190" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="48" font-weight="800" fill="white" letter-spacing="-1">@${escapeXml(username)}</text>

  <!-- Divider -->
  <rect x="60" y="230" width="120" height="3" rx="1.5" fill="#10b981" opacity="0.6"/>

  <!-- Tagline -->
  <text x="60" y="270" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" fill="#9ca3af">On-chain giving, transparent governance, real impact.</text>

  <!-- Stats Grid -->
  <!-- SOL Donated -->
  <g>
    <rect x="60" y="320" width="250" height="120" rx="16" fill="white" fill-opacity="0.05"/>
    <rect x="60" y="320" width="250" height="120" rx="16" stroke="white" stroke-opacity="0.06" stroke-width="1"/>
    <text x="85" y="362" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="500" fill="#6b7280" letter-spacing="0.5">SOL DONATED</text>
    <text x="85" y="415" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="800" fill="white">${escapeXml(totalDonated)}</text>
  </g>

  <!-- Donations -->
  <g>
    <rect x="330" y="320" width="250" height="120" rx="16" fill="white" fill-opacity="0.05"/>
    <rect x="330" y="320" width="250" height="120" rx="16" stroke="white" stroke-opacity="0.06" stroke-width="1"/>
    <text x="355" y="362" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="500" fill="#6b7280" letter-spacing="0.5">DONATIONS</text>
    <text x="355" y="415" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="800" fill="white">${escapeXml(donationCount)}</text>
  </g>

  <!-- Tier -->
  <g>
    <rect x="600" y="320" width="250" height="120" rx="16" fill="white" fill-opacity="0.05"/>
    <rect x="600" y="320" width="250" height="120" rx="16" stroke="white" stroke-opacity="0.06" stroke-width="1"/>
    <text x="625" y="362" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="500" fill="#6b7280" letter-spacing="0.5">TIER</text>
    <text x="625" y="415" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="800" fill="${tierColor(tier)}">${escapeXml(tier)}</text>
  </g>

  <!-- Points -->
  <g>
    <rect x="870" y="320" width="250" height="120" rx="16" fill="white" fill-opacity="0.05"/>
    <rect x="870" y="320" width="250" height="120" rx="16" stroke="white" stroke-opacity="0.06" stroke-width="1"/>
    <text x="895" y="362" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="500" fill="#6b7280" letter-spacing="0.5">POINTS</text>
    <text x="895" y="415" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="800" fill="#10b981">${escapeXml(rewardPoints)}</text>
  </g>

  <!-- Bottom: umanity-solana.vercel.app branding -->
  <text x="1140" y="580" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="15" font-weight="600" fill="#4b5563" text-anchor="end">umanity-solana.vercel.app</text>

  <!-- Bottom-left: Solana badge -->
  <g opacity="0.4">
    <text x="60" y="580" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" font-weight="500" fill="#6b7280">Powered by Solana</text>
  </g>
</svg>`

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function tierColor(tier: string): string {
  const colors: Record<string, string> = {
    Bronze: '#d97706',
    Silver: '#9ca3af',
    Gold: '#eab308',
    Diamond: '#3b82f6',
  }
  return colors[tier] || '#ffffff'
}
