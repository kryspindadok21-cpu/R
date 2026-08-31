import { seededRandom } from '@seo/geo'

/**
 * Roznica w roznicach (D48-D51).
 *
 * Porownanie „przed/po" mierzy **sume wszystkiego, co sie wydarzylo** w tym
 * okresie — core update, sezon, ruch konkurencji — i przypisuje to naszej
 * zmianie. Strony kontrolne przezyly dokladnie to samo. To, co je odroznia od
 * zmienionych, to wylacznie nasza zmiana:
 *
 *     efekt = (zmienione_po − zmienione_przed) − (kontrolne_po − kontrolne_przed)
 *
 * Bez grupy kontrolnej **nie ma pomiaru** — jest odmowa. Zejscie po cichu do
 * porownania „przed/po" dawaloby liczbe wygladajaca identycznie jak prawdziwa.
 */

/** Ponizej tylu stron kontrolnych odmawiamy. Wartosc zgadnieta — patrz nizej. */
export const MIN_CONTROL_PAGES = 5

/** Tyle samo dla grupy zmienionej: jedna strona to anegdota, nie pomiar. */
export const MIN_TREATMENT_PAGES = 1

/** Okna pomiaru z D50. Kazde porownywane z oknem **tej samej dlugosci** przed. */
export const MEASUREMENT_WINDOWS = [14, 30, 60] as const

export const DEFAULT_RESAMPLES = 5_000

export type Metric = 'clicks' | 'impressions' | 'ctr' | 'position'

export interface WindowStats {
  readonly clicks: number
  readonly impressions: number
  /** Srednia pozycja wazona wyswietleniami, tak jak liczy ja Search Console. */
  readonly position: number
}

export interface PageObservation {
  readonly url: string
  readonly before: WindowStats
  readonly after: WindowStats
}

export type DidRefusalReason =
  | 'za-mala-kontrola'
  | 'za-malo-zmienionych'
  | 'brak-wyswietlen'

export interface GroupLevels {
  readonly treatmentBefore: number
  readonly treatmentAfter: number
  readonly controlBefore: number
  readonly controlAfter: number
}

export interface DidVerdict {
  readonly kind: 'werdykt'
  readonly metric: Metric
  readonly windowDays: number
  readonly effect: number
  readonly interval: { readonly low: number; readonly high: number }
  readonly significant: boolean
  /**
   * `poprawa` albo `pogorszenie` — z uwzglednieniem tego, ze przy pozycji
   * **nizej znaczy lepiej**. `null`, gdy zmiana jest jeszcze nieistotna.
   */
  readonly direction: 'poprawa' | 'pogorszenie' | null
  readonly treatmentPages: number
  readonly controlPages: number
  readonly levels: GroupLevels
  readonly seed: number
  readonly resamples: number
}

export interface DidRefusal {
  readonly kind: 'odmowa'
  readonly metric: Metric
  readonly windowDays: number
  readonly reason: DidRefusalReason
  readonly detail: string
}

export type DidResult = DidVerdict | DidRefusal

/** Przy pozycji nizsza wartosc jest lepsza — to jedyna taka metryka. */
export function lowerIsBetter(metric: Metric): boolean {
  return metric === 'position'
}

/**
 * Poziom grupy dla metryki.
 *
 * Dla licznikow bierzemy **srednia na strone**, a nie sume. Suma zmienialaby sie
 * z rozmiarem grupy, wiec trzystronicowa grupa zmieniona i piecdziesieciostronicowa
 * kontrolna dawalyby zmiany nieporownywalne co do rzedu wielkosci — i roznica
 * miedzy nimi mowilaby o licznosci grup, a nie o efekcie.
 */
function levelOf(pages: readonly WindowStats[], metric: Metric): number {
  if (pages.length === 0) return 0

  if (metric === 'clicks' || metric === 'impressions') {
    const suma = pages.reduce((acc, p) => acc + p[metric], 0)
    return suma / pages.length
  }

  const klikniecia = pages.reduce((acc, p) => acc + p.clicks, 0)
  const wyswietlenia = pages.reduce((acc, p) => acc + p.impressions, 0)

  if (metric === 'ctr') return wyswietlenia === 0 ? 0 : klikniecia / wyswietlenia

  // Pozycja wazona wyswietleniami: strona z dwoma wyswietleniami nie moze wazyc
  // tyle samo, co strona z dwoma tysiacami.
  if (wyswietlenia === 0) return 0
  const wazona = pages.reduce((acc, p) => acc + p.position * p.impressions, 0)
  return wazona / wyswietlenia
}

function didOf(
  treatment: readonly PageObservation[],
  control: readonly PageObservation[],
  metric: Metric,
): { effect: number; levels: GroupLevels } {
  const levels: GroupLevels = {
    treatmentBefore: levelOf(treatment.map((p) => p.before), metric),
    treatmentAfter: levelOf(treatment.map((p) => p.after), metric),
    controlBefore: levelOf(control.map((p) => p.before), metric),
    controlAfter: levelOf(control.map((p) => p.after), metric),
  }
  const effect = (levels.treatmentAfter - levels.treatmentBefore)
    - (levels.controlAfter - levels.controlBefore)
  return { effect, levels }
}

function resample<T>(items: readonly T[], random: () => number): T[] {
  const out: T[] = []
  for (let i = 0; i < items.length; i += 1) {
    out.push(items[Math.floor(random() * items.length)] as T)
  }
  return out
}

export interface DidOptions {
  readonly metric: Metric
  readonly windowDays: number
  readonly seed: number
  readonly resamples?: number | undefined
  readonly minControlPages?: number | undefined
}

