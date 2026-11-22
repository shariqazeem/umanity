/**
 * The fund's public finish line, when one is set: the first filmed drop opens once this many wallets
 * from outside the team have given to the fund, or on the date, whichever comes first. Off unless
 * NEXT_PUBLIC_FUND_GOAL is set (NEXT_PUBLIC_FUND_GOAL_DATE is YYYY-MM-DD and optional).
 */
export const FUND_GOAL = Number(process.env.NEXT_PUBLIC_FUND_GOAL || 0) > 0 ? Number(process.env.NEXT_PUBLIC_FUND_GOAL) : null
const date = process.env.NEXT_PUBLIC_FUND_GOAL_DATE || ''
export const FUND_GOAL_DATE = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null

/** "Tue 12 Jan" */
export const goalDateText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
