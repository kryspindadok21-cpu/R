/**
 * Silnik polityk i wylaczniki (D47, D52).
 *
 * Agent, ktory moze proponowac, ale nie wykonywac, ma **z definicji ograniczony
 * zasieg razenia**. To jest jedyne zabezpieczenie dzialajace niezaleznie od tego,
 * jak dobrze albo zle model sie zachowa — wiec to ono, a nie prompt, decyduje,
 * co wolno zrobic bez pytania.
 */

export type PolicyDecision = 'auto' | 'approve' | 'never'

export interface ActionDefinition {
  readonly kind: string
  readonly policy: PolicyDecision
  /** `true`, gdy akcja zmienia **strone**, a nie tylko nasza baze. */
  readonly writesSite: boolean
  readonly note: string
}

/**
 * Tabela bezpiecznikow z analizy, przepisana do kodu.
 *
 * Jedno swiadome odstepstwo: **wymiana linkow to `never`, nie `approve`.**
 * Tabela mowi „zawsze zatwierdzenie", ale dwie strony dalej ta sama analiza
 * ostrzega, ze to jest link scheme z bezposrednim ryzykiem kary manualnej
 * i jedyna funkcja z calej listy, ktora zatruje wiarygodnosc wszystkiego innego.
 * Akcja, ktorej nie wolno wykonac nigdy, nie powinna dac sie zatwierdzic jednym
 * kliknieciem o drugiej w nocy. Prospecting i pisanie outreachu zostaja na
 * `approve` — to ta sama robota bez ekspozycji na kare.
 */
export const DEFAULT_ACTIONS: readonly ActionDefinition[] = [
  { kind: 'crawl', policy: 'auto', writesSite: false, note: 'tylko odczyt' },
  { kind: 'audit', policy: 'auto', writesSite: false, note: 'tylko odczyt' },
  { kind: 'geo-run', policy: 'auto', writesSite: false, note: 'tylko odczyt' },
  { kind: 'psi', policy: 'auto', writesSite: false, note: 'tylko odczyt' },
  { kind: 'generate-brief', policy: 'auto', writesSite: false, note: 'nic nie publikujemy' },
  { kind: 'generate-draft', policy: 'auto', writesSite: false, note: 'nic nie publikujemy' },
  { kind: 'internal-links', policy: 'auto', writesSite: true, note: 'do trzech linkow, odwracalne' },
  { kind: 'rewrite-meta', policy: 'auto', writesSite: true, note: 'tytul i opis, cofniecie w 24 h' },
  { kind: 'inject-jsonld', policy: 'approve', writesSite: true, note: 'znaczniki widoczne dla wyszukiwarki' },
  { kind: 'publish-article', policy: 'approve', writesSite: true, note: 'pull request jest bramka (D35)' },
  { kind: 'programmatic-pages', policy: 'approve', writesSite: true, note: 'zawsze per szablon' },
  { kind: 'redirects', policy: 'approve', writesSite: true, note: 'moze skasowac ruch strony' },
  { kind: 'canonical', policy: 'approve', writesSite: true, note: 'moze skasowac ruch strony' },
  { kind: 'robots-noindex', policy: 'approve', writesSite: true, note: 'moze skasowac ruch strony' },
  { kind: 'outreach-draft', policy: 'approve', writesSite: false, note: 'tresc wychodzi do ludzi' },
  { kind: 'link-exchange', policy: 'never', writesSite: true, note: 'link scheme — ryzyko kary manualnej' },
]

export type ActionTable = ReadonlyMap<string, ActionDefinition>

export function actionTable(
  actions: readonly ActionDefinition[] = DEFAULT_ACTIONS,
): ActionTable {
  return new Map(actions.map((a) => [a.kind, a]))
}

/**
 * Polityka dla typu akcji. **Typ nieznany to `never`** (D47).
 *
 * Nowy typ akcji pojawi sie kiedys w kodzie wczesniej niz w tabeli. Domyslne
 * `approve` znaczyloby, ze nieznana akcja trafia przed oczy wlasciciela
 * z sugestia, ze ktos ja przemyslal. Domyslne `never` znaczy, ze ktos musi ja
 * swiadomie wlaczyc.
 */
export function policyFor(table: ActionTable, kind: string): PolicyDecision {
  return table.get(kind)?.policy ?? 'never'
}

// --- Wylaczniki globalne (D52) --------------------------------------------------

