import { useEffect, useState } from 'react'
import { formatAlmatyClock } from '@/lib/format'

type AlmatyClockProps = {
  className?: string
}

/** Алматы (Asia/Almaty, UTC+5): DD.MM.YYYY HH:mm:ss, обновление каждую секунду */
export function AlmatyClock({ className }: AlmatyClockProps) {
  const [text, setText] = useState(() => formatAlmatyClock(new Date()))
  useEffect(() => {
    const tick = () => setText(formatAlmatyClock(new Date()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span
      className={className ?? 'text-[11px] font-medium tabular-nums text-zinc-500'}
      title="Asia/Almaty"
    >
      {text}
    </span>
  )
}
