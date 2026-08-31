/**
 * Warstwa statystyczna trackera GEO (D24–D26).
 *
 * Ten plik decyduje, czy liczby z tego modulu sa pomiarem, czy teatrem.
 *
 * Punkt wyjscia: pojedynczy przebieg promptu to **proba Bernoulliego**, nie
 * pomiar. Przy prawdziwym prawdopodobienstwie wzmianki 0,3 i trzech przebiegach
 * blad standardowy wynosi okolo 26 punktow procentowych — czyli zmierzone 30%
 * moze naprawde byc 10% albo 55%. Cotygodniowy wykres z takich pomiarow musi
 * skakac, nawet gdy nic sie nie zmienia.
 */

export interface Interval {
  readonly low: number
  readonly high: number
}

export interface Proportion {
  /** Liczba sukcesow. */
  readonly hits: number
  /** Liczba prob. */
  readonly trials: number
  readonly rate: number
  readonly interval: Interval
}

/** Kwantyl rozkladu normalnego dla 95% — jedyny, ktorego uzywamy. */
const Z_95 = 1.959963984540054

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Przedzial Wilsona dla odsetka.
 *
 * Nie uzywamy przedzialu normalnego (`p ± 1,96·SE`), bo przy malym `n`
 * i odsetku blisko zera albo jedynki daje granice **poza** przedzialem [0, 1]
 * i realne pokrycie znacznie ponizej deklarowanego. Przy `n = 3` to nie jest
 * subtelnosc, tylko regula. Wilson zachowuje sie poprawnie na krancach.
 */
export function wilsonInterval(hits: number, trials: number, z: number = Z_95): Interval {
  if (trials <= 0) return { low: 0, high: 1 }

  const p = hits / trials
  const z2 = z * z
  const denominator = 1 + z2 / trials
  const center = p + z2 / (2 * trials)
  const spread = z * Math.sqrt(p * (1 - p) / trials + z2 / (4 * trials * trials))

  return {
    low: clamp01((center - spread) / denominator),
    high: clamp01((center + spread) / denominator),
  }
}

export function proportion(hits: number, trials: number): Proportion {
  return {
    hits,
    trials,
    rate: trials === 0 ? 0 : hits / trials,
    interval: wilsonInterval(hits, trials),
  }
}

// --- Roznice sparowane ---------------------------------------------------------

/**
 * Generator liczb pseudolosowych z ziarnem (mulberry32).
 *
 * Bootstrap bez ustalonego ziarna dawalby przy dwoch uruchomieniach tego samego
 * raportu dwa rozne przedzialy — czyli dokladnie ten niedeterminizm, ktory
 * zwalczamy od Fazy 0. Ziarno zapisuje sie razem z wynikiem.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ComparisonRefusal =
  | 'brak-wspolnych-promptow'
  | 'rozny-zestaw-promptow'
  | 'rozny-silnik-lub-wersja'

export interface PairedSample {
  /** Identyfikator promptu — po nim laczymy pomiar wczesniejszy z pozniejszym. */
  readonly promptId: string
  readonly before: number
  readonly after: number
}

export interface PairedComparison {
  readonly pairs: number
  /** Srednia roznica (po − przed). Dodatnia znaczy poprawe. */
  readonly meanDifference: number
  readonly interval: Interval
  /**
   * `false`, gdy przedzial obejmuje zero. Wtedy zmiana jest **jeszcze
   * nieistotna** — pokazujemy ja, ale bez kierunku (D26).
   */
  readonly significant: boolean
  readonly seed: number
  readonly resamples: number
}

export const DEFAULT_RESAMPLES = 10_000

