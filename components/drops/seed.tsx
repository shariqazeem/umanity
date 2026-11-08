'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { DropView, MoneySummary } from '@/lib/umanity/data'
import type { HomeItem } from '@/lib/umanity/feed'

export type Seed = { drops?: DropView[] | null; money?: MoneySummary | null; feed?: HomeItem[] | null }

const SeedContext = createContext<Seed>({})

/** Data the server already loaded for this page, so it arrives rendered. The hooks keep it live from there. */
export function SeedProvider({ seed, children }: { seed: Seed; children: ReactNode }) {
  return <SeedContext.Provider value={seed}>{children}</SeedContext.Provider>
}

export const useSeed = () => useContext(SeedContext)
