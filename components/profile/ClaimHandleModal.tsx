'use client'

import { useEffect, useState } from 'react'
import { Modal, Btn } from '@/components/shared/ui'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiSend } from '@/lib/client/api'
import { GradientAvatar } from '@/components/shared/GradientAvatar'

export function ClaimHandleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, address, refreshUser, toast } = useUmanity()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && user) {
      setUsername(user.handleClaimed ? user.username : '')
      setDisplayName(user.handleClaimed ? user.displayName : '')
      setBio(user.bio)
      setError('')
    }
  }, [open, user])

  const save = async () => {
    if (!address) return
    setSaving(true)
    setError('')
    const r = await apiSend<{ success: boolean; error?: string }>('/api/register', { address, username, displayName, bio })
    setSaving(false)
    if (!r.success) return setError(r.error || 'Could not claim handle')
    await refreshUser()
    toast(`You are @${username}. +50 impact points.`, 'ok')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <GradientAvatar username={username || user?.username || 'u'} size="lg" />
          <div>
            <h3 className="text-[17px] font-bold">{user?.handleClaimed ? 'Edit your profile' : 'Claim your @handle'}</h3>
            <p className="text-[12px] text-[#52525B]">Lives on Solana with your wallet. Mints your Seed Guardian.</p>
          </div>
        </div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Username</label>
        <div className="relative mb-3">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A1A1AA]">@</span>
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))} placeholder="satoshi" className="input !pl-8" autoFocus />
        </div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 50))} placeholder="Satoshi Nakamoto" className="input mb-3" />
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={2} placeholder="What drives you to give?" className="input resize-none" />
        {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
        <div className="flex gap-2 mt-5">
          <Btn tone="secondary" className="flex-1" onClick={onClose}>
            Later
          </Btn>
          <Btn className="flex-[2]" onClick={save} loading={saving} disabled={username.length < 3}>
            {user?.handleClaimed ? 'Save' : 'Claim & mint Seed Guardian'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
