/**
 * A display name worth showing next to the @handle. Auto-created accounts get
 * a placeholder (the handle itself or a shortened wallet address); those read
 * better as just the handle.
 */
export function shownName(displayName: string | null | undefined, username: string): string | null {
  const d = (displayName ?? '').trim()
  if (!d || d === username || d.includes('…') || d.includes('...')) return null
  return d
}
