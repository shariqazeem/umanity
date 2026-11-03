/** The five tabs from the original Umanity app, plus the agent rail. */
export const NAV = [
  { href: '/home', label: 'Feed', icon: 'home', match: ['/home', '/dares'] },
  { href: '/explore', label: 'Explore', icon: 'search', match: ['/explore', '/causes', '/u/'] },
  { href: '/give', label: 'Give', icon: 'heart', match: ['/give'] },
  { href: '/govern', label: 'Govern', icon: 'vote', match: ['/govern', '/transparency'] },
  { href: '/profile', label: 'Profile', icon: 'user', match: ['/profile'] },
] as const

export const SECONDARY_NAV = [
  { href: '/agents', label: 'Agents', icon: 'bot', badge: 'x402', match: ['/agents'] },
  { href: '/transparency', label: 'Ledger', icon: 'layers', match: ['/transparency'] },
] as const

export function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(m.endsWith('/') ? m : `${m}/`) || pathname === m)
}
