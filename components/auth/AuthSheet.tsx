'use client'

/**
 * Sign-in. Two doors: create a Umanity wallet in one tap (then lock it with
 * Face ID or a passcode), or connect Phantom, Solflare, Backpack and friends.
 * Then an optional name.
 */
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Icon, Field } from '@/components/shared/ui'
import { ProtectChoice } from '@/components/wallet/UnlockSheet'
import { apiSend } from '@/lib/client/api'
import type { PublicUser } from '@/lib/data/users'

export function AuthSheet() {
  const { authOpen, closeAuth, signer, user, startNewWallet, connectWallet, startImport, toast, refreshUser, canUsePasskeys, signInWithPasskey } = useUmanity()
  const [step, setStep] = useState<'choose' | 'import' | 'protect' | 'name'>('choose')
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  // When a signer appears while the sheet is open, move to the name step
  // (unless the account already has a claimed handle).
  useEffect(() => {
    if (!authOpen) return
    if (signer && step !== 'name' && step !== 'protect') {
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

  const create = () => {
    startNewWallet()
    setStep('protect')
  }

  const passkeyIn = async () => {
    setBusy(true)
    setError('')
    const r = await signInWithPasskey()
    setBusy(false)
    if (r.ok) toast('Welcome back.', 'ok')
    else if (r.error) setError(r.error)
  }

  const doImport = () => {
    const r = startImport(secret)
    if (!r.ok) return setError(r.error || 'Invalid key')
    setSecret('')
    setError('')
    setStep('protect')
  }

  const locked = () => {
    if (user?.handleClaimed) {
      toast('Wallet locked and ready.', 'ok')
      closeAuth()
    } else setStep('name')
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
          <h3 className="text-[24px] font-bold tracking-[-0.02em] text-[#1d1d1f]">Start giving.</h3>
          <p className="text-[14px] text-[#86868b] mt-2 leading-relaxed">A wallet is your account. Create one in a tap, or use one you already have.</p>

          <button onClick={create} className="mt-6 w-full text-left rounded-2xl border border-black/[0.08] hover:border-[#1d1d1f] p-4 transition-colors group disabled:opacity-60">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center">
                <Icon name="bolt" size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">Create a Umanity wallet</span>
                <span className="block text-[12.5px] text-[#86868b]">Ready in a tap, locked with Face ID or a passcode. Yours alone.</span>
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
                <span className="block text-[12.5px] text-[#86868b]">Phantom, Solflare, Backpack and any Wallet Standard wallet.</span>
              </span>
              <Icon name="arrowRight" size={18} className="text-[#aeaeb2] group-hover:text-[#1d1d1f] transition-colors" />
            </div>
          </button>

          {canUsePasskeys && (
            <button onClick={passkeyIn} disabled={busy} className="mt-2.5 w-full text-left rounded-2xl border border-black/[0.08] hover:border-[#1d1d1f] p-4 transition-colors group disabled:opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 text-[18px]">◉</div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold">{busy ? 'Opening your wallet…' : 'I have a Umanity wallet'}</span>
                  <span className="block text-[12.5px] text-[#86868b]">Sign in with Face ID or Touch ID, on any device your passkey syncs to.</span>
                </div>
                <Icon name="arrowRight" size={18} className="text-[#aeaeb2] group-hover:text-[#1d1d1f] transition-colors" />
              </div>
            </button>
          )}
          {error && step === 'choose' && <p className="mt-3 text-[12.5px] text-red-600">{error}</p>}

          <div className="mt-5">
            <button onClick={() => setStep('import')} className="text-[12.5px] text-[#86868b] hover:text-[#1d1d1f] underline underline-offset-2">
              Import a secret key
            </button>
          </div>
        </div>
      )}

      {step === 'import' && (
        <div className="pt-1">
          <button onClick={() => setStep('choose')} className="text-[12.5px] text-[#86868b] hover:text-[#1d1d1f] inline-flex items-center gap-1 mb-3">
            <Icon name="chevronLeft" size={14} /> Back
          </button>
          <h3 className="text-[22px] font-bold tracking-[-0.02em]">Import a wallet</h3>
          <p className="text-[13px] text-[#86868b] mt-1">Paste a secret key exported from Phantom, or a Solana CLI key file. You lock it next; it never leaves this device unsealed.</p>
          <textarea value={secret} onChange={(e) => setSecret(e.target.value)} rows={3} placeholder="4xk…  or  [12, 84, …]" className="input mt-4 font-mono !text-[12px]" />
          {error && <p className="text-[12.5px] text-[#c53030] mt-2">{error}</p>}
          <Btn full size="lg" className="mt-4" onClick={doImport} disabled={secret.trim().length < 40}>
            Import
          </Btn>
        </div>
      )}

      {step === 'protect' && (
        <div className="pt-1">
          <ProtectChoice onDone={locked} />
        </div>
      )}

      {step === 'name' && (
        <div className="pt-1">
          <h3 className="text-[24px] font-bold tracking-[-0.02em]">What should we call you?</h3>
          <p className="text-[14px] text-[#86868b] mt-2">Your name appears next to your gifts. You can change it later.</p>
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