/**
 * Liczy efekt roznicy w roznicach z przedzialem bootstrapowym.
 *
 * Losujemy **strony**, a nie obserwacje: kazda strona wnosi swoje „przed" i „po"
 * razem. Rozdzielenie ich zerwaloby parowanie i zawyzyloby precyzje, bo czesc
 * wariancji miedzy stronami zniknelaby z rachunku.
 */
export function differenceInDifferences(
  treatment: readonly PageObservation[],
  control: readonly PageObservation[],
  options: DidOptions,
): DidResult {
  const minControl = options.minControlPages ?? MIN_CONTROL_PAGES
  const resamples = options.resamples ?? DEFAULT_RESAMPLES

  if (treatment.length < MIN_TREATMENT_PAGES) {
    return {
      kind: 'odmowa', metric: options.metric, windowDays: options.windowDays,
      reason: 'za-malo-zmienionych',
      detail: `grupa zmieniona ma ${treatment.length} stron, potrzeba co najmniej ${MIN_TREATMENT_PAGES}`,
    }
  }

  if (control.length < minControl) {
    return {
      kind: 'odmowa', metric: options.metric, windowDays: options.windowDays,
      reason: 'za-mala-kontrola',
      detail: `grupa kontrolna ma ${control.length} stron, potrzeba co najmniej ${minControl}; `
        + `brakuje ${minControl - control.length}. Bez kontroli nie da sie odroznic efektu `
        + 'zmiany od core update, sezonu i ruchow konkurencji (D48)',
    }
  }

  const wyswietlenia = [...treatment, ...control]
    .reduce((acc, p) => acc + p.before.impressions + p.after.impressions, 0)
  if ((options.metric === 'ctr' || options.metric === 'position') && wyswietlenia === 0) {
    return {
      kind: 'odmowa', metric: options.metric, windowDays: options.windowDays,
      reason: 'brak-wyswietlen',
      detail: `metryka ${options.metric} liczy sie na wyswietleniach, a tych jest zero`,
    }
  }

  const { effect, levels } = didOf(treatment, control, options.metric)

  const random = seededRandom(options.seed)
  const proby = new Float64Array(resamples)
  for (let i = 0; i < resamples; i += 1) {
    proby[i] = didOf(
      resample(treatment, random), resample(control, random), options.metric,
    ).effect
  }
  proby.sort()

  const percentile = (p: number): number =>
    proby[Math.min(resamples - 1, Math.max(0, Math.floor(p * resamples)))] as number

  const interval = { low: percentile(0.025), high: percentile(0.975) }

  // Bramka istotnosci z D26, przeniesiona tu bez zmian w duchu, ale z innym
  // drugim warunkiem — powod w komentarzu przy `hasSpread` nizej.
  const excludesZero = interval.low > 0 || interval.high < 0
  // Gdy wszystkie wylosowane proby wyszly identyczne, bootstrap nie zobaczyl
  // zadnej zmiennosci i przedzial punktowy wyglada jak pewnosc, a jest brakiem
  // informacji. W D26 te dziure zamykala rozdzielczosc pomiaru; tutaj szum
  // wewnatrz strony siedzi juz w obserwowanej zmianie, wiec zostaje sam warunek
  // niezerowej szerokosci.
  //
  // Porownanie musi miec **tolerancje**, a nie byc dokladne. Srednie liczone
  // w innej kolejnosci roznia sie na ostatnich bitach, wiec zdegenerowany
  // bootstrap zwraca przedzial rzedu 1e-14 zamiast dokladnego zera — i zwykle
  // `high > low` przepuszczaloby go jako zmiennosc. Strazniki, ktore przestaja
  // dzialac dokladnie w przypadku, dla ktorego powstaly, sa gorsze niz ich brak.
  const tolerancja = Math.max(Math.abs(effect), 1) * 1e-9
  const hasSpread = interval.high - interval.low > tolerancja
  const significant = excludesZero && hasSpread

  const lepiejGdyMniej = lowerIsBetter(options.metric)
  const poprawa = lepiejGdyMniej ? effect < 0 : effect > 0

  return {
    kind: 'werdykt',
    metric: options.metric,
    windowDays: options.windowDays,
    effect,
    interval,
    significant,
    direction: significant ? (poprawa ? 'poprawa' : 'pogorszenie') : null,
    treatmentPages: treatment.length,
    controlPages: control.length,
    levels,
    seed: options.seed,
    resamples,
  }
}

/** Jedno zdanie po polsku — to trafia do raportu i do tablicy zadan. */
export function verdictSentence(result: DidResult): string {
  if (result.kind === 'odmowa') {
    return `Po ${result.windowDays} dniach nie da sie zmierzyc (${result.metric}): ${result.detail}.`
  }

  const nazwa: Readonly<Record<Metric, string>> = {
    clicks: 'kliknięcia na stronę',
    impressions: 'wyświetlenia na stronę',
    ctr: 'CTR',
    position: 'pozycja',
  }
  const format = (v: number): string =>
    result.metric === 'ctr'
      ? `${(v * 100).toFixed(2).replace('.', ',')} pp`
      : v.toFixed(2).replace('.', ',')

  const znak = result.effect >= 0 ? '+' : '−'
  const wartosc = `${znak}${format(Math.abs(result.effect))}`
  const zakres = `${format(result.interval.low)} … ${format(result.interval.high)}`

  if (!result.significant) {
    return `Po ${result.windowDays} dniach ${nazwa[result.metric]}: ${wartosc} `
      + `(przedział ${zakres}) — jeszcze nieistotne, za wcześnie na wniosek.`
  }

  return `Po ${result.windowDays} dniach ${nazwa[result.metric]}: ${wartosc} `
    + `(przedział ${zakres}) — ${result.direction}, zmierzone wobec `
    + `${result.controlPages} stron kontrolnych.`
}
