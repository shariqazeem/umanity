'use client'

/** Your wallet: address, balance, funding, backup, sign out. */
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Icon, Pill, CopyButton, AccountLink } from '@/components/shared/ui'
import { fmtSol, fmtUsd, short } from '@/lib/client/api'
import { exportSecretBase58 } from '@/lib/client/wallet'

export function WalletSheet() {
  const { walletSheetOpen, closeWalletSheet, signer, local, balance, solPrice, isMainnet, requestFaucet, forgetWallet, disconnectWallet, connectWallet, refreshBalance, toast } = useUmanity()
  const [reveal, setReveal] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)
  const [busy, setBusy] = useState(false)
  const address = signer?.publicKey.toBase58() ?? ''

  const faucet = async () => {
    setBusy(true)
    const r = await requestFaucet()
    setBusy(false)
    toast(r.ok ? (r.funded ? 'Topped up with devnet SOL.' : 'This wallet is already funded.') : r.error || 'Faucet failed', r.ok ? 'ok' : 'err')
  }

  const close = () => {
    setReveal(false)
    setConfirmForget(false)
    closeWalletSheet()
  }

  return (
    <Sheet open={walletSheetOpen} onClose={close} width="sm" title="Wallet">
      {!signer ? (
        <div className="py-6 text-center">
          <p className="text-[14px] text-[#6e6e73]">No wallet yet.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-black/[0.06] rounded-2xl p-2">
              <QRCodeSVG value={address} size={84} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Pill tone={signer.kind === 'local' ? 'dark' : 'gray'}>{signer.kind === 'local' ? 'Umanity wallet' : 'Connected'}</Pill>
                {!isMainnet && <Pill tone="gray">Devnet</Pill>}
              </div>
              <p className="num text-[26px] font-bold mt-1.5 leading-none">{balance == null ? '…' : `${fmtSol(balance, 3)} SOL`}</p>
              <p className="text-[12px] text-[#6e6e73] mt-1 num">{solPrice && balance != null ? fmtUsd(balance * solPrice) : ''}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#fafafa] border border-black/[0.06] p-3.5">
            <p className="eyebrow mb-1">Address</p>
            <p className="num text-[12.5px] break-all">{address}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <CopyButton text={address} label="Copy" />
              <AccountLink address={address} label="View on Solscan" />
              <button onClick={refreshBalance} className="ml-auto text-[#6e6e73] hover:text-[#1d1d1f]" title="Refresh balance">
                <Icon name="refresh" size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="eyebrow mb-2">Add funds</p>
            <p className="text-[13px] text-[#6e6e73] leading-relaxed">Send SOL to the address above from any wallet or exchange. {isMainnet ? 'Or give directly from another chain: every cause accepts USDC, ETH, BTC and 200+ assets without touching this wallet.' : 'On devnet the treasury can top this wallet up for you.'}</p>
            {!isMainnet && (
              <Btn tone="outline" size="md" className="mt-3" onClick={faucet} loading={busy} icon="bolt">
                Get devnet SOL
              </Btn>
            )}
          </div>

          {signer.kind === 'local' && local && (
            <div className="mt-5 pt-4 border-t border-black/[0.06]">
              <p className="eyebrow mb-2">Back up</p>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed">This wallet exists only in this browser. Save the secret key somewhere safe; it imports into Phantom, Solflare or Backpack.</p>
              {reveal ? (
                <div className="mt-3 rounded-2xl bg-[#fff1f1] border border-[#fecaca] p-3">
                  <p className="num text-[12px] break-all text-[#7f1d1d]">{exportSecretBase58(local)}</p>
                  <div className="mt-2">
                    <CopyButton text={exportSecretBase58(local)} label="Copy secret key" />
                  </div>
                </div>
              ) : (
                <Btn tone="outline" size="md" className="mt-3" icon="key" onClick={() => setReveal(true)}>
                  Reveal secret key
                </Btn>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-black/[0.06] flex items-center justify-between gap-2 flex-wrap">
            {signer.kind === 'local' ? (
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
