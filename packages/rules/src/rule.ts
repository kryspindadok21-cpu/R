import type { PageFacts, RenderDiff } from '@seo/parse'
import type { Thresholds } from './thresholds.js'

/**
 * Waga ustalenia. Nie sumuje sie do zadnej oceny zbiorczej (D18) — sluzy
 * wylacznie do ustalenia kolejnosci pracy czlowieka.
 */
export type Severity = 'blocker' | 'high' | 'medium' | 'low' | 'info'

export const SEVERITY_ORDER: readonly Severity[] = ['blocker', 'high', 'medium', 'low', 'info']

export type RuleCategory =
  | 'indexation' | 'content' | 'links' | 'images' | 'structured' | 'technical' | 'ai'

/**
 * Czego regula potrzebuje, zeby miec prawo glosu (D17). Regula bez spelnionych
 * wymagan nie zwraca „w porzadku" — nie zwraca nic i melduje sie jako pominieta.
 * To rozstrzyga najgrozniejszy rodzaj falszywego alarmu: „strona osierocona"
 * przy crawlu urwanym limitem znaczy „nie doszlismy", a nie „nikt nie linkuje".
 */
export type Capability =
  | 'page-facts'      // strona zostala pobrana i sparsowana jako HTML
  | 'http-response'   // znamy status, czas i rozmiar odpowiedzi
  | 'render-diff'     // mamy porownanie surowego HTML z wyrenderowanym
  | 'link-graph'      // graf linkow wewnetrznych zostal zbudowany
  | 'complete-crawl'  // crawl nie zostal uciety zadnym limitem
  | 'sitemap'         // mapa witryny zostala odczytana

/**
 * Opis poprawki, deklaratywny. **Faza 1 niczego nie wykonuje** — pole czyta
 * dopiero silnik polityk w Fazie 4, ktory rozstrzyga, co wolno bez pytania.
 */
export type AutofixSpec =
  | { readonly kind: 'set-title'; readonly value: string }
  | { readonly kind: 'set-meta'; readonly name: string; readonly value: string }
  | { readonly kind: 'set-attribute'; readonly target: string; readonly attribute: string; readonly value: string }
  | { readonly kind: 'add-internal-link'; readonly from: string; readonly to: string; readonly anchor: string }
  | { readonly kind: 'manual'; readonly hint: string }

export type EvidenceValue = string | number | boolean

export interface Finding {
  readonly ruleId: string
  readonly severity: Severity
  readonly category: RuleCategory
  /** `null` dla ustalen dotyczacych calego serwisu, nie pojedynczej strony. */
  readonly url: string | null
  readonly title: string
  /** Konkretne zmierzone wartosci. Ustalenie bez dowodu jest opinia. */
  readonly evidence: Readonly<Record<string, EvidenceValue>>
  readonly autofix?: AutofixSpec
}

export interface SkippedRule {
  readonly ruleId: string
  readonly missing: readonly Capability[]
}

export interface RuleContext {
  readonly capabilities: ReadonlySet<Capability>
  readonly thresholds: Thresholds
}

export interface Rule<F> {
  /** Stabilny na zawsze — po nim porownujemy dwa audyty i liczymy regresje (D18). */
  readonly id: string
  readonly category: RuleCategory
  readonly severity: Severity
  readonly requires: readonly Capability[]
  /** Nazwa dla czlowieka, po polsku. */
  readonly title: string
  evaluate(facts: F, ctx: RuleContext): readonly Finding[]
}

// --- Ksztalt danych, o ktory pytaja reguly -------------------------------------

export interface HttpFacts {
  /** `null`, gdy pobranie w ogole sie nie udalo (timeout, blad sieci). */
  readonly status: number | null
  readonly contentType: string | null
  readonly bytes: number
  readonly durationMs: number
  /** Adresy posrednie, bez adresu koncowego. Dlugosc = liczba przeskokow. */
  readonly redirectChain: readonly string[]
  readonly error: string | null
}

export interface GraphFacts {
  readonly inDegree: number
  readonly outDegree: number
  /** Liczba klikniec od strony glownej; `null`, gdy strona nieosiagalna z linkow. */
  readonly clickDepth: number | null
}

export interface PageInput {
  readonly url: string
  readonly depth: number
  readonly http: HttpFacts
  /** `null`, gdy odpowiedz nie byla HTML-em albo pobranie sie nie udalo. */
  readonly facts: PageFacts | null
  readonly renderDiff: RenderDiff | null
  readonly graph: GraphFacts | null
  /** Czy adres byl w mapie witryny. */
  readonly inSitemap: boolean
}

/**
 * Stan `robots.txt` **pod korzeniem hosta** — bo tylko tam ktokolwiek go szuka.
 * `missing` to HTTP 404: wolno wtedy chodzic wszedzie. `unreachable` to blad
 * sieci albo 5xx: crawlery traktuja to jako zakaz, a nie jako zgode.
 */
export type RobotsState = 'ok' | 'missing' | 'unreachable'

export interface SiteInput {
  readonly siteUrl: string
  readonly pages: readonly PageInput[]
  /** Adresy z mapy witryny — takze te, ktorych crawler nie odwiedzil. */
  readonly sitemapUrls: readonly string[]
  /** Adresy zablokowane przez `robots.txt`, na ktore natrafil crawler. */
  readonly robotsBlockedUrls: readonly string[]
  /** Stan `robots.txt` pod korzeniem hosta, nie pod adresem startowym. */
  readonly robotsState: RobotsState
}

export type PageRule = Rule<PageInput>
export type SiteRule = Rule<SiteInput>

/** Pomocnik: buduje ustalenie bez powtarzania metadanych reguly przy kazdym wywolaniu. */
export function finding(
  rule: Rule<unknown>,
  url: string | null,
  evidence: Readonly<Record<string, EvidenceValue>>,
  autofix?: AutofixSpec,
): Finding {
  return autofix === undefined
    ? { ruleId: rule.id, severity: rule.severity, category: rule.category, url, title: rule.title, evidence }
    : { ruleId: rule.id, severity: rule.severity, category: rule.category, url, title: rule.title, evidence, autofix }
}
