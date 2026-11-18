import type { Slot } from '../../api/types'
import { dayNumber, moscowDateKey, moscowToday, weekdayMon1, weekdayShort } from '../../lib/dates'
import { formatTime } from '../../lib/dates'

export function SlotCalendar({
  days,
  slots,
  daysOff,
  workingWeekdays,
  selectedStart,
  onSelect,
}: {
  days: string[]
  slots: Slot[]
  daysOff: string[]
  workingWeekdays: number[]
  selectedStart: string | null
  onSelect: (start: string) => void
}) {
  const today = moscowToday()
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-7 gap-2">
        {days.map((day) => {
          const daySlots = slots.filter((slot) => moscowDateKey(slot.start) === day)
          let note = ''
          if (daysOff.includes(day)) note = 'выходной'
          else if (!workingWeekdays.includes(weekdayMon1(day))) note = 'не работает'
          else if (day < today) note = 'прошедший день'
          else if (daySlots.length === 0) note = 'нет свободного времени'
          return (
            <section key={day} className="min-h-48 border border-line bg-card p-2">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">{weekdayShort(day)}</p>
              <p className="font-serif text-3xl leading-none">{dayNumber(day)}</p>
              {note ? <p className="mt-3 text-xs text-muted">{note}</p> : null}
              <div className="mt-3 flex flex-col gap-1">
                {daySlots.map((slot) => {
                  const selected = slot.start === selectedStart
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(slot.start)}
                      className={`px-2 py-1 text-left text-sm transition-colors ${selected ? 'bg-accent text-white' : 'bg-paper text-ink hover:bg-[#e7f3f2]'}`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
