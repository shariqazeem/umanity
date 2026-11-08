'use client'

/**
 * Locking and unlocking the Umanity wallet. The session opens this sheet
 * whenever something needs a signature and the wallet is locked, or when an
 * old wallet still has to be locked before it holds real money.
 */
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Icon } from '@/components/shared/ui'
import { MIN_PASSCODE, PasskeyUnavailable, unlockWithPasscode, unlockWithPasskey, type Vault } from '@/lib/client/wallet'

/** What this device calls its passkey: "Face ID or Touch ID", "Windows Hello"… */
export function passkeyName() {
  if (typeof navigator === 'undefined') return 'a passkey'
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Windows/.test(ua)) return 'Windows Hello'
  if (/Android/.test(ua)) return 'your fingerprint'
  return 'a passkey'
}

export function UnlockSheet() {
  const { unlockPrompt, answerUnlock } = useUmanity()
  return (
    <Sheet open={!!unlockPrompt} onClose={() => answerUnlock(false)} width="sm">
      {unlockPrompt?.mode === 'unlock' && <Unlock key={unlockPrompt.vault.address} vault={unlockPrompt.vault} reason={unlockPrompt.reason} onDone={answerUnlock} />}
      {unlockPrompt?.mode === 'protect' && (
        <div className="pt-1">
          <ProtectChoice intro={unlockPrompt.reason} onDone={() => answerUnlock(true)} />
          <button onClick={() => answerUnlock(false)} className="block mx-auto mt-4 text-[12.5px] text-[#86868b] hover:text-[#1d1d1f]">
            Not now
          </button>
        </div>
      )}
    </Sheet>
  )
}

function Unlock({ vault, reason, onDone }: { vault: Vault; reason: string; onDone: (ok: boolean) => void }) {
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = passkeyName()

  const withPasskey = async () => {
    setBusy(true)
    setError('')
    try {
      await unlockWithPasskey(vault)
      onDone(true)
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? 'Cancelled. Tap to try again.' : (e as Error).message || 'It did not unlock. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const withPasscode = async () => {
    if (!passcode) return
    setBusy(true)
    setError('')
    try {
      await unlockWithPasscode(vault, passcode)
      onDone(true)
    } catch (e) {
      setError((e as Error).message)
      setPasscode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-1">
      <span className="w-12 h-12 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center">
        <Icon name="lock" size={22} />
      </span>
      <h3 className="text-[22px] font-bold tracking-[-0.02em] mt-4">Unlock your wallet</h3>
      <p className="text-[14px] text-[#86868b] mt-1.5">{reason}</p>

      {vault.method === 'passkey' ? (
        <Btn full size="lg" className="mt-5" onClick={withPasskey} loading={busy} icon="key">
          Unlock with {name}
        </Btn>
      ) : (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            withPasscode()
          }}
        >
          <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Your passcode" autoComplete="current-password" className="input w-full" autoFocus />
          <Btn full size="lg" className="mt-3" type="submit" loading={busy} disabled={!passcode}>
            Unlock
          </Btn>
        </form>
      )}
      {error && <p className="text-[12.5px] text-[#c53030] mt-3">{error}</p>}
      <button onClick={() => onDone(false)} className="block mx-auto mt-4 text-[12.5px] text-[#86868b] hover:text-[#1d1d1f]">
        Cancel
      </button>
    </div>
  )
}

/** One decision: lock the new wallet with a passkey, or with a passcode. */
export function ProtectChoice({ onDone, intro }: { onDone: () => void; intro?: string }) {
  const { protectWallet, canUsePasskeys } = useUmanity()
  const [mode, setMode] = useState<'choose' | 'passcode'>('choose')
  const [passcode, setPasscode] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = passkeyName()

  useEffect(() => {
    if (canUsePasskeys === false) setMode('passcode')
  }, [canUsePasskeys])

  const withPasskey = async () => {
    setBusy(true)
    setError('')
    const r = await protectWallet({ passkey: true })
    setBusy(false)
    if (r.ok) return onDone()
    if (r.error === 'Cancelled') return
    setError(r.error || 'It did not work')
    if (r.error === new PasskeyUnavailable().message) setMode('passcode')
  }

  const withPasscode = async () => {
    if (passcode.length < MIN_PASSCODE) return setError(`Use at least ${MIN_PASSCODE} characters`)
    if (passcode !== repeat) return setError('The two passcodes are different')
    setBusy(true)
    setError('')
    const r = await protectWallet({ passcode })
    setBusy(false)
    if (r.ok) return onDone()
    setError(r.error || 'It did not work')
  }

  return (
    <div>
      <h3 className="text-[24px] font-bold tracking-[-0.02em] text-[#1d1d1f]">Lock your wallet</h3>
      <p className="text-[14px] text-[#86868b] mt-2 leading-relaxed">{intro ?? 'Your key is sealed on this device. Only you can open it, and only to sign.'}</p>

      {mode === 'choose' ? (
        <>
          <button onClick={withPasskey} disabled={busy} className="mt-6 w-full text-left rounded-2xl border border-black/[0.08] hover:border-[#1d1d1f] p-4 transition-colors group disabled:opacity-60">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center">
                <Icon name="key" size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">{busy ? 'Waiting for you…' : `Use ${name}`}</span>
                <span className="block text-[12.5px] text-[#86868b]">A passkey on this device or your phone. Nothing to remember.</span>
              </span>
              <Icon name="arrowRight" size={18} className="text-[#aeaeb2] group-hover:text-[#1d1d1f] transition-colors" />
            </div>
          </button>
          <button onClick={() => (setMode('passcode'), setError(''))} className="mt-2.5 w-full text-left rounded-2xl border border-black/[0.08] hover:border-[#1d1d1f] p-4 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-black/[0.05] text-[#1d1d1f] flex items-center justify-center">
                <Icon name="lock" size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">Use a passcode</span>
                <span className="block text-[12.5px] text-[#86868b]">{MIN_PASSCODE} or more characters, asked when you give.</span>
              </span>
              <Icon name="arrowRight" size={18} className="text-[#aeaeb2] group-hover:text-[#1d1d1f] transition-colors" />
            </div>
          </button>
        </>
      ) : (
        <form
          className="mt-5 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            withPasscode()
          }}
        >
          <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder={`Passcode, ${MIN_PASSCODE}+ characters`} autoComplete="new-password" className="input w-full" autoFocus />
          <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} placeholder="Repeat it" autoComplete="new-password" className="input w-full" />
          <Btn full size="lg" type="submit" loading={busy} disabled={!passcode || !repeat}>
            Lock wallet
          </Btn>
          <p className="text-[12px] text-[#86868b] leading-relaxed">If you forget it and lose your backup, nobody can open this wallet. Back it up from Wallet once it has money in it.</p>
          {canUsePasskeys && (
            <button type="button" onClick={() => (setMode('choose'), setError(''))} className="text-[12.5px] text-[#86868b] hover:text-[#1d1d1f]">
              Use {name} instead
            </button>
          )}
        </form>
      )}
      {error && <p className="text-[12.5px] text-[#c53030] mt-3">{error}</p>}
    </div>
  )
}
