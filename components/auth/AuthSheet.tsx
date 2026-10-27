'use client'

/**
 * Sign-in. Two doors: create a Umanity wallet in one tap, or connect Phantom,
 * Solflare, Backpack and friends. Then an optional name. Nothing blocks.
 */
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Icon, Field, Pill } from '@/components/shared/ui'
import { apiSend } from '@/lib/client/api'
import type { PublicUser } from '@/lib/data/users'

export function AuthSheet() {
  const { authOpen, closeAuth, signer, user, createWallet, connectWallet, importWallet, toast, refreshUser, isMainnet } = useUmanity()
  const [step, setStep] = useState<'choose' | 'name' | 'import'>('choose')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [secret, setSecret] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  // When a signer appears while the sheet is open, move to the name step
  // (unless the account already has a claimed handle).
  useEffect(() => {
    if (!authOpen) return
    if (signer && step !== 'name') {
      if (user?.handleClaimed) closeAuth()
      else setStep('name')
    }
  }, [signer, authOpen, step, user?.handleClaimed, closeAuth])

  useEffect(() => {
    if (!authOpen) {
      setStep('choose')
      setSecret('')
      setError('')
      setBusy(false)
    }
  }, [authOpen])

  const create = async () => {
    setCreating(true)
    setStep('name')
    const r = await createWallet()
    setCreating(false)
    if (!r.ok) {
      setStep('choose')
      return toast(r.error || 'Could not create a wallet', 'err')
    }
    if (!isMainnet) toast(r.funded ? 'Wallet created and topped up with devnet SOL.' : 'Wallet created.', 'ok')
  }

  const doImport = () => {
    const r = importWallet(secret)
    if (!r.ok) return setError(r.error || 'Invalid key')
    setSecret('')
    setStep('name')
  }

  const saveName = async () => {
    if (!signer) return
    setBusy(true)
    setError('')
    const r = await apiSend<{ success: boolean; error?: string; user?: PublicUser }>('/api/register', { address: signer.publicKey.toBase58(), username, displayName: displayName || undefined })
    setBusy(false)
    if (!r.success) return setError(r.error || 'That name is not available')
    await refreshUser()
    toast(`Welcome, @${username}.`, 'ok')
    closeAuth()
  }

  return (
    <Sheet open={authOpen} onClose={closeAuth} width="sm" hideClose={false}>
      {step === 'choose' && (
        <div className="pt-1">
          <h3 className="font-display text-[30px] leading-[1.05] text-[#1d1d1f]">Start giving.</h3>
          <p className="text-[14px] text-[#6e6e73] mt-2 leading-relaxed">A wallet is your account. Create one in a tap, or use one you already have.</p>

          <button onClick={create} disabled={creating} className="mt-6 w-full text-left rounded-2xl border border-black/[0.08] hover:border-[#1d1d1f] p-4 transition-colors group disabled:opacity-60">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center">
                <Icon name="bolt" size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">Create a Umanity wallet</span>
                <span className="block text-[12.5px] text-[#6e6e73]">Ready instantly. Self-custodial, lives in this browser. Back it up any time.</span>
              </span>
              <Icon name="arrowRight" size={18} className="text-[#aeaeb2] group-hover:text-[#1d1d1f] transition-colors" />
            </div>
          </button>

          <button onClick={connectWallet} className="mt-2.5 w-full text-left rounded-2xl border border-black/[0.08] hover:border-[#1d1d1f] p-4 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-black/[0.05] text-[#1d1d1f] flex items-center justify-center">
                <Icon name="wallet" size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">Connect a wallet</span>
                <span className="block text-[12.5px] text-[#6e6e73]">Phantom, Solflare, Backpack and any Wallet Standard wallet.</span>
              </span>
              <Icon name="arrowRight" size={18} className="text-[#aeaeb2] group-hover:text-[#1d1d1f] transition-colors" />
            </div>
          </button>

          <div className="flex items-center justify-between mt-5">
            <button onClick={() => setStep('import')} className="text-[12.5px] text-[#6e6e73] hover:text-[#1d1d1f] underline underline-offset-2">
              Import a secret key
            </button>
            {!isMainnet && <Pill tone="gray">Devnet</Pill>}
          </div>
        </div>
      )}

      {step === 'import' && (
        <div className="pt-1">
          <button onClick={() => setStep('choose')} className="text-[12.5px] text-[#6e6e73] hover:text-[#1d1d1f] inline-flex items-center gap-1 mb-3">
            <Icon name="chevronLeft" size={14} /> Back
          </button>
          <h3 className="text-[22px] font-bold tracking-[-0.02em]">Import a wallet</h3>
          <p className="text-[13px] text-[#6e6e73] mt-1">Paste a base58 secret key (Phantom export) or a JSON byte array. It is stored only in this browser.</p>
          <textarea value={secret} onChange={(e) => setSecret(e.target.value)} rows={3} placeholder="4xk…  or  [12, 84, …]" className="input mt-4 font-mono !text-[12px]" />
          {error && <p className="text-[12.5px] text-[#c53030] mt-2">{error}</p>}
          <Btn full size="lg" className="mt-4" onClick={doImport} disabled={secret.trim().length < 40}>
            Import
          </Btn>
        </div>
      )}

      {step === 'name' && (
        <div className="pt-1">
          <h3 className="font-display text-[30px] leading-[1.05]">What should we call you?</h3>
          <p className="text-[14px] text-[#6e6e73] mt-2">Your name appears next to your gifts. You can change it later.</p>
          <div className="space-y-3 mt-5">
            <Field label="Username">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aeaeb2]">@</span>
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))} placeholder="yourname" className="input !pl-9" autoFocus />
              </div>
            </Field>
            <Field label="Display name" hint="Optional">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 50))} placeholder="Your name" className="input" />
            </Field>
          </div>
          {error && <p className="text-[12.5px] text-[#c53030] mt-3">{error}</p>}
          <div className="flex gap-2 mt-5">
            <Btn tone="secondary" size="lg" className="flex-1" onClick={closeAuth}>
              Skip
            </Btn>
            <Btn size="lg" className="flex-[2]" onClick={saveName} loading={busy} disabled={username.length < 3}>
              Continue
            </Btn>
          </div>
        </div>
      )}
    </Sheet>
  )
}
