'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { DropDetail, DropView, MoneySummary } from '@/lib/umanity/data'
import type { HomeItem, TopBacker } from '@/lib/umanity/feed'

export type Seed = { drops?: DropView[] | null; drop?: DropDetail | null; money?: MoneySummary | null; feed?: HomeItem[] | null; backers?: TopBacker[] | null }

const SeedContext = createContext<Seed>({})

/** Data the server already loaded for this page, so it arrives rendered. The hooks keep it live from there. */
export function SeedProvider({ seed, children }: { seed: Seed; children: ReactNode }) {
  // A page's seed adds to the layout's; what the page loaded wins.
  const parent = useContext(SeedContext)
  return <SeedContext.Provider value={{ ...parent, ...seed }}>{children}</SeedContext.Provider>
}

export const useSeed = () => useContext(SeedContext)
