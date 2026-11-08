'use client'

/** Your wallet: USDC to give with, the address, how it's locked, backup, sign out. */
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Icon, Pill, CopyButton, AccountLink } from '@/components/shared/ui'
import { fmtSol, short } from '@/lib/client/api'
import { usdText } from '@/lib/umanity/drops'
import { useUsdcBalance } from '@/components/drops/hooks'
import { passkeyName } from './UnlockSheet'

export function WalletSheet() {
  const { walletSheetOpen, closeWalletSheet, signer, local, walletMethod, walletLocked, balance, isMainnet, requestFaucet, forgetWallet, disconnectWallet, connectWallet, refreshBalance, ensureUnlocked, lockNow, revealSecretKey, toast } = useUmanity()
  const { usd, refresh: refreshUsdc } = useUsdcBalance(signer?.publicKey ?? null)
  const [secret, setSecret] = useState<string | null>(null)
  const [confirmForget, setConfirmForget] = useState(false)
  const [busy, setBusy] = useState(false)
  const address = signer?.publicKey.toBase58() ?? ''
  const isLocal = signer?.kind === 'local' && !!local

  const faucet = async () => {
    setBusy(true)
    const r = await requestFaucet()
    setBusy(false)
    toast(r.ok ? (r.funded ? 'Topped up with devnet SOL.' : 'This wallet is already funded.') : r.error || 'Faucet failed', r.ok ? 'ok' : 'err')
  }

  const showSecret = async () => {
    const s = await revealSecretKey()
    if (s) setSecret(s)
  }

  const close = () => {
    setSecret(null)
    setConfirmForget(false)
    closeWalletSheet()
  }

  const lockLabel = walletMethod === 'passkey' ? `Locked with ${passkeyName()}` : walletMethod === 'passcode' ? 'Locked with a passcode' : 'Not locked yet'

  return (
    <Sheet open={walletSheetOpen} onClose={close} width="sm" title="Wallet">
      {!signer ? (
        <div className="py-6 text-center">
          <p className="text-[14px] text-[#86868b]">No wallet yet.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-black/[0.06] rounded-2xl p-2">
              <QRCodeSVG value={address} size={84} />
            </div>
            <div className="min-w-0 flex-1">
              <Pill tone={isLocal ? 'dark' : 'gray'}>{isLocal ? 'Umanity wallet' : 'Connected'}</Pill>
              <p className="num text-[26px] font-bold mt-1.5 leading-none">{usd == null ? '…' : usdText(usd, 2)}</p>
              <p className="text-[12px] text-[#86868b] mt-1 num">USDC to give with{balance != null ? ` · ${fmtSol(balance, 3)} SOL` : ''}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#fafafa] border border-black/[0.06] p-3.5">
            <p className="eyebrow mb-1">Address</p>
            <p className="num text-[12.5px] break-all">{address}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <CopyButton text={address} label="Copy" />
              <AccountLink address={address} label="View on Solscan" />
              <button
                onClick={() => {
                  refreshBalance()
                  refreshUsdc()
                }}
                className="ml-auto text-[#86868b] hover:text-[#1d1d1f] w-11 h-11 -m-2 flex items-center justify-center"
                title="Refresh balance"
                aria-label="Refresh balance"
              >
                <Icon name="refresh" size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="eyebrow mb-2">Add money</p>
            <p className="text-[13px] text-[#86868b] leading-relaxed">Send USDC on Solana to this address from any wallet or exchange. Holding it somewhere else? Give from another chain right in the give sheet. You never need SOL: Umanity pays the network fee.</p>
            {!isMainnet && (
              <Btn tone="outline" size="md" className="mt-3" onClick={faucet} loading={busy} icon="bolt">
                Get devnet SOL
              </Btn>
            )}
          </div>

          {isLocal && (
            <div className="mt-5 pt-4 border-t border-black/[0.06]">
              <p className="eyebrow mb-2">Security</p>
              <div className="flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center ${walletMethod === 'unprotected' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Icon name={walletMethod === 'unprotected' ? 'unlock' : 'lock'} size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold">{lockLabel}</span>
                  <span className="block text-[12px] text-[#86868b]">{walletMethod === 'unprotected' ? 'Its key is not sealed on this device.' : walletLocked ? 'Asked for when you give.' : 'Unlocked for now; it locks itself after 15 idle minutes.'}</span>
                </span>
                {walletMethod === 'unprotected' ? (
                  <Btn size="sm" onClick={() => ensureUnlocked()}>
                    Lock it
                  </Btn>
                ) : (
                  !walletLocked && (
                    <Btn
                      tone="secondary"
                      size="sm"
                      onClick={() => {
                        lockNow()
                        setSecret(null)
                      }}
                    >
                      Lock now
                    </Btn>
                  )
                )}
              </div>

              <p className="text-[13px] text-[#86868b] leading-relaxed mt-4">Back up the secret key somewhere safe. It opens this wallet in Phantom, Solflare or Backpack if this device is lost.</p>
              {secret ? (
                <div className="mt-3 rounded-2xl bg-[#fff1f1] border border-[#fecaca] p-3">
                  <p className="num text-[12px] break-all text-[#7f1d1d]">{secret}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <CopyButton text={secret} label="Copy secret key" />
                    <button onClick={() => setSecret(null)} className="text-[12px] text-[#7f1d1d]/70 hover:text-[#7f1d1d]">
                      Hide
                    </button>
                  </div>
                </div>
              ) : (
                <Btn tone="outline" size="md" className="mt-3" icon="key" onClick={showSecret}>
                  Show secret key
                </Btn>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-black/[0.06] flex items-center justify-between gap-2 flex-wrap">
            {isLocal ? (
              confirmForget ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-[#c53030]">Backed up? This cannot be undone.</span>
                  <Btn tone="danger" size="sm" onClick={() => (forgetWallet(), close())}>
                    Forget wallet
                  </Btn>
                  <Btn tone="ghost" size="sm" onClick={() => setConfirmForget(false)}>
                    Cancel
                  </Btn>
                </div>
              ) : (
                <Btn tone="ghost" size="sm" icon="logout" onClick={() => setConfirmForget(true)}>
                  Forget this wallet
                </Btn>
              )
            ) : (
              <Btn tone="ghost" size="sm" icon="logout" onClick={() => disconnectWallet().then(close)}>
                Disconnect {short(address)}
              </Btn>
            )}
            <Btn tone="ghost" size="sm" icon="wallet" onClick={connectWallet}>
              Use another wallet
            </Btn>
          </div>
        </div>
      )}
    </Sheet>
  )
}
