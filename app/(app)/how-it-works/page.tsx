import { redirect } from 'next/navigation'

/** The story now lives on the landing page and in Govern. */
export default function HowItWorks() {
  redirect('/?stay=1')
}
