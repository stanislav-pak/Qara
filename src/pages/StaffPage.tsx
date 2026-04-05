import { useCallback, useEffect, useState } from 'react'
import { StaffMemberAvatar } from '@/components/staff/StaffMemberAvatar'
import type { StaffMemberRow } from '@/hooks/useStaffMembers'
import { useStaffMembers } from '@/hooks/useStaffMembers'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/locales/ru'

type EditModalProps = {
  row: StaffMemberRow
  t: (key: TranslationKey) => string
  working: boolean
  onClose: () => void
  onSave: (patch: { full_name: string; specialty: string; is_active: boolean }) => Promise<void>
}

function StaffEditModal({ row, t, working, onClose, onSave }: EditModalProps) {
  const [fullName, setFullName] = useState(row.full_name)
  const [specialty, setSpecialty] = useState(row.specialty ?? '')
  const [isActive, setIsActive] = useState(row.is_active)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) return
    await onSave({ full_name: name, specialty: specialty.trim(), is_active: isActive })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-edit-title"
      onMouseDown={(e) => {
        if (!working && e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-glow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="staff-edit-title" className="text-lg font-semibold text-white">
          {t('staff.editHeading')}
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('staff.fieldName')}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('staff.fieldSpecialty')}</span>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('staff.specialtyPlaceholder')}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-[var(--color-accent)] focus:ring-[var(--color-accent)]/40"
            />
            <span className="text-sm text-zinc-200">{t('staff.fieldActive')}</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            {t('staff.cancel')}
          </button>
          <button
            type="submit"
            disabled={working || !fullName.trim()}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-muted)] disabled:opacity-40"
          >
            {working ? t('staff.saving') : t('staff.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

export function StaffPage() {
  const { t } = useTranslation()
  const { staff, loading, loadError, refresh, createMember, updateMember, uploadStaffAvatar } =
    useStaffMembers()

  const [newName, setNewName] = useState('')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [formError, setFormError] = useState(false)
  const [working, setWorking] = useState(false)
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null)
  const [editing, setEditing] = useState<StaffMemberRow | null>(null)

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(false)
    setWorking(true)
    const { error } = await createMember({
      full_name: newName,
      specialty: newSpecialty.trim(),
    })
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    setNewName('')
    setNewSpecialty('')
  }

  const onSaveEdit = async (patch: { full_name: string; specialty: string; is_active: boolean }) => {
    if (!editing) return
    setFormError(false)
    setWorking(true)
    const { error } = await updateMember(editing.id, patch)
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    setEditing(null)
  }

  const toggleActive = useCallback(
    async (row: StaffMemberRow) => {
      setFormError(false)
      setWorking(true)
      const { error } = await updateMember(row.id, { is_active: !row.is_active })
      setWorking(false)
      if (error) setFormError(true)
    },
    [updateMember],
  )

  const onAvatarFile = useCallback(
    async (staffId: string, file: File) => {
      setFormError(false)
      setUploadingStaffId(staffId)
      const { error } = await uploadStaffAvatar(staffId, file)
      setUploadingStaffId(null)
      if (error) setFormError(true)
    },
    [uploadStaffAvatar],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('staff.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t('staff.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(false)
            void refresh()
          }}
          disabled={loading || working}
          className="self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {t('staff.refresh')}
        </button>
      </div>

      {(loadError || formError) && (
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
          {loadError && <p>{t('staff.loadError')}</p>}
          {formError && <p>{t('staff.formError')}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-white">{t('staff.newMember')}</h2>
        <form
          onSubmit={(e) => void onCreate(e)}
          className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end"
        >
          <label className="min-w-0 sm:col-span-1">
            <span className="text-xs font-medium text-zinc-500">{t('staff.fieldName')}</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('staff.namePlaceholder')}
            />
          </label>
          <label className="min-w-0 sm:col-span-1">
            <span className="text-xs font-medium text-zinc-500">{t('staff.fieldSpecialty')}</span>
            <input
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('staff.specialtyPlaceholder')}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={working || loading || !newName.trim()}
              className="w-full rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-muted)] disabled:opacity-40 sm:w-auto"
            >
              {working ? t('staff.saving') : t('staff.submitAdd')}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{t('staff.listHeading')}</h2>
          {!loading && (
            <span className="text-xs tabular-nums text-zinc-500">{staff.length}</span>
          )}
        </div>

        <div className="p-2 sm:p-3">
          {loading ? (
            <ul className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="flex animate-pulse items-center gap-4 rounded-xl px-3 py-4"
                >
                  <div className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06]" />
                  <div className="h-4 flex-1 rounded bg-white/[0.06]" />
                  <div className="h-6 w-20 rounded-lg bg-white/[0.06]" />
                </li>
              ))}
            </ul>
          ) : staff.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-zinc-500">{t('staff.empty')}</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {staff.map((row) => (
                <li key={row.id} className="px-2 py-1 sm:px-3">
                  <div className="flex flex-col gap-3 rounded-xl px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <StaffMemberAvatar
                        staffId={row.id}
                        fullName={row.full_name}
                        avatarUrl={row.avatar_url}
                        disabled={working || Boolean(uploadingStaffId)}
                        uploading={uploadingStaffId === row.id}
                        uploadLabel={t('staff.uploadPhoto')}
                        onFileSelected={(file) => void onAvatarFile(row.id, file)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-100">
                          {row.full_name}
                          {(row.specialty ?? '').trim() ? (
                            <span className="font-normal text-zinc-500">
                              {' · '}
                              {(row.specialty ?? '').trim()}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={[
                          'shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                          row.is_active
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90'
                            : 'border-white/[0.08] bg-black/20 text-zinc-500',
                        ].join(' ')}
                      >
                        {row.is_active ? t('staff.statusActive') : t('staff.statusInactive')}
                      </span>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void toggleActive(row)}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        {row.is_active ? t('staff.actionDeactivate') : t('staff.actionActivate')}
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setEditing(row)}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        {t('staff.actionEdit')}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <StaffEditModal
          key={editing.id}
          row={editing}
          t={t}
          working={working}
          onClose={() => !working && setEditing(null)}
          onSave={onSaveEdit}
        />
      )}
    </div>
  )
}
