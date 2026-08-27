import { describe, expect, it } from 'vitest'
import { addDays, defaultSyncRange, todayInCalendar } from './dates.js'

describe('todayInCalendar', () => {
  it('zwraca date w kalendarzu podanej strefy, nie procesu', () => {
    // 2026-03-11T05:30Z to jeszcze 10 marca w Los Angeles.
    const now = new Date('2026-03-11T05:30:00Z')
    expect(todayInCalendar(now, 'America/Los_Angeles')).toBe('2026-03-10')
    expect(todayInCalendar(now, 'UTC')).toBe('2026-03-11')
  })
})

describe('addDays', () => {
  it.each([
    ['2026-03-10', 1, '2026-03-11'],
    ['2026-03-10', -1, '2026-03-09'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2024-02-28', 1, '2024-02-29'],   // rok przestepny
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-08', 0, '2026-03-08'],
    ['2026-03-08', -90, '2025-12-08'],
  ])('%s %+d -> %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
  })

  it('nie zalezy od strefy czasowej procesu', () => {
    // Wynik musi byc identyczny niezaleznie od TZ — dlatego arytmetyka na UTC.
    expect(addDays('2026-03-10', 1)).toBe('2026-03-11')
  })

  it('odrzuca wejscie w innym formacie niz YYYY-MM-DD', () => {
    expect(() => addDays('10.03.2026', 1)).toThrow()
    expect(() => addDays('2026-3-10', 1)).toThrow()
  })
})

describe('defaultSyncRange', () => {
  it('konczy sie 3 dni przed dzisiaj w kalendarzu zrodla', () => {
    const r = defaultSyncRange(new Date('2026-03-11T05:30:00Z'), 'America/Los_Angeles')
    expect(r.to).toBe('2026-03-07')   // 2026-03-10 minus 3
    expect(r.from).toBe('2025-12-07') // to minus 90
  })
})