/**
 * Porownanie sparowane: ten sam prompt przed i po, roznica, dopiero potem
 * srednia z roznic (D25).
 *
 * Powod: wariancja **miedzy** promptami jest duza, ale stala przy stalym
 * zestawie. Porownanie sparowane ja usuwa. Porownanie surowych poziomow
 * („w zeszlym tygodniu 34%, w tym 39%") ja zawiera i dlatego prawie nigdy
 * nie wykryje realnej zmiany o kilka punktow.
 *
 * Przedzial liczymy bootstrapem percentylowym — bez zalozenia o normalnosci
 * roznic, ktore przy kilkunastu promptach jest trudne do obrony.
 */
export function pairedComparison(
  samples: readonly PairedSample[],
  options: { readonly seed: number; readonly resamples?: number },
): PairedComparison {
  const resamples = options.resamples ?? DEFAULT_RESAMPLES
  const differences = samples.map((s) => s.after - s.before)
  const n = differences.length

  if (n === 0) {
    return {
      pairs: 0, meanDifference: 0, interval: { low: 0, high: 0 },
      significant: false, seed: options.seed, resamples,
    }
  }

  const mean = (values: readonly number[]): number =>
    values.reduce((sum, v) => sum + v, 0) / values.length

  const observed = mean(differences)

  // Jeden prompt nie daje podstawy do przedzialu — mowimy to wprost zerowa
  // szerokoscia i brakiem istotnosci, zamiast udawac precyzje.
  if (n === 1) {
    return {
      pairs: 1, meanDifference: observed, interval: { low: observed, high: observed },
      significant: false, seed: options.seed, resamples,
    }
  }

  const random = seededRandom(options.seed)
  const means = new Float64Array(resamples)
  for (let r = 0; r < resamples; r += 1) {
    let sum = 0
    for (let i = 0; i < n; i += 1) {
      sum += differences[Math.floor(random() * n)] as number
    }
    means[r] = sum / n
  }
  means.sort()

  const percentile = (q: number): number => {
    const index = Math.min(resamples - 1, Math.max(0, Math.round(q * (resamples - 1))))
    return means[index] as number
  }

  const interval = { low: percentile(0.025), high: percentile(0.975) }
  return {
    pairs: n,
    meanDifference: observed,
    interval,
    significant: interval.low > 0 || interval.high < 0,
    seed: options.seed,
    resamples,
  }
}

// --- Rozdzielczosc pomiaru -----------------------------------------------------

/**
 * Najmniejsza zmiana, ktora ten zestaw jest w stanie wykryc — przy najgorszym
 * przypadku `p = 0,5`. Raport podaje ja wprost, zeby nikt nie oczekiwal czulosci,
 * ktorej nie ma.
 *
 * To jest **dolne** oszacowanie i trzeba je czytac jako granice, nie jako obietnice.
 * Blad standardowy sredniej roznicy sparowanej wynosi w rzeczywistosci
 * `sqrt((2p(1-p)/n + sigma^2) / m)`, gdzie `sigma` to rozrzut samego efektu miedzy
 * promptami. Ta funkcja liczy przypadek `sigma = 0`, bo tylko ten da sie policzyc
 * przed pomiarem.
 *
 * Konsekwencja doboru zestawu: sam szum probkowania zalezy od iloczynu `m·n`, wiec
 * dodatkowy przebieg i dodatkowy prompt kosztuja tyle samo i daja tyle samo.
 * Roznica jest w drugim skladniku: `sigma^2/m` zbija **wylacznie** wiekszy zestaw
 * promptow. Wiecej przebiegow ma podloge, ponizej ktorej nie zejdzie; wiecej
 * promptow jej nie ma. Dlatego przy wyborze idziemy w `m`.
 */
export function detectableDifference(prompts: number, runsPerPrompt: number): number {
  if (prompts <= 0 || runsPerPrompt <= 0) return 1
  const sePerPrompt = Math.sqrt(0.25 / runsPerPrompt)
  const seOfMean = sePerPrompt / Math.sqrt(prompts)
  // Roznica dwoch niezaleznych pomiarow ma wariancje dwa razy wieksza.
  return clamp01(Z_95 * seOfMean * Math.SQRT2)
}

// --- Porownanie dwoch pomiarow -------------------------------------------------

