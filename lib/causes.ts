/**
 * The causes Umanity runs. Every cause maps 1:1 to an on-chain Pool PDA seeded
 * by `id`, so changing an id means a new vault (free before the mainnet
 * deployment, a migration after it).
 *
 * All six are delivered in person by Umanity's field team in Pakistan: the
 * team buys the goods, delivers them, posts photos and receipts, the Impact
 * Oracle audits the proof, and the donors of that cause approve the release
 * from escrow. Nothing leaves a vault before that.
 *
 * `image` is representative photography (Unsplash licence) until the team's
 * own field photos replace it. Swap the URL and nothing else changes.
 */
export interface ImpactUnit {
  usd: number
  label: string // singular, e.g. "hot meal"
  plural?: string
}

export interface CauseMeta {
  id: string
  name: string
  shortName: string
  /** One line under the name. */
  tagline: string
  /** Longer story shown on the cause page. */
  story: string
  description: string
  category: string
  emoji: string
  /** Hero / card photo. */
  image: string
  imageAlt: string
  /** What a gift buys, smallest unit first. */
  units: ImpactUnit[]
  /** One-sentence version for cards. */
  impact: string
  deliveryMode: 'field' | 'partner'
  location: string
  website?: string
  /** Legacy tint class kept for data compatibility; the UI uses one accent. */
  color: string
}

const img = (id: string) => `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`

