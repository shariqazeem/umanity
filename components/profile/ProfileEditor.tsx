'use client'

import { useEffect, useState } from 'react'
import { Sheet, Btn, Field, Avatar } from '@/components/shared/ui'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiSend } from '@/lib/client/api'

export function ProfileEditor() {
  const { profileEditorOpen, closeProfileEditor, user, address, refreshUser, toast } = useUmanity()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profileEditorOpen && user) {
      setUsername(user.handleClaimed ? user.username : '')
      setDisplayName(user.handleClaimed ? user.displayName : '')
      setBio(user.bio)
      setError('')
    }
  }, [profileEditorOpen, user])

  const save = async () => {
    if (!address) return
    setSaving(true)
    setError('')
    const r = await apiSend<{ success: boolean; error?: string }>('/api/register', { address, username, displayName, bio })
    setSaving(false)
    if (!r.success) return setError(r.error || 'Could not save')
    await refreshUser()
    toast('Profile saved.', 'ok')
    closeProfileEditor()
  }

  return (
    <Sheet open={profileEditorOpen} onClose={closeProfileEditor} width="sm" title={user?.handleClaimed ? 'Edit profile' : 'Pick your name'}>
      <div className="flex items-center gap-3 mb-5">
        <Avatar username={username || user?.username || 'u'} url={user?.avatarUrl} size={48} />
        <p className="text-[13px] text-[#6e6e73]">Shown next to your gifts, dares and votes.</p>
      </div>
      <div className="space-y-3">
        <Field label="Username">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aeaeb2]">@</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))} placeholder="yourname" className="input !pl-9" autoFocus />
          </div>
        </Field>
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 50))} placeholder="Your name" className="input" />
        </Field>
        <Field label="Bio" hint={`${bio.length}/280`}>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={3} placeholder="Why do you give?" className="input resize-none" />
        </Field>
      </div>
      {error && <p className="text-[12.5px] text-[#c53030] mt-3">{error}</p>}
      <div className="flex gap-2 mt-5">
        <Btn tone="secondary" size="lg" className="flex-1" onClick={closeProfileEditor}>
          Cancel
        </Btn>
        <Btn size="lg" className="flex-[2]" onClick={save} loading={saving} disabled={username.length < 3}>
          Save
        </Btn>
      </div>
    </Sheet>
  )
}
