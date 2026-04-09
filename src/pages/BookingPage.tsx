import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { digitsToE164Plus7 } from '@/lib/kzPhone'
import { loadOnlineBookingTimeSlots, type TimeSlot } from '@/lib/occupiedSlots'

/** Same UUID as in Supabase RLS policies for anon booking (see supabase/public_booking_rls.sql). */
function bookingOwnerId(): string | undefined {
  return import.meta.env.VITE_BOOKING_OWNER_ID?.trim() || undefined
}

interface StaffMember {
  id: string
  full_name: string
  is_active: boolean
}

interface Service {
  id: string
  name: string
  name_kk: string | null
  duration: number
  price: number
  category: string
}

type BookingStep = 'staff' | 'service' | 'datetime' | 'contact' | 'success'

export function BookingPage() {
  const [step, setStep] = useState<BookingStep>('staff')
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [clientName, setClientName] = useState('')
  /** Only the 10 digits after +7 (user does not type country code). */
  const [clientPhoneDigits, setClientPhoneDigits] = useState('')
  const [clientNotes, setClientNotes] = useState('')
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  useEffect(() => {
    async function loadStaff() {
      const ownerId = bookingOwnerId()
      if (!ownerId) {
        setStaffList([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data } = await supabase
        .from('staff_members')
        .select('id, full_name, is_active')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .order('full_name')
      setStaffList(data || [])
      setLoading(false)
    }
    void loadStaff()
  }, [])

  useEffect(() => {
    if (!selectedStaff) return
    async function loadServices() {
      const ownerId = bookingOwnerId()
      if (!ownerId) {
        setServices([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data } = await supabase
        .from('services')
        .select('id, name, name_kk, duration, price, category')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .order('category')
      setServices(data || [])
      setLoading(false)
    }
    void loadServices()
  }, [selectedStaff])

  useEffect(() => {
    if (!selectedStaff || !selectedDate || !selectedService) return
    async function loadSlots() {
      const ownerId = bookingOwnerId()
      if (!ownerId) {
        setTimeSlots([])
        setLoading(false)
        return
      }
      setLoading(true)
      const slots = await loadOnlineBookingTimeSlots(supabase, {
        ownerId,
        staffMemberId: selectedStaff!.id,
        selectedDateYmd: selectedDate,
        newBookingDurationMinutes: selectedService!.duration,
      })
      setTimeSlots(slots)
      setLoading(false)
    }
    void loadSlots()
  }, [selectedStaff, selectedDate, selectedService])

  async function submitBooking() {
    if (!selectedStaff || !selectedService || !selectedDate || !selectedTime) return
    const ownerId = bookingOwnerId()
    const phoneE164 = digitsToE164Plus7(clientPhoneDigits)
    if (!ownerId) {
      setError('Бронь недоступна: задайте VITE_BOOKING_OWNER_ID в .env')
      return
    }
    if (!clientName.trim() || !phoneE164) return
    setSubmitting(true)
    setError(null)
    try {
      const startsAt = new Date(`${selectedDate}T${selectedTime}:00`)
      const endsAt = new Date(startsAt.getTime() + selectedService.duration * 60 * 1000)
      const startsIso = startsAt.toISOString()
      const endsIso = endsAt.toISOString()

      let clientId: string | null = null
      const { data: existing, error: findErr } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('phone', phoneE164)
        .maybeSingle()
      if (findErr) throw findErr

      if (existing) {
        clientId = existing.id
      } else {
        const { data: newClient, error: insClientErr } = await supabase
          .from('clients')
          .insert({
            owner_id: ownerId,
            full_name: clientName.trim(),
            phone: phoneE164,
          })
          .select('id')
          .single()
        if (insClientErr) throw insClientErr
        clientId = newClient?.id ?? null
      }

      if (!clientId) throw new Error('client id missing')

      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .insert({
          owner_id: ownerId,
          client_id: clientId,
          staff_id: selectedStaff.id,
          title: selectedService.name,
          client_name: clientName.trim(),
          scheduled_at: startsIso,
          starts_at: startsIso,
          ends_at: endsIso,
          status: 'scheduled',
          source: 'online',
          notes: clientNotes.trim() || null,
        })
        .select('id')
        .single()

      if (apptError) throw apptError
      if (!appointment?.id) throw new Error('appointment id missing')

      await fetch('https://n8n35164.hostkey.in/webhook/appointment-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          phone: phoneE164,
          service: selectedService?.name,
          staff: selectedStaff?.full_name,
          date: selectedDate,
          time: selectedTime,
        }),
      })

      const { error: lineErr } = await supabase.from('appointment_services').insert({
        appointment_id: appointment.id,
        service_id: selectedService.id,
        service_name: selectedService.name,
        price: selectedService.price,
        duration: selectedService.duration,
      })
      if (lineErr) throw lineErr

      setStep('success')
    } catch (e: unknown) {
      console.error('[booking]', e)
      setError(
        'Қате орын алды / Ошибка сохранения. Тексеріңіз: VITE_BOOKING_OWNER_ID, supabase/public_booking_rls.sql.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#09090b] p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Запись принята!</h1>
          <p className="mt-2 text-zinc-400">{clientName}, ваша запись успешно создана.</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Мастер</span>
              <span className="text-white font-medium">{selectedStaff?.full_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Услуга</span>
              <span className="text-white font-medium">{selectedService?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Дата</span>
              <span className="text-white font-medium">
                {new Date(selectedDate).toLocaleDateString('ru-RU', {
                  day: 'numeric', month: 'long', weekday: 'long',
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Время</span>
              <span className="text-white font-medium">{selectedTime}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-white/10 pt-3">
              <span className="text-zinc-500">Стоимость</span>
              <span className="text-white font-bold">
                {selectedService?.price?.toLocaleString('ru-RU')} ₸
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setStep('staff')
              setSelectedStaff(null)
              setSelectedService(null)
              setSelectedDate('')
              setSelectedTime('')
              setClientName('')
              setClientPhoneDigits('')
              setClientNotes('')
            }}
            className="mt-6 w-full rounded-xl border border-white/10 py-3 text-sm text-zinc-300 hover:text-white"
          >
            Новая запись
          </button>
        </div>
      </div>
    )
  }

  const ownerConfigured = Boolean(bookingOwnerId())
  const phoneComplete = clientPhoneDigits.replace(/\D/g, '').length === 10

  return (
    <div className="flex min-h-dvh flex-col bg-[#09090b]">
      <header className="border-b border-white/[0.08] px-4 py-5 text-center">
        <h1 className="text-xl font-bold text-white">QARA</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Онлайн запись</p>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 space-y-6">
        {!ownerConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100/95">
            Бронь сұрату үшін жобаға <code className="rounded bg-black/30 px-1 text-xs">VITE_BOOKING_OWNER_ID</code>{' '}
            қосыңыз (иедің UUID). / Укажите UUID владельца в <code className="rounded bg-black/30 px-1 text-xs">.env</code>.
          </div>
        )}

        {/* ШАГ 1 — Мастер */}
        {step === 'staff' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">1. Выберите мастера</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
              </div>
            ) : (
              <div className="grid gap-3">
                {staffList.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelectedStaff(staff); setStep('service') }}
                    className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/[0.05]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20">
                      <span className="text-lg font-bold text-indigo-300">{staff.full_name[0]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{staff.full_name}</p>
                      <p className="text-xs text-zinc-500">Барбер / Мастер</p>
                    </div>
                    <span className="ml-auto text-zinc-600">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ШАГ 2 — Услуга */}
        {step === 'service' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('staff')} className="text-zinc-500 hover:text-white">←</button>
              <h2 className="text-lg font-semibold text-white">2. Выберите услугу</h2>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => { setSelectedService(service); setStep('datetime') }}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/[0.05]"
                  >
                    <div>
                      <p className="font-medium text-white">{service.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">⏱ {service.duration} мин</p>
                    </div>
                    <p className="font-bold text-white">{service.price?.toLocaleString('ru-RU')} ₸</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ШАГ 3 — Дата и время */}
        {step === 'datetime' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('service')} className="text-zinc-500 hover:text-white">←</button>
              <h2 className="text-lg font-semibold text-white">3. Дата и время</h2>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Выберите дату
              </label>
              <input
                type="date"
                min={today}
                max={maxDateStr}
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime('') }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white focus:border-indigo-500/50 focus:outline-none [color-scheme:dark]"
              />
            </div>
            {selectedDate && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Выберите время
                </label>
                {loading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => { setSelectedTime(slot.time); setStep('contact') }}
                        className={`rounded-xl py-2.5 text-sm font-medium transition-all ${
                          !slot.available
                            ? 'cursor-not-allowed bg-white/[0.02] text-zinc-700'
                            : 'border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-indigo-500/50 hover:text-white'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ШАГ 4 — Контакты */}
        {step === 'contact' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('datetime')} className="text-zinc-500 hover:text-white">←</button>
              <h2 className="text-lg font-semibold text-white">4. Ваши данные</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Мастер</span>
                <span className="text-white">{selectedStaff?.full_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Услуга</span>
                <span className="text-white">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Дата</span>
                <span className="text-white">
                  {new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Время</span>
                <span className="text-white">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                <span className="text-zinc-500">Стоимость</span>
                <span className="font-bold text-white">{selectedService?.price?.toLocaleString('ru-RU')} ₸</span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Ваше имя *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Аскар"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Телефон *</label>
                <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-indigo-500/50">
                  <span className="flex shrink-0 items-center border-r border-white/10 bg-white/[0.04] px-3 text-sm tabular-nums text-zinc-400">
                    +7
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={clientPhoneDigits}
                    onChange={(e) => setClientPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="7771234567"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white outline-none placeholder-zinc-600"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">10 цифр после +7</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Примечание (необязательно)</label>
                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Например: не делайте очень коротко"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none"
                />
              </div>
            </div>
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <button
              onClick={() => void submitBooking()}
              disabled={
                submitting ||
                !ownerConfigured ||
                !clientName.trim() ||
                !phoneComplete
              }
              className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Отправляем...
                </span>
              ) : (
                '✅ Подтвердить запись'
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}