/** Tryb dostepu silnika. Grounding to inny proces, nie inne ustawienie (D27). */
export type AccessMode = 'api' | 'api_grounded'

export interface MeasurementContext {
  readonly engine: string
  readonly modelVersion: string
  readonly accessMode: AccessMode
}

export interface PromptMeasurement {
  readonly promptId: string
  readonly hits: number
  readonly trials: number
}

export interface MeasurementSet {
  readonly context: MeasurementContext
  /** Identyfikator zestawu promptow — zestaw jest bytem trwalym (D25). */
  readonly promptSetId: string
  readonly measurements: readonly PromptMeasurement[]
}

export type ComparisonOutcome =
  | { readonly kind: 'porownanie'; readonly comparison: PairedComparison }
  | { readonly kind: 'odmowa'; readonly reason: ComparisonRefusal; readonly detail: string }

function sameContext(a: MeasurementContext, b: MeasurementContext): boolean {
  return a.engine === b.engine && a.modelVersion === b.modelVersion && a.accessMode === b.accessMode
}

function describeContext(c: MeasurementContext): string {
  return `${c.engine}/${c.modelVersion}/${c.accessMode}`
}

/**
 * Porownanie dwoch pomiarow tego samego zestawu promptow.
 *
 * Odmowa jest **wynikiem**, nie bledem: wolimy powiedziec wprost „tego nie da sie
 * porownac i dlatego", niz po cichu policzyc srednia z dwoch roznych zbiorow.
 * Cicho policzona liczba wyglada tak samo jak liczba prawdziwa — i to jest caly
 * problem (D25, D27).
 */
export function compareMeasurements(
  before: MeasurementSet,
  after: MeasurementSet,
  options: { readonly seed: number; readonly resamples?: number },
): ComparisonOutcome {
  if (!sameContext(before.context, after.context)) {
    return {
      kind: 'odmowa',
      reason: 'rozny-silnik-lub-wersja',
      detail:
        `pomiary pochodza z ${describeContext(before.context)} i ${describeContext(after.context)}; ` +
        'zmiana wersji modelu albo trybu dostepu to adnotacja na wykresie, nie punkt w tej samej linii',
    }
  }

  const beforeIds = before.measurements.map((m) => m.promptId).sort()
  const afterIds = after.measurements.map((m) => m.promptId).sort()

  if (beforeIds.length === 0 || afterIds.length === 0) {
    return {
      kind: 'odmowa',
      reason: 'brak-wspolnych-promptow',
      detail: `pomiar przed ma ${beforeIds.length} promptow, po ma ${afterIds.length}`,
    }
  }

  const sameComposition =
    before.promptSetId === after.promptSetId &&
    beforeIds.length === afterIds.length &&
    beforeIds.every((id, i) => id === afterIds[i])

  if (!sameComposition) {
    const onlyBefore = beforeIds.filter((id) => !afterIds.includes(id))
    const onlyAfter = afterIds.filter((id) => !beforeIds.includes(id))
    return {
      kind: 'odmowa',
      reason: 'rozny-zestaw-promptow',
      detail:
        `zestaw promptow sie zmienil (${before.promptSetId} -> ${after.promptSetId})` +
        (onlyBefore.length > 0 ? `; ubylo: ${onlyBefore.join(', ')}` : '') +
        (onlyAfter.length > 0 ? `; przybylo: ${onlyAfter.join(', ')}` : ''),
    }
  }

  const byId = new Map(before.measurements.map((m) => [m.promptId, m]))
  const samples: PairedSample[] = after.measurements.map((later) => {
    const earlier = byId.get(later.promptId) as PromptMeasurement
    return {
      promptId: later.promptId,
      before: earlier.trials === 0 ? 0 : earlier.hits / earlier.trials,
      after: later.trials === 0 ? 0 : later.hits / later.trials,
    }
  })

  return { kind: 'porownanie', comparison: pairedComparison(samples, options) }
}
