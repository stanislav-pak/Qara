import { useId, useRef } from 'react'
import { staffAvatarBackgroundColor, staffInitialsFromName } from '@/lib/staffAvatar'

type Props = {
  staffId: string
  fullName: string
  avatarUrl: string | null
  disabled?: boolean
  uploading?: boolean
  uploadLabel: string
  onFileSelected: (file: File) => void
}

export function StaffMemberAvatar({
  staffId,
  fullName,
  avatarUrl,
  disabled,
  uploading,
  uploadLabel,
  onFileSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const reactId = useId()
  const inputId = `staff-avatar-${staffId}-${reactId}`
  const initials = staffInitialsFromName(fullName)
  const bg = staffAvatarBackgroundColor(fullName)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onFileSelected(f)
  }

  const openPicker = () => {
    if (!disabled && !uploading) inputRef.current?.click()
  }

  return (
    <div className="relative shrink-0">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={onChange}
      />
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-label={uploadLabel}
        onKeyDown={(e) => {
          if (disabled || uploading) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        className="group relative h-12 w-12 cursor-default overflow-hidden rounded-full ring-1 ring-white/10 outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        style={avatarUrl ? undefined : { backgroundColor: bg }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
            {initials}
          </span>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                openPicker()
              }}
              className="pointer-events-auto rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-40"
            >
              {uploadLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
