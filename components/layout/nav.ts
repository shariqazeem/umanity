/** Five tabs. Give sits in the middle as the black circle on mobile. */
export const NAV = [
  { href: '/home', label: 'Home', icon: 'home', match: ['/home', '/drops', '/dares', '/explore', '/causes', '/u/'] },
  { href: '/trade', label: 'Trade', icon: 'swap', match: ['/trade'] },
  { href: '/give', label: 'Give', icon: 'heart', match: ['/give'] },
  { href: '/money', label: 'Money', icon: 'layers', match: ['/money', '/transparency'] },
  { href: '/profile', label: 'Me', icon: 'user', match: ['/profile'] },
] as const

export const SECONDARY_NAV = [{ href: '/agents', label: 'For agents', icon: 'bot', badge: 'x402', match: ['/agents'] }] as const

export function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(m.endsWith('/') ? m : `${m}/`) || pathname === m)
}