export const CAUSES: CauseMeta[] = [
  {
    id: 'orphan-care',
    name: 'Orphan care',
    shortName: 'Orphan care',
    tagline: 'Meals, school kits and winter clothing for children growing up in orphanages.',
    story:
      'Umanity visits orphanages in and around Karachi with the things the children actually asked for: hot meals, stationery and school bags, shoes and warm clothes before winter. Every visit is photographed, every purchase is receipted, and the donors who funded it approve the release before the money moves.',
    description: 'Meals, school kits and winter clothing for children in orphanages — delivered in person by the Umanity team.',
    category: 'Children',
    emoji: '🎒',
    image: img('photo-1622218479644-a8ef826bac87'),
    imageAlt: 'A young girl in a floral dress',
    units: [
      { usd: 1.5, label: 'hot meal' },
      { usd: 8, label: 'school kit' },
      { usd: 40, label: 'month of meals for one child', plural: 'months of meals for one child' },
    ],
    impact: '$8 is a full school kit for one child.',
    deliveryMode: 'field',
    location: 'Karachi, Pakistan',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'street-animals',
    name: 'Street animal rescue',
    shortName: 'Animal rescue',
    tagline: 'Food, vaccines and vet treatment for the dogs and cats who live on the street.',
    story:
      'Thousands of dogs and cats live on the streets of Karachi with no one responsible for them. The Umanity team runs feeding rounds, vaccinates against rabies and takes the injured ones to a vet. You see the animals you helped, the vet invoices, and the before-and-after.',
    description: 'Food, vaccines and vet care for street dogs and cats — delivered on the street by the Umanity team.',
    category: 'Animals',
    emoji: '🐾',
    image: img('photo-1667099521469-df09eb52c812'),
    imageAlt: 'A stray dog sleeping on a sidewalk',
    units: [
      { usd: 1, label: 'day of food for a stray', plural: 'days of food for strays' },
      { usd: 6, label: 'rabies vaccination' },
      { usd: 25, label: 'vet treatment' },
    ],
    impact: '$6 vaccinates one street dog against rabies.',
    deliveryMode: 'field',
    location: 'Karachi, Pakistan',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'family-meals',
    name: 'Family food packs',
    shortName: 'Food packs',
    tagline: 'Monthly ration packs for families who cannot cover the basics.',
    story:
      'A ration pack is flour, rice, lentils, cooking oil, sugar and tea: enough staples to feed a family of five for a month. The team buys in bulk from local wholesalers, packs, and hands them to families identified through community referrals. Receipts and distribution photos are posted after every round.',
    description: 'Monthly ration packs of flour, rice, lentils and oil for families below the line — bought and handed over by the Umanity team.',
    category: 'Hunger',
    emoji: '🍚',
    image: img('photo-1593113616828-6f22bca04804'),
    imageAlt: 'Volunteers packing food into bags',
    units: [
      { usd: 2, label: 'day of meals for a family', plural: 'days of meals for a family' },
      { usd: 30, label: 'monthly ration pack' },
    ],
    impact: '$30 feeds a family of five for a month.',
    deliveryMode: 'field',
    location: 'Karachi & interior Sindh, Pakistan',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'medical-help',
    name: 'Medical help',
    shortName: 'Medical help',
    tagline: 'Medicines, tests and treatment for patients who would otherwise go without.',
    story:
      'Public hospitals in Pakistan are free to enter and expensive to be treated in: patients are sent out to buy their own medicines, tests and supplies. Umanity pays the pharmacy and the lab directly for patients referred by hospital social workers, and posts the prescriptions and invoices.',
    description: 'Medicines, lab tests and treatment costs paid directly to pharmacies and labs for patients who cannot afford them.',
    category: 'Health',
    emoji: '💊',
    image: img('photo-1758691462126-2ee47c8bf9e7'),
    imageAlt: 'A doctor consulting with a mother and her child',
    units: [
      { usd: 5, label: 'course of medicine', plural: 'courses of medicine' },
      { usd: 20, label: 'doctor visit with tests', plural: 'doctor visits with tests' },
      { usd: 100, label: 'minor procedure' },
    ],
    impact: '$20 covers a consultation and the tests that go with it.',
    deliveryMode: 'field',
    location: 'Karachi, Pakistan',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'clean-water',
    name: 'Clean water',
    shortName: 'Clean water',
    tagline: 'Hand pumps and household filters for villages without safe drinking water.',
    story:
      'In parts of interior Sindh the nearest safe water is hours away and the nearest water is not safe. A household filter removes the bacteria that make children sick; a hand pump serves a whole hamlet for years. The team installs with local masons and posts the location of every pump.',
    description: 'Hand pumps and household water filters installed in villages without safe drinking water, with the location of every pump published.',
    category: 'Water',
    emoji: '💧',
    image: img('photo-1760873059715-7c7cfbe2a2c6'),
    imageAlt: 'Children standing by a village water pump',
    units: [
      { usd: 10, label: 'household water filter' },
      { usd: 150, label: 'share of a hand pump', plural: 'shares of a hand pump' },
    ],
    impact: '$10 gives one family a water filter.',
    deliveryMode: 'field',
    location: 'Interior Sindh, Pakistan',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'emergency-relief',
    name: 'Emergency relief',
    shortName: 'Emergency relief',
    tagline: 'Tents, blankets and food when floods or winter hit the families with the least.',
    story:
      'When the rivers rise or the temperature drops, the same families lose everything first. This vault stays funded so the team can move within days: tents, blankets, dry rations and clean water, bought locally and delivered by road. Every deployment is documented from purchase to hand-over.',
    description: 'Tents, blankets, dry rations and water for families hit by floods or winter, bought locally and delivered by the Umanity team.',
    category: 'Emergency',
    emoji: '⛺',
    image: img('photo-1727475807045-cac6e292e2b6'),
    imageAlt: 'A young boy sitting outside a tent',
    units: [
      { usd: 5, label: 'blanket' },
      { usd: 25, label: 'family relief kit' },
      { usd: 120, label: 'tent for a family', plural: 'tents for families' },
    ],
    impact: '$25 is a complete relief kit for one family.',
    deliveryMode: 'field',
    location: 'Sindh & Balochistan, Pakistan',
    color: 'bg-emerald-50 text-emerald-700',
  },
]

export const CAUSE_IDS = CAUSES.map((c) => c.id)
export const DEFAULT_CAUSE_ID = 'orphan-care'
export function getCause(id: string): CauseMeta | undefined {
  return CAUSES.find((c) => c.id === id)
}

/** "≈ 12 hot meals" for a USD amount, using the largest unit that fits at least once. */
export function describeImpact(cause: Pick<CauseMeta, 'units'>, usd: number): string | null {
  if (!(usd > 0) || !cause.units.length) return null
  const sorted = [...cause.units].sort((a, b) => b.usd - a.usd)
  const unit = sorted.find((u) => usd >= u.usd) ?? sorted[sorted.length - 1]
  const n = Math.floor(usd / unit.usd)
  if (n < 1) return `${Math.round((usd / unit.usd) * 100)}% of a ${unit.label}`
  const label = n === 1 ? unit.label : unit.plural ?? `${unit.label}s`
  return `${n} ${label}`
}