/** Spadek klikniec tydzien do tygodnia, ktory wstrzymuje wszystkie zapisy. */
export const REGRESSION_THRESHOLD = 0.2

/** Zaden zapis w trybie `auto` nie dotyka wiecej niz tyle stron serwisu. */
export const BLAST_RADIUS_MAX = 0.05

export type BreakerId = 'regression' | 'blast-radius' | 'publication-rate'

export interface BreakerInput {
  readonly clicksThisWeek: number
  readonly clicksLastWeek: number
  readonly indexedPages: number
  readonly affectedPages: number
  /** Wynik licznika tempa z D43 — liczony w bazie, tutaj tylko respektowany. */
  readonly publicationRateAllowed: boolean
  readonly publicationRateReason: string
}

export interface TrippedBreaker {
  readonly id: BreakerId
  readonly reason: string
}

/**
 * Sprawdza wylaczniki dla jednej akcji.
 *
 * Wylaczniki dotycza **wylacznie akcji zapisujacych do strony**. Crawl i audyt
 * maja chodzic takze wtedy, gdy ruch leci w dol — to wtedy sa najbardziej
 * potrzebne.
 */
export function checkBreakers(input: BreakerInput, writesSite: boolean): TrippedBreaker[] {
  if (!writesSite) return []

  const tripped: TrippedBreaker[] = []

  if (input.clicksLastWeek > 0) {
    const spadek = (input.clicksLastWeek - input.clicksThisWeek) / input.clicksLastWeek
    if (spadek > REGRESSION_THRESHOLD) {
      tripped.push({
        id: 'regression',
        reason: `klikniecia spadly o ${(spadek * 100).toFixed(0)}% tydzien do tygodnia `
          + `(${input.clicksLastWeek} → ${input.clicksThisWeek}); nie pozwalamy robotowi `
          + 'kopac szybciej, gdy jestesmy w dole',
      })
    }
  }

  if (input.indexedPages > 0) {
    const zasieg = input.affectedPages / input.indexedPages
    if (zasieg > BLAST_RADIUS_MAX) {
      tripped.push({
        id: 'blast-radius',
        reason: `akcja dotyka ${input.affectedPages} z ${input.indexedPages} stron `
          + `(${(zasieg * 100).toFixed(1)}%), a limit bez zatwierdzenia to `
          + `${(BLAST_RADIUS_MAX * 100).toFixed(0)}%`,
      })
    }
  }

  if (!input.publicationRateAllowed) {
    tripped.push({ id: 'publication-rate', reason: input.publicationRateReason })
  }

  return tripped
}

// --- Bramka: polityka + wylaczniki ----------------------------------------------

export type Gate =
  | { readonly kind: 'auto' }
  | { readonly kind: 'needs-approval'; readonly reason: string }
  | { readonly kind: 'blocked'; readonly reason: string; readonly breaker: BreakerId | null }

/**
 * Rozstrzyga, co wolno zrobic z akcja.
 *
 * **Wylacznik bije polityke.** Akcja z polityka `auto`, przy ktorej zadzialal
 * wylacznik, nie schodzi do `approve` — zostaje zablokowana. Wylacznik, ktory
 * da sie ominac zatwierdzeniem, nie jest wylacznikiem, tylko ostrzezeniem (D52).
 */
export function gateFor(
  table: ActionTable,
  kind: string,
  breakers: BreakerInput,
): Gate {
  const definicja = table.get(kind)
  const policy = definicja?.policy ?? 'never'

  if (policy === 'never') {
    return {
      kind: 'blocked',
      breaker: null,
      reason: definicja === undefined
        ? `typ akcji "${kind}" nie ma wpisu w tabeli polityk, wiec jest traktowany `
          + 'jako never — ktos musi go swiadomie wlaczyc (D47)'
        : `polityka dla "${kind}" to never: ${definicja.note}`,
    }
  }

  const tripped = checkBreakers(breakers, definicja?.writesSite ?? true)
  if (tripped.length > 0) {
    const pierwszy = tripped[0] as TrippedBreaker
    return {
      kind: 'blocked',
      breaker: pierwszy.id,
      reason: tripped.map((t) => t.reason).join('; '),
    }
  }

  if (policy === 'approve') {
    return { kind: 'needs-approval', reason: definicja?.note ?? 'wymaga zatwierdzenia' }
  }

  return { kind: 'auto' }
}
