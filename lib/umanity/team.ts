/**
 * Wallets that belong to the Umanity team. Their gifts and buys are real and stay on the chain and the
 * Money page, but they are never shown or counted as community: not on leaderboards, not in "outside"
 * totals, and their test gifts fold into one line in the feed. UMANITY_TEAM_WALLETS (comma-separated)
 * adds more, for example devnet wallets. Server-only.
 */
const BUILT_IN = [
  '9ENSaVDf8wfWBXoESQrrrnaJPkf9QNexTMW6kjgmx5ex', // the founder's Umanity wallet (@shariq)
  'GZ3KCgLfbxZrdU2Fr5LkJbMzPkWNyE5RWXoFkeCXLmJx', // @umanity
  'EsWeMEvuLDV2Q4CXigZbETzqXfEQwZntQjwD4Cy8AgY5', // the founder's Phantom, also the ops wallet
  'EHpKgb5eMJqjvQc3NgGXV691EbnmteyK1H5jc8zP8nvo', // server: admin and release key
  'CePurah441FneFNjafjzcUYKPR8e2ozsAAUs5YtAFvEU', // treasury: pays network fees
  'CKpWC4cWAKqKPrAu2YKydQh1DGwpFK3oVscx6sdLYwLR', // deployer
]

export const TEAM_WALLETS = [
  ...new Set([
    ...BUILT_IN,
    ...(process.env.UMANITY_TEAM_WALLETS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]),
]

const TEAM = new Set(TEAM_WALLETS)

/** True when any of the given addresses (a backer, a giver, the account credited) is the team's. */
export const isTeam = (...addresses: (string | null | undefined)[]) => addresses.some((a) => !!a && TEAM.has(a))
