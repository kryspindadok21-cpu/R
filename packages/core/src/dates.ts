/**
 * Search Console raportuje w kalendarzu pacyficznym. Jedyna definicja w repo —
 * @seo/db i @seo/providers importuja stad, zeby nie dalo sie ich rozjechac (D3).
 * Sluzy do opisu i do wyznaczania granic zakresu, nigdy do konwersji danych z API.
 */
export const GSC_SOURCE_TIMEZONE = 'America/Los_Angeles'

/** Ostatnie dni w Search Console sa niekompletne — nie pobieramy ich (§7 specyfikacji). */
export const GSC_FRESHNESS_LAG_DAYS = 3

/** Domyslna glebokosc historii przy pierwszej synchronizacji. */
export const DEFAULT_SYNC_WINDOW_DAYS = 90

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Dzisiejsza data w kalendarzu podanej strefy. `en-CA` formatuje jako YYYY-MM-DD.
 * Uzywane wylacznie do wyznaczenia granic zakresu — nigdy do konwersji danych z API.
 */
export function todayInCalendar(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** Arytmetyka wylacznie na UTC, zeby wynik nie zalezal od strefy procesu (D3). */
export function addDays(date: string, days: number): string {
  if (!DATE_PATTERN.test(date)) throw new Error(`Oczekiwano YYYY-MM-DD, otrzymano ${JSON.stringify(date)}`)
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${mm}-${dd}`
}

export function defaultSyncRange(now: Date, timeZone: string): { from: string; to: string } {
  const to = addDays(todayInCalendar(now, timeZone), -GSC_FRESHNESS_LAG_DAYS)
  return { from: addDays(to, -DEFAULT_SYNC_WINDOW_DAYS), to }
}
