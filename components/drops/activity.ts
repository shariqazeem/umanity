import { chainLabel } from '@/components/feed/types'
import { short } from '@/lib/client/api'
import { usdText } from '@/lib/umanity/drops'
import type { HomeItem } from '@/lib/umanity/feed'

/** One plain sentence per event, shared with the live ticker. */
export function activityLine(a: HomeItem): string {
  switch (a.type) {
    case 'gift': {
      const who = !a.who ? 'Someone' : 'address' in a.who ? short(a.who.address) : `@${a.who.username}`
      const via = a.channel === 'x402' ? ' via x402' : a.channel === 'intents' && a.sourceChain ? ` from ${chainLabel(a.sourceChain) ?? a.sourceChain}` : ''
      return `${a.channel === 'x402' ? '🤖 ' : ''}${who} put ${usdText(a.amountUsd, a.amountUsd % 1 ? 2 : 0)} into Drop #${a.drop.id + 1}${via}`
    }
    case 'update':
      return `${a.kind === 'proof' ? '🎥 Proof posted' : '📝 Update'} for Drop #${a.drop.id + 1}: ${a.title}`
    case 'unlocked':
      return `✅ Drop #${a.drop.id + 1} delivered, ${usdText(a.amountUsd, 2)} unlocked`
    case 'missed':
      return `↩︎ Drop #${a.drop.id + 1} ${a.cancelled ? 'called off' : 'missed its date'}: refunds open`
    case 'fees':
      return `⇄ ${usdText(a.toDropsUsd, 2)} of fees went to drops`
    case 'funded':
      return `⇄ Trading fees put ${usdText(a.amountUsd, 2)} into Drop #${a.drop.id + 1}`
    default:
      return ''
  }
}
