'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Icon, Spinner } from '@/components/shared/ui'
import { adminFetch } from '@/lib/client/admin'
import type { Signer } from '@/components/providers/UmanityProvider'
import type { MediaItem } from '@/lib/contracts'

export interface UploadItem {
  localId: string
  name: string
  size: number
  previewUrl: string | null
  status: 'uploading' | 'done' | 'error'
  error?: string
  url?: string
  sha256?: string
  kind: MediaItem['kind']
  note: string
}

const ACCEPT = 'image/*,video/*,application/pdf'
const MAX_BYTES = 15 * 1024 * 1024

function kindFor(file: File): MediaItem['kind'] {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/pdf') return 'document'
  return 'photo'
}

export function MediaUploader({ signer, items, onChange }: { signer: Signer; items: UploadItem[]; onChange: (next: UploadItem[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const update = (localId: string, patch: Partial<UploadItem>) => {
    onChange(itemsRef.current.map((i) => (i.localId === localId ? { ...i, ...patch } : i)))
  }

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 20)
    const fresh: UploadItem[] = list.map((f) => ({
      localId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      status: f.size > MAX_BYTES ? 'error' : 'uploading',
      error: f.size > MAX_BYTES ? 'Larger than 15 MB' : undefined,
      kind: kindFor(f),
      note: '',
    }))
    onChange([...itemsRef.current, ...fresh])
    await Promise.all(
      list.map(async (f, i) => {
        const it = fresh[i]
        if (it.status === 'error') return
        try {
          const form = new FormData()
          form.append('file', f)
          form.append('kind', it.kind)
          const r = await adminFetch<{ success: boolean; url?: string; sha256?: string; error?: string }>(signer, '/api/media/upload', { form })
          if (!r.success || !r.url) throw new Error(r.error || 'Upload failed')
          update(it.localId, { status: 'done', url: r.url, sha256: r.sha256 })
        } catch (e) {
          update(it.localId, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' })
        }
      })
    )
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-colors ${over ? 'border-[#10b981] bg-[#ecfdf5]' : 'border-black/[0.15] hover:border-black/40 bg-[#fafafa]'}`}
      >
        <span className="w-10 h-10 rounded-full bg-white border border-black/[0.06] text-[#1d1d1f] flex items-center justify-center mx-auto">
          <Icon name="camera" size={18} />
        </span>
        <p className="text-[13.5px] font-semibold mt-3">Drop photos, receipts, videos or PDFs</p>
        <p className="text-[12px] text-[#6e6e73] mt-1">or tap to choose · up to 15 MB each · each file is hashed on upload</p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li key={it.localId} className="rounded-2xl border border-black/[0.06] bg-white p-3 flex gap-3 items-start">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/[0.05] flex items-center justify-center flex-shrink-0 text-[#6e6e73]">
                {it.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Icon name={it.kind === 'video' ? 'image' : 'receipt'} size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold truncate max-w-[200px]">{it.name}</p>
                  <span className="text-[11px] text-[#aeaeb2] num">{(it.size / 1024 / 1024).toFixed(2)} MB</span>
                  {it.status === 'uploading' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6e6e73]">
                      <Spinner className="!w-3 !h-3" /> uploading
                    </span>
                  )}
                  {it.status === 'done' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#047857]">
                      <Icon name="check" size={12} /> uploaded
                    </span>
                  )}
                  {it.status === 'error' && <span className="text-[11px] text-[#c53030]">{it.error}</span>}
                </div>
                {it.sha256 && <p className="text-[11px] text-[#aeaeb2] num truncate mt-0.5">sha256 {it.sha256}</p>}
                <div className="grid grid-cols-[120px_1fr] gap-2 mt-2">
                  <select value={it.kind} onChange={(e) => update(it.localId, { kind: e.target.value as MediaItem['kind'] })} className="input !py-1.5 !text-[12.5px] !rounded-xl">
                    <option value="photo">Photo</option>
                    <option value="receipt">Receipt</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                  </select>
                  <input value={it.note} onChange={(e) => update(it.localId, { note: e.target.value.slice(0, 300) })} placeholder={it.kind === 'receipt' ? 'Shop, amount, what it was for' : 'What this shows'} className="input !py-1.5 !text-[12.5px] !rounded-xl" />
                </div>
              </div>
              <button type="button" onClick={() => onChange(itemsRef.current.filter((x) => x.localId !== it.localId))} className="w-8 h-8 rounded-full flex items-center justify-center text-[#aeaeb2] hover:text-[#1d1d1f] hover:bg-black/[0.05] flex-shrink-0" aria-label="Remove">
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
