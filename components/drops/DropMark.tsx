import { StateIcon } from '@/components/shared/ProofOrb'
import type { TallyState } from '@/lib/umanity/tally'

/** A drop's state in the Tally: open while it fills and waits, closed once it was filmed and paid, home when refunded. */
export function dropTallyState(drop: object): TallyState {
  const d = drop as { state?: string; refundsOpen?: boolean }
  if (d.state === 'unlocked') return 'closed'
  if (d.state === 'cancelled' || d.refundsOpen) return 'home'
  return 'open'
}

/** The mark a drop shows wherever it used to show an emoji: its own state, drawn by the rule. */
export function DropMark({ drop, size = 28 }: { drop: object; size?: number }) {
  return <StateIcon state={dropTallyState(drop)} size={size} />
}
