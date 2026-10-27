'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface PoolStat {
  id: string
  name: string
  totalDonated: number
  donorCount: number
}

interface UserStat {
  username?: string
  totalDonated?: number
  rewardPoints?: number
  tier?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UmanityAgentProps {
  poolStats?: PoolStat[]
  userStats?: UserStat
}

const QUICK_PROMPTS = [
  { label: 'Where should I donate?', icon: '\u{1F4A1}' },
  { label: 'How does escrow work?', icon: '\u{1F512}' },
  { label: 'What are Impact NFTs?', icon: '\u{1F3C5}' },
  { label: 'Show me trending causes', icon: '\u{1F4CA}' },
]

// ===== Umanity Knowledge Engine =====

type Ctx = { poolStats?: PoolStat[]; userStats?: UserStat }

interface KnowledgeEntry {
  /** Multi-word phrases get bonus weight. Order: higher-priority entries first. */
  patterns: string[]
  /** Negative patterns — if matched, skip this entry */
  exclude?: string[]
  response: string | ((ctx: Ctx) => string)
  priority: number
}

const POOL_IDS: Record<string, string> = {
  'palestine': 'palestine-red-crescent',
  'gaza': 'palestine-red-crescent',
  'prcs': 'palestine-red-crescent',
  'turkish': 'turkish-red-crescent',
  'turkey': 'turkish-red-crescent',
  'kizilay': 'turkish-red-crescent',
  'mercy': 'mercy-corps',
  'mercy corps': 'mercy-corps',
  'edhi': 'edhi-foundation',
  'orphan': 'orphanage-aid',
  'orphanage': 'orphanage-aid',
  'animal': 'animal-rescue',
  'street animal': 'animal-rescue',
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ============================
  // SPECIFIC / ACTIONABLE (high priority, narrow patterns)
  // ============================

  // --- Blink URLs (specific: "get link", "url", "copy") ---
  {
    patterns: ['blink link', 'blink url', 'get link', 'get blink', 'copy blink', 'share blink', 'blink donate link', 'donate blink link', 'donate link', 'share donate', 'donate url'],
    priority: 15,
    response: `Here are your Umanity Blink URLs you can share anywhere:\n\nDonate Blinks (one per pool):\n• /api/actions/donate/palestine-red-crescent\n• /api/actions/donate/turkish-red-crescent\n• /api/actions/donate/mercy-corps\n• /api/actions/donate/edhi-foundation\n• /api/actions/donate/orphanage-aid\n• /api/actions/donate/animal-rescue\n\nJust prepend your app URL (e.g. https://umanity-solana.vercel.app) and share on X. Anyone with a Solana wallet can donate directly from the link!`,
  },
  // --- Tip blink URL ---
  {
    patterns: ['tip link', 'tip url', 'tip blink', 'get tip link', 'share tip', 'tip me'],
    priority: 15,
    response: ({ userStats }) => {
      const username = userStats?.username || 'yourusername'
      return `Your personal tip Blink URL:\n\n/api/actions/tip/${username}\n\nPrepend your app URL and share it anywhere — X, Discord, Telegram. Anyone can send you a SOL tip directly through their wallet. They'll see preset amounts (0.01, 0.05, 0.1, 0.5 SOL) or can enter a custom amount.`
    },
  },
  // --- Pool stats blink URL ---
  {
    patterns: ['pool blink', 'pool link', 'pool url', 'stats blink', 'stats link'],
    priority: 14,
    response: `Pool Stats Blink URLs (shows live stats + donate button):\n\n• /api/actions/pool/palestine-red-crescent\n• /api/actions/pool/turkish-red-crescent\n• /api/actions/pool/mercy-corps\n• /api/actions/pool/edhi-foundation\n• /api/actions/pool/orphanage-aid\n• /api/actions/pool/animal-rescue\n\nShare these on X to show real-time pool progress with a "Donate Now" button built in!`,
  },
  // --- How to donate (step-by-step) ---
  {
    patterns: ['how to donate', 'how do i donate', 'how can i donate', 'steps to donate', 'donate step'],
    priority: 14,
    response: `Here's how to donate on Umanity:\n\n1. Go to the Donate tab\n2. Choose a cause pool (or use One-Tap for instant 0.01 SOL)\n3. Enter your amount and click "Donate"\n4. Approve the transaction in your Solana wallet\n5. Done! Your donation is on-chain in seconds\n\nAfter donating you'll automatically:\n• Earn reward points (1 SOL = 1,000 pts)\n• Get a social post on your feed\n• Mint a soulbound Impact NFT\n• Build your donation streak`,
  },
  // --- How to vote ---
  {
    patterns: ['how to vote', 'how do i vote', 'how can i vote', 'cast vote', 'where to vote'],
    priority: 14,
    response: `To vote on governance proposals:\n\n1. Go to the Govern tab\n2. Browse active proposals (fund release votes, community proposals)\n3. Click on a proposal to see details\n4. Choose your option and submit your vote\n\nYour voting power = your reward points. You need Bloom tier (150+ impact score) to see and vote on proposals. Keep donating to level up!`,
  },
  // --- How to share impact card ---
  {
    patterns: ['share impact', 'impact card', 'share card', 'download card', 'share profile'],
    priority: 13,
    response: `To share your Impact Card:\n\n1. Go to your Profile tab\n2. Click the "Share Impact" button\n3. Preview your personalized impact card (shows your stats, tier, and donations)\n4. Choose "Download" to save as SVG or "Share on X" to post it directly\n\nYour card shows total SOL donated, donation count, tier, and reward points — a beautiful proof of your impact!`,
  },
  // --- How to follow people ---
  {
    patterns: ['how to follow', 'follow someone', 'follow people', 'find people', 'find users', 'discover people'],
    priority: 12,
    response: `To find and follow impact makers:\n\n1. Go to the Explore tab\n2. Search for usernames or browse suggested profiles\n3. Click "Follow" on anyone who inspires you\n4. Their donations and stories will appear in your Feed\n\nYou can also follow people from the onboarding flow when you first register. Following more people makes your feed richer!`,
  },
  // --- Where is my NFT ---
  {
    patterns: ['where is my nft', 'see my nft', 'find my nft', 'nft gallery', 'my nft', 'view nft'],
    priority: 13,
    response: `Your Impact NFTs are in your Profile tab — scroll down to the "Impact NFTs" gallery section. Each NFT shows the tier (Bronze/Silver/Gold/Diamond), cause name, amount donated, and date. They're soulbound to your wallet so they'll always be there!`,
  },
  // --- Specific pool donation with blink URL ---
  {
    patterns: ['donate to palestine', 'donate to gaza', 'donate palestine', 'donate gaza', 'give to palestine'],
    priority: 14,
    response: `To donate to Palestine Red Crescent:\n\n• In-app: Go to Donate tab → find "Palestine Red Crescent Society" → enter amount → confirm\n• Via Blink: Share this URL → /api/actions/donate/palestine-red-crescent\n• One-Tap: Quick 0.01 SOL donation from the Donate tab\n\nPRCS provides emergency medical aid, ambulance services, and disaster response for civilians in Palestine.`,
  },
  {
    patterns: ['donate to animal', 'donate animal', 'donate to street', 'give to animal'],
    priority: 14,
    response: `To donate to Street Animal Rescue:\n\n• In-app: Go to Donate tab → find "Street Animal Rescue" → enter amount → confirm\n• Via Blink: Share this URL → /api/actions/donate/animal-rescue\n\nOur team works directly with local rescuers — delivering food, medicine, and arranging vet care. Every rescue is documented with proof on @umanity_xyz.`,
  },
  {
    patterns: ['donate to edhi', 'donate edhi', 'give to edhi'],
    priority: 14,
    response: `To donate to Edhi Foundation:\n\n• In-app: Go to Donate tab → find "Edhi Foundation" → enter amount → confirm\n• Via Blink: Share this URL → /api/actions/donate/edhi-foundation\n\nEdhi runs the world's largest volunteer ambulance network and cares for thousands of orphans in Pakistan. A legendary humanitarian organization.`,
  },

  // ============================
  // GENERAL KNOWLEDGE (medium priority)
  // ============================

  // --- Donation recommendations ---
  {
    patterns: ['where should i donate', 'which pool', 'recommend', 'suggest', 'best pool', 'what to donate'],
    priority: 11,
    response: ({ poolStats }) => {
      const top = poolStats?.sort((a, b) => b.donorCount - a.donorCount)?.[0]
      return top
        ? `Our most popular pool right now is ${top.name} with ${top.donorCount} donors and ${top.totalDonated.toFixed(2)} SOL raised. But every cause matters:\n\n• Palestine Red Crescent — emergency medical aid\n• Turkish Red Crescent — earthquake/disaster recovery\n• Mercy Corps — food security & clean water\n• Edhi Foundation — ambulance network & orphan care\n• Orphanage Aid — Umanity delivers personally\n• Animal Rescue — Umanity delivers personally\n\nPick what resonates with you — head to the Donate tab to start!`
        : `We have 6 active pools:\n\n• Palestine Red Crescent — medical aid\n• Turkish Red Crescent — disaster relief\n• Mercy Corps — food & water\n• Edhi Foundation — humanitarian\n• Local Orphanage Aid — children\n• Street Animal Rescue — animals\n\nEach one is verified and funds are held in on-chain escrow. Head to the Donate tab — even 0.01 SOL makes an impact!`
    },
  },
  // --- Escrow / How it works ---
  {
    patterns: ['escrow', 'vault', 'how does umanity work', 'how it work', 'how do donation', 'where does money go', 'where do funds go', 'are funds safe', 'is it safe', 'transparent'],
    priority: 11,
    response: `Here's how Umanity escrow works:\n\n1. You donate SOL → goes to an Anchor smart contract\n2. Funds sit in an on-chain vault PDA — nobody can touch them\n3. Each pool has a campaign with 3 milestones (30%/30%/40%)\n4. When a milestone is hit, a DAO governance proposal is auto-created\n5. Community votes to approve or reject the fund release\n6. Approved funds → Umanity Org → physically delivered to charity\n7. Proof posted on @umanity_xyz on X\n\nEvery step is verifiable on Solscan. True transparency.`,
  },
  // --- Impact NFTs ---
  {
    patterns: ['impact nft', 'soulbound', 'certificate', 'what are nft', 'nft tier', 'nft badge'],
    exclude: ['where is', 'my nft', 'see my', 'find my', 'gallery'],
    priority: 10,
    response: `Impact NFTs are soulbound (non-transferable) certificates proving you made a difference:\n\n• Bronze — your first donation\n• Silver — donated 0.1+ SOL\n• Gold — donated 0.5+ SOL\n• Diamond — donated 1+ SOL\n\nEach shows the cause name, amount, and date. They live permanently on Solana in your profile gallery. Can't be sold or traded — pure proof of impact. Donate to any pool and you'll automatically get one!`,
  },
  // --- Trending / Pool stats ---
  {
    patterns: ['trending', 'popular', 'pool stats', 'how much raised', 'total raised', 'show me cause', 'show cause'],
    priority: 10,
    response: ({ poolStats }) => {
      if (poolStats && poolStats.length > 0) {
        const sorted = [...poolStats].sort((a, b) => b.totalDonated - a.totalDonated)
        const lines = sorted.map(p => `• ${p.name}: ${p.totalDonated.toFixed(2)} SOL (${p.donorCount} donors)`)
        const total = sorted.reduce((s, p) => s + p.totalDonated, 0)
        return `Here's what's trending:\n\n${lines.join('\n')}\n\nTotal across all pools: ${total.toFixed(2)} SOL. Every donation creates a social post, earns points, and mints an Impact NFT!`
      }
      return `Check the Donate tab to see live pool stats — each pool shows total SOL raised, donor count, and milestone progress. Our most active pools are Palestine Red Crescent and Edhi Foundation!`
    },
  },
  // --- Tiers ---
  {
    patterns: ['tier', 'level', 'seedling', 'sprout', 'bloom', 'champion', 'legend', 'luminary', 'impact score', 'level up'],
    priority: 9,
    response: `Umanity tier system based on Impact Score:\n\n• Seedling (0-49) — New member\n• Sprout (50-149) — Active donor\n• Bloom (150-299) — Unlocks governance voting\n• Champion (300-499) — Respected contributor\n• Legend (500-749) — Top tier\n• Luminary (750+) — Platform champion\n\nScore comes from donations, social activity, tips, and streaks. Higher tiers unlock governance and get more visibility. Keep giving to level up!`,
  },
  // --- Governance / DAO / Voting ---
  {
    patterns: ['governance', 'dao', 'voting', 'proposal', 'what is govern'],
    exclude: ['how to vote', 'how do i vote', 'cast vote'],
    priority: 10,
    response: `Umanity governance puts the community in control:\n\n• 1 SOL donated = 1,000 reward points = voting power\n• When a campaign milestone is reached, a fund-release proposal is auto-created\n• Bloom tier+ (150+ score) can see and vote on proposals\n• Votes are weighted by your donation history\n• If approved, funds go to Umanity Org for physical delivery\n\nGo to the Govern tab to see active proposals!`,
  },
  // --- Blinks (general) ---
  {
    patterns: ['what is blink', 'what are blink', 'explain blink', 'solana blink', 'solana action'],
    exclude: ['link', 'url', 'get', 'copy', 'share blink'],
    priority: 10,
    response: `Solana Blinks (Blockchain Links) let anyone interact with Umanity from anywhere on the internet!\n\n• Donate Blink — embed a donate button in any X post\n• Tip Blink — let people tip you via a URL\n• Pool Stats Blink — show live pool progress with donate CTA\n\nBlinks use Solana Actions — the transaction is built when the link is opened and the user signs with their wallet. No need to visit Umanity directly!\n\nWant the actual URLs? Ask me "give me the blink links"!`,
  },
  // --- Points / Rewards ---
  {
    patterns: ['points', 'reward point', 'earn points', 'how to earn', 'get points'],
    priority: 9,
    response: `Reward points fuel your Umanity journey:\n\n• 1 SOL donated = 1,000 points\n• Registration = 50 welcome points\n• Points = your voting power in governance\n• Points contribute to your Impact Score → tier level\n\nPoints aren't transferable — they represent real contributions. Keep donating to earn more and level up your tier!`,
  },
  // --- One-tap ---
  {
    patterns: ['one tap', 'one-tap', 'quick donat', 'instant donat', '0.01 sol', 'smallest donat', 'minimum donat'],
    priority: 9,
    response: `One-Tap Donation is the fastest way to give:\n\n• Just 0.01 SOL (~$0.77) with a single tap\n• Goes to the featured cause pool\n• Instantly earns points + creates a social post\n• Mints a soulbound Impact NFT\n• Counts toward your donation streak\n\nFind it at the top of the Donate tab. Perfect for building a daily giving habit!`,
  },
  // --- Streaks ---
  {
    patterns: ['streak', 'daily donat', 'consecutive', 'fire emoji', 'donation day'],
    priority: 9,
    response: `Donation streaks track your consecutive giving days!\n\n• Donate any amount on consecutive days to build your streak\n• At 3+ days you get a fire animation on your profile\n• Stats: current streak, best streak, total donation days\n• Shows a 7-day calendar view\n• Even 0.01 SOL keeps the streak alive!\n\nCheck your streak on your Profile tab. It's a fun way to make giving a daily habit.`,
  },
  // --- Social / Feed ---
  {
    patterns: ['feed', 'social feed', 'tapestry', 'social layer'],
    exclude: ['follow'],
    priority: 8,
    response: `Umanity's social feed is powered by Tapestry Protocol — a decentralized social graph on Solana:\n\n• See donations, stories, and votes from people you follow\n• Every donation auto-creates a social post\n• Like, comment, and share posts\n• Follow other impact makers\n• Governance proposals appear for Bloom+ tier users\n\nIt's a social network where philanthropy IS the content. Check the Feed tab!`,
  },
  // --- About Umanity ---
  {
    patterns: ['what is umanity', 'about umanity', 'tell me about umanity', 'what does umanity do', 'umanity mission', 'what is this app', 'what is this platform'],
    priority: 11,
    response: `Umanity is a community-driven philanthropy platform on Solana. We resurrect "dead" crypto categories — social, DAOs, NFTs — by giving them real purpose.\n\n• NFTs? Soulbound proof of impact, not speculation\n• DAOs? Vote on real fund releases, not empty proposals\n• Social? Every post is tied to giving, not clout\n\n6 verified charity pools, on-chain escrow, milestone-based releases, and Umanity Org physically delivers with proof on @umanity_xyz.\n\nWhere philanthropy IS the content.`,
  },
  // --- Solana ---
  {
    patterns: ['why solana', 'which blockchain', 'what chain', 'built on'],
    priority: 8,
    response: `Umanity is built on Solana for:\n\n• Near-instant transactions (<1 second)\n• Sub-cent fees (donate without losing value to gas)\n• Vibrant ecosystem (Anchor, Tapestry, Supabase)\n• Everything verifiable on Solscan\n\nDonations go through Anchor smart contracts, stored in on-chain vault PDAs. Solana's speed makes giving feel instant and social.`,
  },
  // --- Charity specifics ---
  {
    patterns: ['palestine', 'gaza', 'prcs', 'palestine red crescent'],
    exclude: ['donate to'],
    priority: 10,
    response: `Palestine Red Crescent Society (PRCS):\n\n• Emergency medical aid & relief for civilians in Palestine\n• One of the most trusted humanitarian organizations in the region\n• Provides healthcare, ambulance services, and disaster response\n• Typically our most funded pool — incredible community support\n\nDonate via the Donate tab or share the Blink: /api/actions/donate/palestine-red-crescent`,
  },
  {
    patterns: ['turkish', 'turkey', 'kizilay', 'earthquake'],
    priority: 10,
    response: `Turkish Red Crescent (Kizilay):\n\n• Earthquake recovery & disaster relief in Turkiye\n• At the forefront of rebuilding after the devastating 2023 earthquakes\n• Provides shelter, food, medical care, and long-term recovery\n\nDonate via the Donate tab or share: /api/actions/donate/turkish-red-crescent`,
  },
  {
    patterns: ['mercy corps', 'food security', 'clean water', 'hunger', 'famine'],
    priority: 10,
    response: `Mercy Corps:\n\n• Food security, clean water, and crisis response worldwide\n• Works in 40+ countries helping communities recover\n• Provides water systems, food distribution, and emergency supplies\n\nDonate via the Donate tab or share: /api/actions/donate/mercy-corps`,
  },
  {
    patterns: ['edhi', 'pakistan', 'ambulance network'],
    exclude: ['donate to'],
    priority: 10,
    response: `Edhi Foundation:\n\n• One of the world's largest charity trusts (Pakistan)\n• Runs the world's largest volunteer ambulance network\n• Cares for thousands of orphans\n• Founded by Abdul Sattar Edhi — lived in a single room his whole life\n\nDonate via the Donate tab or share: /api/actions/donate/edhi-foundation`,
  },
  {
    patterns: ['orphanage', 'orphan aid', 'children cause', 'kids cause'],
    exclude: ['donate to'],
    priority: 9,
    response: `Local Orphanage Aid:\n\n• Supplies, education materials, and care for orphanages\n• Umanity team personally visits and delivers — no middlemen\n• Every delivery documented with proof on @umanity_xyz\n\nDonate via the Donate tab or share: /api/actions/donate/orphanage-aid`,
  },
  {
    patterns: ['animal rescue', 'street animal', 'dog', 'cat', 'pet rescue'],
    exclude: ['donate to'],
    priority: 9,
    response: `Street Animal Rescue:\n\n• Rescue, shelter, and medical care for street animals\n• Umanity team works directly with local rescuers\n• Food, medicine, and veterinary care delivered personally\n• Every rescue documented on @umanity_xyz\n\nDonate via the Donate tab or share: /api/actions/donate/animal-rescue`,
  },
  // --- User's profile ---
  {
    patterns: ['my profile', 'my stats', 'my donation', 'my score', 'my tier', 'how am i doing', 'my progress', 'my impact'],
    priority: 12,
    response: ({ userStats }) => {
      if (userStats?.username) {
        const parts = [`Hey @${userStats.username}! Here's your summary:`]
        if (userStats.totalDonated !== undefined) parts.push(`\n• Total donated: ${userStats.totalDonated.toFixed(2)} SOL`)
        if (userStats.rewardPoints) parts.push(`• Reward points: ${userStats.rewardPoints}`)
        if (userStats.tier) parts.push(`• Current tier: ${userStats.tier}`)
        parts.push(`\nCheck your Profile tab for your full impact resume, streak calendar, and NFT gallery!`)
        return parts.join('')
      }
      return `Head to the Profile tab to see your impact score, donation history, streaks, and NFT gallery. Every donation gets tracked on-chain!`
    },
  },
  // --- Help / Getting started ---
  {
    patterns: ['get started', 'how to start', 'new here', 'first time', 'beginner', 'what should i do', 'what can i do'],
    priority: 9,
    response: `Here's how to get started on Umanity:\n\n1. Connect your Solana wallet (Phantom, Solflare, etc.)\n2. Register with a username → get 50 welcome points\n3. Follow impact makers in the Explore tab\n4. Go to Donate tab → try One-Tap (0.01 SOL)\n5. Watch your social post appear + NFT mint\n\nAfter that, explore governance voting, tipping, streaks, and sharing your Impact Card. What would you like to do first?`,
  },
  // --- Leaderboard ---
  {
    patterns: ['leaderboard', 'top donor', 'ranking', 'who donated most'],
    priority: 9,
    response: `The leaderboard shows top donors ranked by total SOL given. Find it on the Donate tab — see who's making the biggest impact! Rankings update in real-time as donations come in. Climb the ranks by donating to any pool.`,
  },
  // --- Tipping ---
  {
    patterns: ['tip someone', 'send tip', 'how to tip', 'tipping system'],
    priority: 9,
    response: `To tip someone on Umanity:\n\n1. Go to the Donate tab\n2. Scroll to the Tipping section\n3. Search for a username\n4. Enter an amount and send\n\nTips are instant SOL transfers — straight to their wallet, no escrow. You can also share your Tip Blink URL so anyone can tip you from anywhere!`,
  },
  // --- Milestones ---
  {
    patterns: ['milestone', 'campaign progress', 'fund release', 'how are funds released'],
    priority: 10,
    response: `Each charity pool has a campaign with 3 milestones (typically 30%/30%/40% of the target):\n\n1. As donations come in, milestone progress fills up\n2. When a threshold is crossed, a governance proposal is auto-created\n3. Community votes to approve the fund release\n4. Approved funds → Umanity Org → delivered to charity\n\nYou can see milestone progress bars on each pool card in the Donate tab.`,
  },
  // --- Wallet ---
  {
    patterns: ['wallet', 'connect wallet', 'phantom', 'solflare', 'which wallet'],
    priority: 9,
    response: `Umanity works with any Solana wallet:\n\n• Phantom (most popular)\n• Solflare\n• Backpack\n• And more via Wallet Adapter\n\nJust click "Connect Wallet" in the top-right corner. Make sure you're on Solana Devnet for now (the app will handle the network). You'll need some devnet SOL — get free SOL from a Solana faucet!`,
  },
  // --- Devnet / Testnet ---
  {
    patterns: ['devnet', 'testnet', 'mainnet', 'real money', 'real sol', 'free sol', 'faucet'],
    priority: 9,
    response: `Umanity is currently on Solana Devnet — donations use devnet SOL (free, not real money). To get devnet SOL:\n\n1. Go to faucet.solana.com\n2. Paste your wallet address\n3. Request an airdrop\n\nThis is perfect for trying all features — donate, vote, earn NFTs, build streaks — without spending real SOL. Mainnet launch coming soon!`,
  },
  // --- Share on X ---
  {
    patterns: ['share on x', 'share on twitter', 'post on x', 'tweet about', 'tell friends'],
    priority: 10,
    response: `Multiple ways to share Umanity on X:\n\n1. Impact Card — Go to Profile → "Share Impact" → posts your stats card\n2. Donation posts — Every donation auto-generates a shareable post with a Share-to-X button\n3. Blinks — Share donate/tip/pool URLs that work directly in X feeds\n4. Feed posts — Each post in your feed has a Share-to-X button\n\nAll shares tag @umanity_xyz. Spread the word and bring more donors!`,
  },
  // --- Referral ---
  {
    patterns: ['referral', 'invite', 'invite friend', 'refer'],
    priority: 8,
    response: `The best way to invite friends to Umanity:\n\n1. Share your Tip Blink URL — they can tip you and discover the platform\n2. Share a Donate Blink — they can donate directly from X\n3. Post your Impact Card on X — shows your stats and inspires others\n\nEvery new user who joins grows the community and strengthens governance. More donors = more impact!`,
  },
  // --- Security / Safety ---
  {
    patterns: ['is it safe', 'secure', 'security', 'scam', 'rug', 'trust'],
    priority: 11,
    response: `Umanity is designed for maximum trust:\n\n• All funds held in on-chain vault PDAs (smart contract escrow)\n• Nobody can withdraw without community DAO vote\n• Every transaction verifiable on Solscan\n• Milestone-based releases (not lump sum)\n• Umanity Org physically delivers and posts proof on X\n• Open-source Anchor programs\n\nYour donations are as safe as the Solana blockchain itself. True transparency, not trust-me promises.`,
  },
  // --- Who built this ---
  {
    patterns: ['who built', 'who made', 'team', 'creator', 'developer', 'built by'],
    priority: 9,
    response: `Umanity was built for the Solana Graveyard Hackathon 2026 — the mission is to resurrect "dead" crypto categories by giving them real purpose. The team physically delivers donations to verified charities and posts proof on @umanity_xyz. Follow us on X for delivery updates and proof of impact!`,
  },
  // --- Cost / Fee ---
  {
    patterns: ['cost', 'fee', 'gas fee', 'how much does it cost', 'transaction fee', 'is it free'],
    priority: 10,
    response: `Donating on Umanity costs almost nothing in fees:\n\n• Solana transaction fees: ~0.000005 SOL (fractions of a cent)\n• No platform fee — 100% of your donation goes to the cause pool\n• Minimum donation: 0.01 SOL (~$0.77)\n\nSolana's low fees mean nearly all your donation reaches the cause. No gas wars, no hidden costs.`,
  },
]

// ===== Conversational patterns (checked before knowledge base) =====
interface ConversationalPattern {
  test: (input: string) => boolean
  response: string | ((ctx: Ctx) => string)
}

const CONVERSATIONAL: ConversationalPattern[] = [
  // Greetings
  {
    test: (s) => /^(hi|hello|hey|yo|sup|gm|good morning|good evening|good afternoon|wassup|what'?s up|howdy|hola|salaam|salam|assalam)/i.test(s),
    response: ({ userStats }) => {
      const name = userStats?.username ? ` @${userStats.username}` : ''
      return `Hey${name}! I'm Umanity AI, your impact advisor. I can help you find the right cause to donate to, explain how our escrow system works, show you Blink URLs to share, or answer anything about the platform. What's on your mind?`
    },
  },
  // How are you / personal questions
  {
    test: (s) => /^(how are you|how r u|how're you|how you doing|you good|you okay|how do you feel|are you real|are you ai|are you a bot|are you human)/i.test(s),
    response: ({ userStats }) => {
      const name = userStats?.username ? `, @${userStats.username}` : ''
      return `I'm doing great${name}! Always energized when I get to help people make an impact. I'm Umanity's AI advisor — built to know everything about our 6 charity pools, escrow system, governance, NFTs, and more. What can I help you with today?`
    },
  },
  // Thanks
  {
    test: (s) => /^(thanks|thank you|thx|ty|appreciate|thank u|cheers)/i.test(s),
    response: `You're welcome! That's what I'm here for. If you have more questions about donating, pools, governance, Blinks, or anything else — just ask. Happy to help!`,
  },
  // Bye
  {
    test: (s) => /^(bye|goodbye|see ya|later|gotta go|cya|peace|gtg)/i.test(s),
    response: ({ userStats }) => {
      const name = userStats?.username ? ` @${userStats.username}` : ''
      return `See you${name}! Remember — even 0.01 SOL makes a difference. Keep building that streak and spreading the word. Take care!`
    },
  },
  // Yes / No / Ok
  {
    test: (s) => /^(yes|yeah|yep|sure|ok|okay|alright|got it|understood|cool|nice|great|awesome|perfect|sounds good|makes sense)/i.test(s),
    response: `Glad to hear that! Is there anything else you'd like to know about Umanity? I can help with pool recommendations, donation steps, Blink URLs, governance, NFTs, or anything else.`,
  },
  // Wow / reactions
  {
    test: (s) => /^(wow|whoa|amazing|incredible|impressive|that's cool|that's awesome|love it|love this)/i.test(s),
    response: `Right?! Umanity is building something special — on-chain transparency, community governance, and real impact. If you want to dive deeper into any feature or need help with anything, just ask!`,
  },
  // Profanity / frustration
  {
    test: (s) => /^(this sucks|doesn't work|broken|bug|error|not working|help me|i'm confused|confused|i don't understand|don't get it)/i.test(s),
    response: `Sorry to hear that! Let me try to help. Can you tell me what you're trying to do? Common things I can help with:\n\n• How to donate (step by step)\n• How to connect your wallet\n• How to find your NFTs\n• How to vote on proposals\n• How Blinks work\n\nJust describe what you need and I'll walk you through it!`,
  },
  // What can you do
  {
    test: (s) => /(what can you do|what do you know|your capabilities|what are you|who are you|what is this chat)/i.test(s),
    response: `I'm Umanity AI — your personal impact advisor! Here's what I can help with:\n\n• Recommend which cause to donate to\n• Explain how escrow, milestones, and governance work\n• Give you Blink URLs to share on X\n• Show pool stats and trending causes\n• Explain Impact NFTs and tier system\n• Walk you through any feature step-by-step\n• Answer questions about specific charities\n\nJust ask me anything about Umanity!`,
  },
  // Lol / humor
  {
    test: (s) => /^(lol|lmao|haha|😂|rofl|funny)/i.test(s),
    response: `Haha! Glad to keep things light. But seriously — while we're chatting, why not make a quick 0.01 SOL donation? Build that streak, earn some points, and feel good about it. Win-win!`,
  },
]

function getSmartResponse(input: string, ctx: Ctx): string {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()

  // 1. Check conversational patterns first (exact/prefix matches)
  for (const conv of CONVERSATIONAL) {
    if (conv.test(lower)) {
      return typeof conv.response === 'function' ? conv.response(ctx) : conv.response
    }
  }

  // 2. Score knowledge base entries with weighted multi-word phrase matching
  let bestMatch: KnowledgeEntry | null = null
  let bestScore = 0

  for (const entry of KNOWLEDGE_BASE) {
    // Check exclusions first
    if (entry.exclude?.some(ex => lower.includes(ex))) continue

    let score = 0
    let matchCount = 0

    for (const pattern of entry.patterns) {
      if (lower.includes(pattern)) {
        matchCount++
        // Multi-word phrases get bonus weight (more specific = better)
        const wordCount = pattern.split(' ').length
        score += wordCount * entry.priority
      }
    }

    if (matchCount > 0 && score > bestScore) {
      bestScore = score
      bestMatch = entry
    }
  }

  if (bestMatch) {
    return typeof bestMatch.response === 'function'
      ? bestMatch.response(ctx)
      : bestMatch.response
  }

  // 3. Check if it's a single word that might match a pool name
  for (const [keyword, poolId] of Object.entries(POOL_IDS)) {
    if (lower.includes(keyword)) {
      const meta: Record<string, string> = {
        'palestine-red-crescent': 'Palestine Red Crescent Society — emergency medical aid for civilians in Palestine. Donate: /api/actions/donate/palestine-red-crescent',
        'turkish-red-crescent': 'Turkish Red Crescent (Kizilay) — earthquake recovery & disaster relief in Turkiye. Donate: /api/actions/donate/turkish-red-crescent',
        'mercy-corps': 'Mercy Corps — food security, clean water & crisis response worldwide. Donate: /api/actions/donate/mercy-corps',
        'edhi-foundation': 'Edhi Foundation — world\'s largest volunteer ambulance network & orphan care in Pakistan. Donate: /api/actions/donate/edhi-foundation',
        'orphanage-aid': 'Local Orphanage Aid — supplies & education for orphanages, personally delivered by Umanity. Donate: /api/actions/donate/orphanage-aid',
        'animal-rescue': 'Street Animal Rescue — rescue, shelter & medical care, personally delivered by Umanity. Donate: /api/actions/donate/animal-rescue',
      }
      return meta[poolId] || ''
    }
  }

  // 4. Smart fallback with context-aware suggestions
  const name = ctx.userStats?.username ? `@${ctx.userStats.username}, h` : 'H'
  return `${name}mm, I'm not sure I have a specific answer for that. But I know a lot about Umanity! Try asking me:\n\n• "How do I donate?" — step-by-step guide\n• "Give me blink links" — shareable URLs\n• "Tell me about Edhi" — specific charity info\n• "What's my tier?" — your stats\n• "How does escrow work?" — transparency explained\n• "How do I vote?" — governance guide\n\nOr ask about any specific feature!`
}

// ===== Component =====

export function UmanityAgent({ poolStats, userStats }: UmanityAgentProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(1)

  // Set welcome message
  useEffect(() => {
    const welcomeContent = userStats?.username
      ? `Hey @${userStats.username}! I'm Umanity AI — your impact advisor. I can help you find the right cause, explain how our escrow works, or answer anything about the platform. What's on your mind?`
      : `Welcome to Umanity! I'm your AI impact advisor. I can help you discover causes, understand how on-chain donations work, or guide you through the platform. What would you like to know?`
    setMessages([{ id: 'welcome', role: 'assistant', content: welcomeContent }])
  }, [userStats?.username])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSend = async (text?: string) => {
    const msg = (text || inputValue).trim()
    if (!msg || isTyping) return
    setInputValue('')

    const userMsg: Message = {
      id: `user-${idCounter.current++}`,
      role: 'user',
      content: msg,
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    // Generate response with a natural typing delay
    const response = getSmartResponse(msg, { poolStats, userStats })

    // Simulate typing: ~30ms per character, min 400ms, max 1500ms
    const delay = Math.min(1500, Math.max(400, response.length * 12))

    setTimeout(() => {
      const assistantMsg: Message = {
        id: `assistant-${idCounter.current++}`,
        role: 'assistant',
        content: response,
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsTyping(false)
    }, delay)
  }

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[100px] lg:bottom-6 right-5 lg:right-6 z-[60] w-14 h-14 rounded-full shadow-2xl shadow-black/25 flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-200 text-gray-600 rotate-45 scale-95'
            : 'bg-[#111] text-white hover:scale-110 hover:shadow-black/40'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        )}
      </button>

      {/* Pulse ring when closed */}
      {!isOpen && (
        <div className="fixed bottom-[100px] lg:bottom-6 right-5 lg:right-6 z-[55] w-14 h-14 rounded-full bg-[#111]/20 animate-ping pointer-events-none" />
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-[170px] lg:bottom-[88px] right-5 lg:right-6 z-[60] w-[calc(100vw-2.5rem)] max-w-[400px] animate-in"
          style={{ maxHeight: 'calc(100vh - 10rem)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/15 border border-black/[0.04] overflow-hidden flex flex-col"
            style={{ height: 'min(520px, calc(100vh - 10rem))' }}
          >
            {/* Header */}
            <div className="bg-[#111] px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Umanity AI</p>
                <p className="text-white/40 text-[10px]">Impact advisor &middot; Always online</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-white/40">Online</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-[#111] flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
                      message.role === 'user'
                        ? 'bg-[#111] text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-lg bg-[#111] flex items-center justify-center mr-2 flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts (only show when few messages) */}
            {messages.length <= 2 && !isTyping && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => handleQuickPrompt(prompt.label)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5 border border-black/[0.04]"
                  >
                    <span>{prompt.icon}</span>
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex gap-2 flex-shrink-0 border-t border-black/[0.04]">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about causes, escrow, impact..."
                className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111]/10 transition-all placeholder:text-gray-300"
                disabled={isTyping}
              />
              <button
                onClick={() => handleSend()}
                disabled={isTyping || !inputValue.trim()}
                className="w-10 h-10 rounded-xl bg-[#111] text-white flex items-center justify-center flex-shrink-0 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:hover:bg-[#111]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
