# Faza 0 — Fundament. Plan wykonawczy

> **Dla wykonawców agentowych:** WYMAGANY SUB-SKILL: użyj `superpowers:subagent-driven-development` (zalecane) albo `superpowers:executing-plans`, żeby wykonać ten plan zadanie po zadaniu. Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** doprowadzić do stanu, w którym prawdziwe dane z Google Search Console dla własnej strony leżą w lokalnej bazie SQLite, są policzalne, a ich poprawność da się jednoznacznie zweryfikować — plus jeden statyczny raport HTML, który to pokazuje człowiekowi.

**Architektura:** monorepo pnpm + Turborepo. Czyste silniki (`core`, `report`) nie dotykają wejścia/wyjścia. Jedynym wejściem do bazy jest `packages/db`, które eksponuje wyłącznie funkcje przyjmujące `TenantScope`. Jedynym wyjściem na zewnątrz jest `packages/providers`, które rejestruje każde wywołanie w tabeli `provider_call`. `apps/cli` skleja te warstwy.

**Stack:** TypeScript, Node 22 LTS, pnpm, Turborepo, vitest, `better-sqlite3`, `drizzle-orm` (wyłącznie jako typowany builder zapytań), `google-auth-library`, `ulid`. Migracje pisane ręcznie w SQL.

**Spec:** `docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md`

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 0. Weryfikacja faktów u Google | **do zrobienia przez właściciela** (wymaga dostępu do jego Search Console) | — |
| 1. Monorepo + normalizacja URL | ukończone, 33 testy zielone | `e8d938f`, `30fd48d` |
| 2. ULID + TenantScope | ukończone, 47 testów zielonych łącznie | `6cb6e41` |
| 3. Schemat bazy + migrator | ukończone, 70 testów zielonych łącznie | `f6b97c8`, `27dc512` |
| 4. Repozytoria scoped per tenant | ukończone, 100 testów zielonych łącznie | `b321471` |
| 5. Providers: typy + rejestr wywołań | ukończone | `1a62236` |
| 6. Adapter GSC | ukończone na fixture'ach; `GSC_MAX_ROW_LIMIT` do potwierdzenia w Zadaniu 0 | `815d91c` |
| 7. Arytmetyka dat + uzgodnienie | ukończone (wykonane przed Zadaniem 4 — dostarcza `GSC_SOURCE_TIMEZONE`) | `8462ff7` |
| 8. CLI `seo init` | ukończone, uruchomione na zywo | `1a6275c` |
| 9. CLI `gsc sync` / `verify` / `smoke` | ukończone | `4ac959f` |
| 10. Raport HTML | ukończone, obejrzany na danych demo | `befc95b` |
| 11. CI + reguły zależności + skan sekretów | ukończone, 168 testów zielonych w trzech strefach | `713d6f0` |
| 12. Odbiór na prawdziwych danych | **czeka na właściciela** — wymaga klucza konta serwisowego i Zadania 0 | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone), potem pierwsze zadanie ze stanem innym niż „ukończone".

**Odstępstwa od planu odnotowane w trakcie:**
- pnpm 10.33 zamiast 9.12 (wersja w środowisku).
- `@types/node` deklarowane w każdym pakiecie osobno — pnpm nie hoistuje typów z roota workspace.
- Zadanie 7 wykonane przed Zadaniem 4: `repo.ts` importuje `GSC_SOURCE_TIMEZONE`, którego jedyną definicją jest `packages/core/src/dates.ts` (plan dopuszcza tę kolejność w Zadaniu 6).
- `packages/db` eksportuje dodatkowo `closeDatabase` — CLI musi domknąć plik WAL. Nie osłabia D5: nadal nie ma dostępu do surowego uchwytu ani do `schema`.
- Ponad plan: `packages/db/src/schema.test.ts` porównuje kolumny schematu Drizzle z `PRAGMA table_info`, żeby definicje nie rozjechały się z DDL.
- `barChartSvg` eskejpuje etykiety — w planie trafiały do `<title>` w SVG bez eskejpowania.
- `check-secrets` wymaga nagłówka PEM **wraz z ciałem klucza**: sam nagłówek występuje w dokumentacji skanera i dawał fałszywy alarm na własnym repozytorium.
- CI nie podaje wersji pnpm — bierze ją z pola `packageManager`, inaczej `pnpm/action-setup` kończy się konfliktem wersji.

---

## Ograniczenia globalne

Obowiązują w każdym zadaniu. Wartości przepisane dosłownie ze specyfikacji.

- **Koszt: 0 zł.** Żadnej zależności wymagającej płatnego konta. Żadnego hostingu.
- **Baza: wyłącznie SQLite** (D1). Żadnego `pg`, żadnego `drizzle-orm/pg-core`.
- **Migracje: ręczne pliki `.sql`** (D1). `drizzle-kit generate` nie jest używany.
- **JSON w bazie: `text` walidowany schematem `zod` przy odczycie** (D1).
- **Klucze główne: ULID (`text`, 26 znaków). Zero `AUTOINCREMENT`.** Wyjątek: `tenant.id` to slug pasujący do `^[a-z0-9][a-z0-9-]{1,62}$` (D6).
- **`tenant_id TEXT NOT NULL` w każdej tabeli domenowej, nigdy `NULL`, wiodąco w każdym indeksie i każdym ograniczeniu unikalności** (D5).
- **Data z GSC to `text` w formacie `YYYY-MM-DD`, przepisany dosłownie z odpowiedzi API.** Zakaz `new Date()` na tej wartości. Kolumna `source_timezone` = `'America/Los_Angeles'` (D3).
- **`GSC_FRESHNESS_LAG_DAYS = 3`** — górna granica domyślnego zakresu pobierania (§7 specyfikacji).
- **`NORMALIZER_VERSION = 1`** (D4).
- **Reguły zależności** (D5, D7, egzekwowane przez `scripts/check-deps.ts`):
  - tylko `packages/db` importuje `drizzle-orm` i `better-sqlite3`,
  - tylko `packages/providers` importuje `google-auth-library` i wykonuje żądania sieciowe,
  - `packages/core` i `packages/report` nie importują niczego z wejściem/wyjściem.
- **Testy działają bez sieci.** Jedyne prawdziwe wywołanie API to `seo gsc smoke`, poza CI (AC9).
- **Raport nie pobiera niczego z sieci** — bez `http://`, `https://` i `//` w `src`/`href` (AC11).
- Każde zadanie kończy się commitem. Wiadomości commitów po polsku, w trybie `typ: opis`.

---

### Zadanie 0: Weryfikacja faktów u Google (bez kodu)

Ryzyka R1 i R2 ze specyfikacji. Wykonać **przed** Zadaniem 6, najlepiej pierwszego dnia, bo uprawnienie w Search Console nadaje się raz.

**Pliki:**
- Modyfikacja: `docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md` (sekcja 10, tabela ryzyk)

- [ ] **Krok 1: Utworzyć konto serwisowe**

W Google Cloud Console: nowy projekt → włączyć „Google Search Console API" → utworzyć konto serwisowe → wygenerować klucz JSON. Zapisać klucz poza repozytorium, np. `~/.seo/gsc.sa.json`, i ustawić `chmod 600`.

- [ ] **Krok 2: Nadać uprawnienie w Search Console**

W Search Console → Ustawienia → Użytkownicy i uprawnienia → dodać adres e-mail konta serwisowego. **Zacząć od poziomu „Ograniczony" (Restricted).**

- [ ] **Krok 3: Sprawdzić, czy „Ograniczony" wystarcza**

Wywołać ręcznie, podstawiając własne `siteUrl` (zakodowane procentowo) i token wygenerowany z klucza:

```bash
curl -s -X POST \
  "https://www.googleapis.com/webmasters/v3/sites/${SITE_URL_ENC}/searchAnalytics/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-05-01","endDate":"2026-05-02","dimensions":["date"],"dataState":"final"}'
```

Odpowiedź `200` z tablicą `rows` = wystarcza. `403` = podnieść uprawnienie do „Pełny" i powtórzyć.

- [ ] **Krok 4: Ustalić rzeczywisty limit `rowLimit`**

Sprawdzić w bieżącej dokumentacji Search Analytics API maksymalną wartość `rowLimit` na jedno żądanie oraz dzienne limity zapytań. Zweryfikować empirycznie: wysłać żądanie z `rowLimit` o 1 większym niż udokumentowane maksimum i zapisać, czy API zwraca błąd, czy po cichu obcina.

- [ ] **Krok 5: Zapisać ustalenia w specyfikacji**

Zastąpić wiersze R1 i R2 w tabeli ryzyk ustalonymi faktami: wymagany poziom uprawnienia, maksymalny `rowLimit`, dzienny limit zapytań. Usunąć te wiersze z tabeli ryzyk i przenieść wartości do „Ograniczeń globalnych" tego planu.

- [ ] **Krok 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md
git commit -m "docs: ustalone limity i uprawnienia GSC (R1, R2)"
```

---

### Zadanie 1: Monorepo + normalizacja URL

Pierwszy nośny plik ze specyfikacji. Scaffolding monorepo jest złożony w to zadanie, bo bez niego normalizator nie ma się gdzie uruchomić.

**Pliki:**
- Utworzyć: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `vitest.config.ts`
- Utworzyć: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/url.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/url.test.ts`

**Interfejsy:**
- Konsumuje: nic (pierwsze zadanie)
- Produkuje: `NORMALIZER_VERSION: number`, `normalizeUrl(raw: string): NormalizedUrl`, `InvalidUrlError`, typ `NormalizedUrl { raw: string; normalized: string; hash: string; normalizerVersion: number }`

- [ ] **Krok 1: Scaffolding monorepo**

`package.json`:
```json
{
  "name": "seo-platform",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "test": "vitest run",
    "test:tz-east": "TZ=Pacific/Kiritimati vitest run",
    "test:tz-west": "TZ=Pacific/Niue vitest run",
    "check:deps": "tsx scripts/check-deps.ts",
    "check:secrets": "tsx scripts/check-secrets.ts"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "turbo": "^2.1.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.7.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.turbo/
*.sa.json
credentials/
*.db
*.db-journal
*.db-wal
out/
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'] },
})
```

`packages/core/package.json`:
```json
{
  "name": "@seo/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "build": "tsc" }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"], "compilerOptions": { "outDir": "dist" } }
```

- [ ] **Krok 2: Napisać test wzorcowy (musi nie przejść)**

`packages/core/src/url.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { InvalidUrlError, NORMALIZER_VERSION, normalizeUrl } from './url.js'

const CASES: ReadonlyArray<readonly [string, string]> = [
  // schemat, host, port
  ['https://example.com', 'https://example.com/'],
  ['HTTPS://EXAMPLE.COM/', 'https://example.com/'],
  ['https://example.com:443/a', 'https://example.com/a'],
  ['http://example.com:80/a', 'http://example.com/a'],
  ['https://example.com:8443/a', 'https://example.com:8443/a'],
  // www NIE jest usuwane (D4)
  ['https://www.example.com/a', 'https://www.example.com/a'],
  // fragment usuwany
  ['https://example.com/a#sekcja', 'https://example.com/a'],
  ['https://example.com/a#', 'https://example.com/a'],
  // ukosnik na koncu zachowywany (D4)
  ['https://example.com/a/', 'https://example.com/a/'],
  ['https://example.com/a', 'https://example.com/a'],
  // wielkosc liter w sciezce zachowywana
  ['https://example.com/Buty', 'https://example.com/Buty'],
  // puste zapytanie usuwane
  ['https://example.com/a?', 'https://example.com/a'],
  // parametry sortowane
  ['https://example.com/a?b=2&a=1', 'https://example.com/a?a=1&b=2'],
  ['https://example.com/a?a=2&a=1', 'https://example.com/a?a=1&a=2'],
  // parametry sledzace usuwane
  ['https://example.com/a?utm_source=x', 'https://example.com/a'],
  ['https://example.com/a?utm_source=x&b=1', 'https://example.com/a?b=1'],
  ['https://example.com/a?UTM_Medium=x&b=1', 'https://example.com/a?b=1'],
  ['https://example.com/a?gclid=x', 'https://example.com/a'],
  ['https://example.com/a?fbclid=x&msclkid=y', 'https://example.com/a'],
  ['https://example.com/a?_ga=1&_gl=2', 'https://example.com/a'],
  // ref NIE jest parametrem sledzacym (D4)
  ['https://example.com/a?fbclid=x&ref=newsletter', 'https://example.com/a?ref=newsletter'],
  // IDN -> punycode
  ['https://xn--bcher-kva.example/a', 'https://xn--bcher-kva.example/a'],
  ['https://ücher.example/a'.replace('ücher', 'bücher'), 'https://xn--bcher-kva.example/a'],
  // percent-encoding: znaki unreserved dekodowane, reszta wielkimi literami
  ['https://example.com/%7Euser', 'https://example.com/~user'],
  ['https://example.com/a%2fb', 'https://example.com/a%2Fb'],
  ['https://example.com/a%2Fb', 'https://example.com/a%2Fb'],
  // dane logowania usuwane
  ['https://user:pass@example.com/a', 'https://example.com/a'],
]

describe('normalizeUrl', () => {
  it.each(CASES)('%s -> %s', (raw, expected) => {
    expect(normalizeUrl(raw).normalized).toBe(expected)
  })

  it('zwraca surowy URL bez zmian', () => {
    expect(normalizeUrl('https://example.com/a#x').raw).toBe('https://example.com/a#x')
  })

  it('stempluje wersje normalizatora', () => {
    expect(normalizeUrl('https://example.com/').normalizerVersion).toBe(NORMALIZER_VERSION)
  })

  it('hash jest deterministyczny i ma 32 znaki', () => {
    const a = normalizeUrl('https://example.com/a?b=2&a=1')
    const b = normalizeUrl('https://example.com/a?a=1&b=2&utm_source=z')
    expect(a.hash).toBe(b.hash)
    expect(a.hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('rozne URL-e maja rozne hashe', () => {
    expect(normalizeUrl('https://example.com/a').hash).not.toBe(normalizeUrl('https://example.com/b').hash)
  })

  it('odrzuca schematy inne niz http i https', () => {
    expect(() => normalizeUrl('ftp://example.com/a')).toThrow(InvalidUrlError)
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(InvalidUrlError)
  })

  it('odrzuca smieci', () => {
    expect(() => normalizeUrl('nie-url')).toThrow(InvalidUrlError)
    expect(() => normalizeUrl('')).toThrow(InvalidUrlError)
  })
})
```

- [ ] **Krok 3: Uruchomić test i potwierdzić, że nie przechodzi**

Uruchom: `pnpm vitest run packages/core/src/url.test.ts`
Oczekiwane: FAIL — `Cannot find module './url.js'`

- [ ] **Krok 4: Zaimplementować normalizator**

`packages/core/src/url.ts`:
```ts
import { createHash } from 'node:crypto'

/**
 * Wersja regul normalizacji. Zmiana tej stalej unieważnia porownywalnosc
 * zapisanych url_hash — wymaga nowych wierszy i skryptu backfillu (D4).
 */
export const NORMALIZER_VERSION = 1

export class InvalidUrlError extends Error {
  constructor(
    readonly raw: string,
    readonly reason: string,
  ) {
    super(`Nieprawidlowy URL (${reason}): ${raw}`)
    this.name = 'InvalidUrlError'
  }
}

export interface NormalizedUrl {
  readonly raw: string
  readonly normalized: string
  readonly hash: string
  readonly normalizerVersion: number
}

/** Parametry czysto sledzace. `ref` swiadomie pominiete — bywa nosnikiem tresci. */
const TRACKING_PARAM_PATTERNS: readonly RegExp[] = [
  /^utm_/i,
  /^(gclid|gbraid|wbraid|fbclid|msclkid|mc_eid|mc_cid|yclid|igshid|ttclid|li_fat_id|_ga|_gl|_hsenc|_hsmi|vero_id|s_kwcid)$/i,
]

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((p) => p.test(name))
}

/** RFC 3986: znaki unreserved dekodujemy, pozostale trojki zapisujemy wielkimi literami. */
function canonicalizePercentEncoding(value: string): string {
  return value.replace(/%([0-9a-fA-F]{2})/g, (_match, hex: string) => {
    const ch = String.fromCharCode(Number.parseInt(hex, 16))
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : `%${hex.toUpperCase()}`
  })
}

function compareParams(a: readonly [string, string], b: readonly [string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1
  return 0
}

export function normalizeUrl(raw: string): NormalizedUrl {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new InvalidUrlError(raw, 'nie da sie sparsowac')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError(raw, `nieobslugiwany schemat ${parsed.protocol}`)
  }

  // URL juz: obniza wielkosc liter w hoscie, robi punycode, usuwa domyslny port.
  parsed.hash = ''
  parsed.username = ''
  parsed.password = ''

  const params = [...parsed.searchParams.entries()].filter(([name]) => !isTrackingParam(name))
  params.sort(compareParams)
  const query = new URLSearchParams(params).toString()

  const path = canonicalizePercentEncoding(parsed.pathname)
  const normalized = `${parsed.protocol}//${parsed.host}${path}${query ? `?${query}` : ''}`

  return {
    raw,
    normalized,
    hash: createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 32),
    normalizerVersion: NORMALIZER_VERSION,
  }
}
```

`packages/core/src/index.ts`:
```ts
export { InvalidUrlError, NORMALIZER_VERSION, normalizeUrl, type NormalizedUrl } from './url.js'
```

- [ ] **Krok 5: Uruchomić test i potwierdzić, że przechodzi**

Uruchom: `pnpm vitest run packages/core/src/url.test.ts`
Oczekiwane: PASS, wszystkie przypadki.

Jeżeli któryś przypadek percent-encoding nie przechodzi, **nie zmieniaj oczekiwanej wartości** — wartości w tabeli są niezależne od tego, czy parser `URL` sam kanonizuje, ponieważ nasza funkcja przetwarza jego wynik. Niezgodność oznacza błąd w `canonicalizePercentEncoding`.

- [ ] **Krok 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore vitest.config.ts packages/core
git commit -m "feat(core): monorepo + normalizacja URL z NORMALIZER_VERSION"
```

---

### Zadanie 2: Identyfikatory i zakres tenanta

**Pliki:**
- Utworzyć: `packages/core/src/ids.ts`, `packages/core/src/tenant.ts`
- Modyfikacja: `packages/core/src/index.ts`
- Test: `packages/core/src/ids.test.ts`, `packages/core/src/tenant.test.ts`

**Interfejsy:**
- Konsumuje: nic
- Produkuje: `newId(): Ulid`, `isUlid(v: string): v is Ulid`, typ `Ulid`; `tenantScope(id: string): TenantScope`, `LOCAL_TENANT: TenantId`, typy `TenantId`, `TenantScope { readonly tenantId: TenantId }`

- [ ] **Krok 1: Dodać zależność**

```bash
pnpm --filter @seo/core add ulid
```

- [ ] **Krok 2: Napisać testy (muszą nie przejść)**

`packages/core/src/ids.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isUlid, newId } from './ids.js'

describe('newId', () => {
  it('generuje ULID o poprawnym ksztalcie', () => {
    expect(isUlid(newId())).toBe(true)
  })

  it('generuje wartosci unikalne', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
  })

  it('generuje wartosci rosnace leksykograficznie w czasie', async () => {
    const first = newId()
    await new Promise((r) => setTimeout(r, 2))
    expect(newId() > first).toBe(true)
  })

  it('odrzuca ksztalty inne niz ULID', () => {
    expect(isUlid('za-krotki')).toBe(false)
    expect(isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAI')).toBe(false) // I nie nalezy do alfabetu Crockforda
  })
})
```

`packages/core/src/tenant.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { LOCAL_TENANT, tenantScope } from './tenant.js'

describe('tenantScope', () => {
  it('przyjmuje poprawny slug', () => {
    expect(tenantScope('acme-sp-z-oo').tenantId).toBe('acme-sp-z-oo')
  })

  it('LOCAL_TENANT jest poprawny', () => {
    expect(tenantScope(LOCAL_TENANT).tenantId).toBe('local')
  })

  it.each(['', 'A', '-zaczyna-myslnikiem', 'ze spacja', 'Wielkie', 'x', 'a'.repeat(64), 'kropka.w.srodku'])(
    'odrzuca %s',
    (bad) => {
      expect(() => tenantScope(bad)).toThrow()
    },
  )
})
```

- [ ] **Krok 3: Uruchomić testy i potwierdzić, że nie przechodzą**

Uruchom: `pnpm vitest run packages/core/src/ids.test.ts packages/core/src/tenant.test.ts`
Oczekiwane: FAIL — brak modułów.

- [ ] **Krok 4: Zaimplementować**

`packages/core/src/ids.ts`:
```ts
import { ulid } from 'ulid'

/** ULID w postaci tekstowej. Marka typu zapobiega podstawieniu zwyklego stringa. */
export type Ulid = string & { readonly __brand: 'Ulid' }

/** Alfabet Crockford base32: bez I, L, O, U. */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function newId(): Ulid {
  return ulid() as Ulid
}

export function isUlid(value: string): value is Ulid {
  return ULID_PATTERN.test(value)
}
```

`packages/core/src/tenant.ts`:
```ts
export type TenantId = string & { readonly __brand: 'TenantId' }

export const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/

export const LOCAL_TENANT = 'local' as TenantId

/**
 * Jedyny sposob uzyskania TenantId. Kazda funkcja w packages/db przyjmuje
 * TenantScope pierwszym argumentem — to jest linia obrony przed wyciekiem
 * danych miedzy klientami (D5).
 */
export interface TenantScope {
  readonly tenantId: TenantId
}

export function tenantScope(id: string): TenantScope {
  if (!TENANT_ID_PATTERN.test(id)) {
    throw new Error(`Nieprawidlowy identyfikator tenanta: ${JSON.stringify(id)}`)
  }
  return { tenantId: id as TenantId }
}
```

Dopisać do `packages/core/src/index.ts`:
```ts
export { ULID_PATTERN, isUlid, newId, type Ulid } from './ids.js'
export { LOCAL_TENANT, TENANT_ID_PATTERN, tenantScope, type TenantId, type TenantScope } from './tenant.js'
```

- [ ] **Krok 5: Uruchomić testy i potwierdzić, że przechodzą**

Uruchom: `pnpm vitest run packages/core`
Oczekiwane: PASS.

- [ ] **Krok 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): ULID i TenantScope"
```

---

### Zadanie 3: Schemat bazy i migrator

**Pliki:**
- Utworzyć: `packages/db/package.json`, `packages/db/tsconfig.json`
- Utworzyć: `packages/db/migrations/0001_init.sql`
- Utworzyć: `packages/db/src/connection.ts`, `packages/db/src/migrate.ts`, `packages/db/src/schema.ts`
- Test: `packages/db/src/migrate.test.ts`

**Interfejsy:**
- Konsumuje: nic z wcześniejszych zadań
- Produkuje: `openDatabase(path: string): Db`, `migrate(db: Db): string[]` (zwraca nazwy zastosowanych migracji), `Db` = `BetterSQLite3Database<typeof schema>`, obiekty tabel z `schema.ts`

- [ ] **Krok 1: Dodać zależności**

```bash
pnpm --filter @seo/db add better-sqlite3 drizzle-orm zod
pnpm --filter @seo/db add -D @types/better-sqlite3
```

`packages/db/package.json` (jak `@seo/core`, nazwa `@seo/db`, zależność `"@seo/core": "workspace:*"`).

- [ ] **Krok 2: Napisać migrację SQL**

`packages/db/migrations/0001_init.sql`:
```sql
CREATE TABLE tenant (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE site (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  property_type TEXT NOT NULL CHECK (property_type IN ('domain','url_prefix')),
  property_uri  TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX site_tenant_property_uq ON site (tenant_id, property_uri);

CREATE TABLE url (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenant(id),
  site_id            TEXT NOT NULL REFERENCES site(id),
  url_raw            TEXT NOT NULL,
  url_normalized     TEXT NOT NULL,
  url_hash           TEXT NOT NULL,
  normalizer_version INTEGER NOT NULL,
  first_seen_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX url_tenant_hash_ver_uq ON url (tenant_id, url_hash, normalizer_version);
CREATE INDEX url_tenant_site_idx ON url (tenant_id, site_id);

CREATE TABLE gsc_sync_run (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  site_id      TEXT NOT NULL REFERENCES site(id),
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  date_from    TEXT NOT NULL,
  date_to      TEXT NOT NULL,
  data_state   TEXT NOT NULL CHECK (data_state IN ('final','all')),
  dimensions   TEXT NOT NULL,
  rows_fetched INTEGER NOT NULL DEFAULT 0,
  ok           INTEGER,
  error        TEXT
);
CREATE INDEX gsc_sync_run_tenant_site_idx ON gsc_sync_run (tenant_id, site_id, started_at);

CREATE TABLE gsc_daily (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenant(id),
  site_id         TEXT NOT NULL REFERENCES site(id),
  date            TEXT NOT NULL,
  source_timezone TEXT NOT NULL,
  clicks          INTEGER NOT NULL,
  impressions     INTEGER NOT NULL,
  ctr             REAL NOT NULL,
  position        REAL NOT NULL,
  data_state      TEXT NOT NULL CHECK (data_state IN ('final','all')),
  sync_run_id     TEXT NOT NULL REFERENCES gsc_sync_run(id)
);
CREATE UNIQUE INDEX gsc_daily_uq ON gsc_daily (tenant_id, site_id, date, data_state);

CREATE TABLE gsc_query_daily (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenant(id),
  site_id         TEXT NOT NULL REFERENCES site(id),
  date            TEXT NOT NULL,
  source_timezone TEXT NOT NULL,
  query           TEXT NOT NULL,
  clicks          INTEGER NOT NULL,
  impressions     INTEGER NOT NULL,
  ctr             REAL NOT NULL,
  position        REAL NOT NULL,
  data_state      TEXT NOT NULL CHECK (data_state IN ('final','all')),
  sync_run_id     TEXT NOT NULL REFERENCES gsc_sync_run(id)
);
CREATE UNIQUE INDEX gsc_query_daily_uq ON gsc_query_daily (tenant_id, site_id, date, query, data_state);
CREATE INDEX gsc_query_daily_date_idx ON gsc_query_daily (tenant_id, site_id, date);

CREATE TABLE gsc_reconciliation (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL REFERENCES tenant(id),
  site_id                      TEXT NOT NULL REFERENCES site(id),
  date                         TEXT NOT NULL,
  total_clicks                 INTEGER NOT NULL,
  query_sum_clicks             INTEGER NOT NULL,
  anonymized_delta_clicks      INTEGER NOT NULL,
  total_impressions            INTEGER NOT NULL,
  query_sum_impressions        INTEGER NOT NULL,
  anonymized_delta_impressions INTEGER NOT NULL,
  checked_at                   INTEGER NOT NULL
);
CREATE UNIQUE INDEX gsc_reconciliation_uq ON gsc_reconciliation (tenant_id, site_id, date);

CREATE TABLE provider_call (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  provider_id         TEXT NOT NULL,
  capability          TEXT NOT NULL,
  started_at          INTEGER NOT NULL,
  duration_ms         INTEGER NOT NULL,
  ok                  INTEGER NOT NULL,
  http_status         INTEGER,
  error_code          TEXT,
  quota_units         INTEGER NOT NULL DEFAULT 1,
  cost_micros         INTEGER NOT NULL DEFAULT 0,
  request_fingerprint TEXT NOT NULL
);
CREATE INDEX provider_call_tenant_started_idx ON provider_call (tenant_id, started_at);
CREATE INDEX provider_call_provider_idx ON provider_call (tenant_id, provider_id, started_at);
```

- [ ] **Krok 3: Napisać test migratora (musi nie przejść)**

`packages/db/src/migrate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { openDatabase, rawHandle } from './connection.js'
import { migrate } from './migrate.js'

const TABLES = [
  'tenant', 'site', 'url', 'gsc_sync_run', 'gsc_daily',
  'gsc_query_daily', 'gsc_reconciliation', 'provider_call',
]

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  return rawHandle(db)
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name)
}

describe('migrate', () => {
  it('tworzy wszystkie tabele Fazy 0', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    for (const t of TABLES) expect(tableNames(db)).toContain(t)
  })

  it('jest idempotentny', () => {
    const db = openDatabase(':memory:')
    expect(migrate(db)).toEqual(['0001_init.sql'])
    expect(migrate(db)).toEqual([])
  })

  it('wlacza klucze obce', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const row = rawHandle(db).prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(row.foreign_keys).toBe(1)
  })

  it('egzekwuje CHECK na property_type', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const h = rawHandle(db)
    h.prepare('INSERT INTO tenant VALUES (?,?,?)').run('local', 'Local', 1)
    expect(() =>
      h.prepare('INSERT INTO site VALUES (?,?,?,?,?)').run('id1', 'local', 'zle', 'https://x/', 1),
    ).toThrow()
  })

  it('egzekwuje unikalnosc gsc_daily po tenancie', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const h = rawHandle(db)
    h.prepare('INSERT INTO tenant VALUES (?,?,?)').run('local', 'Local', 1)
    h.prepare('INSERT INTO site VALUES (?,?,?,?,?)').run('s1', 'local', 'domain', 'sc-domain:x.pl', 1)
    h.prepare('INSERT INTO gsc_sync_run (id,tenant_id,site_id,started_at,date_from,date_to,data_state,dimensions) VALUES (?,?,?,?,?,?,?,?)')
      .run('r1', 'local', 's1', 1, '2026-01-01', '2026-01-02', 'final', 'date')
    const ins = h.prepare('INSERT INTO gsc_daily VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    ins.run('d1', 'local', 's1', '2026-01-01', 'America/Los_Angeles', 5, 100, 0.05, 3.2, 'final', 'r1')
    expect(() =>
      ins.run('d2', 'local', 's1', '2026-01-01', 'America/Los_Angeles', 6, 100, 0.06, 3.2, 'final', 'r1'),
    ).toThrow()
  })
})
```

- [ ] **Krok 4: Uruchomić test i potwierdzić, że nie przechodzi**

Uruchom: `pnpm vitest run packages/db/src/migrate.test.ts`
Oczekiwane: FAIL — brak `./connection.js`.

- [ ] **Krok 5: Zaimplementować połączenie i migrator**

`packages/db/src/connection.ts`:
```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

export type Db = BetterSQLite3Database<typeof schema>

const HANDLES = new WeakMap<object, Database.Database>()

export function openDatabase(path: string): Db {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  HANDLES.set(db, sqlite)
  return db
}

/** Surowy uchwyt — wylacznie dla migratora i testow wewnatrz @seo/db. */
export function rawHandle(db: Db): Database.Database {
  const handle = HANDLES.get(db)
  if (!handle) throw new Error('Baza nie zostala otwarta przez openDatabase')
  return handle
}
```

`packages/db/src/migrate.ts`:
```ts
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Db, rawHandle } from './connection.js'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/** Stosuje migracje w kolejnosci nazw. Zwraca nazwy tych, ktore zostaly zastosowane teraz. */
export function migrate(db: Db): string[] {
  const h = rawHandle(db)
  h.exec('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')

  const applied = new Set(
    h.prepare('SELECT name FROM schema_migration').all().map((r) => (r as { name: string }).name),
  )
  const pending = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort()

  for (const name of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8')
    h.transaction(() => {
      h.exec(sql)
      h.prepare('INSERT INTO schema_migration VALUES (?, ?)').run(name, Date.now())
    })()
  }
  return pending
}
```

- [ ] **Krok 6: Zaimplementować schemat Drizzle (wyłącznie typowanie)**

`packages/db/src/schema.ts` — definicje muszą odpowiadać DDL co do nazw kolumn. Wzorzec dla każdej tabeli:
```ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const tenant = sqliteTable('tenant', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const site = sqliteTable('site', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  propertyType: text('property_type', { enum: ['domain', 'url_prefix'] }).notNull(),
  propertyUri: text('property_uri').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const gscDaily = sqliteTable('gsc_daily', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  date: text('date').notNull(),
  sourceTimezone: text('source_timezone').notNull(),
  clicks: integer('clicks').notNull(),
  impressions: integer('impressions').notNull(),
  ctr: real('ctr').notNull(),
  position: real('position').notNull(),
  dataState: text('data_state', { enum: ['final', 'all'] }).notNull(),
  syncRunId: text('sync_run_id').notNull(),
})
```
Pozostałe tabele (`url`, `gscSyncRun`, `gscQueryDaily`, `gscReconciliation`, `providerCall`) zdefiniować analogicznie, kolumna po kolumnie zgodnie z DDL z Kroku 2. Indeksy i klucze obce **nie** są deklarowane w Drizzle — żyją wyłącznie w SQL.

- [ ] **Krok 7: Uruchomić test i potwierdzić, że przechodzi**

Uruchom: `pnpm vitest run packages/db`
Oczekiwane: PASS.

- [ ] **Krok 8: Commit**

```bash
git add packages/db
git commit -m "feat(db): schemat SQLite, migrator na plikach SQL"
```

---

### Zadanie 4: Warstwa repozytoriów scoped per tenant

Realizuje AC6. To jest jedyna linia obrony przed wyciekiem danych między klientami (D5), więc test izolacji jest tu ważniejszy od implementacji.

**Pliki:**
- Utworzyć: `packages/db/src/repo.ts`, `packages/db/src/read-fixtures.ts`
- Modyfikacja: `packages/db/src/index.ts`
- Test: `packages/db/src/isolation.test.ts`

**Interfejsy:**
- Konsumuje: `openDatabase`, `migrate` (Zadanie 3); `TenantScope`, `newId` (Zadania 1–2)
- Produkuje: `repos(db: Db, scope: TenantScope)` zwracające `{ read, write }`, oraz `type Repos = ReturnType<typeof repos>` (typ wnioskowany, bez ręcznie pisanych interfejsów — dzięki temu lista metod `read` nie może rozjechać się z rejestrem `READ_METHOD_ARGS`). `packages/db/src/index.ts` eksportuje **wyłącznie** `openDatabase`, `migrate`, `repos` i typy — nigdy `rawHandle` ani `schema`.

- [ ] **Krok 1: Napisać test izolacji (musi nie przejść)**

`packages/db/src/isolation.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { tenantScope } from '@seo/core'
import { openDatabase } from './connection.js'
import { migrate } from './migrate.js'
import { repos } from './repo.js'
import { FOREIGN_FIXTURE, READ_METHOD_ARGS } from './read-fixtures.js'

const A = tenantScope('tenant-a')
const B = tenantScope('tenant-b')

function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  for (const [scope, marker] of [[A, 'marker-a'], [B, FOREIGN_FIXTURE.marker]] as const) {
    const r = repos(db, scope)
    r.write.ensureTenant(scope.tenantId)
    const site = r.write.upsertSite('domain', `sc-domain:${marker}.example`)
    const run = r.write.startSyncRun(site.id, '2026-03-01', '2026-03-02', 'final', 'date')
    r.write.upsertDaily(site.id, run, [
      { date: '2026-03-01', clicks: 7, impressions: 70, ctr: 0.1, position: 4 },
    ])
    r.write.upsertQueryDaily(site.id, run, [
      { date: '2026-03-01', query: marker, clicks: 7, impressions: 70, ctr: 0.1, position: 4 },
    ])
    r.write.upsertReconciliation(site.id, {
      date: '2026-03-01', totalClicks: 7, querySumClicks: 7, totalImpressions: 70, querySumImpressions: 70,
    })
    r.write.recordProviderCall({
      providerId: 'gsc', capability: 'performance.byDate', startedAt: 1, durationMs: 2,
      ok: true, httpStatus: 200, quotaUnits: 1, costMicros: 0, requestFingerprint: marker,
    })
  }
  return db
}

describe('izolacja tenantow (AC6)', () => {
  let db: ReturnType<typeof openDatabase>
  beforeEach(() => { db = seeded() })

  it('kazda metoda odczytu ma wpis w rejestrze argumentow', () => {
    const declared = Object.keys(repos(db, A).read).sort()
    expect(declared).toEqual(Object.keys(READ_METHOD_ARGS).sort())
  })

  it.each(Object.keys(READ_METHOD_ARGS))('%s nie zwraca danych obcego tenanta', (name) => {
    const read = repos(db, A).read as Record<string, (...a: unknown[]) => unknown>
    const foreignSiteId = repos(db, B).read.listSites()[0]!.id
    const args = READ_METHOD_ARGS[name]!({ ...FOREIGN_FIXTURE, siteId: foreignSiteId })
    const json = JSON.stringify(read[name]!(...args) ?? null)
    expect(json).not.toContain('tenant-b')
    expect(json).not.toContain(FOREIGN_FIXTURE.marker)
    expect(json).not.toContain(foreignSiteId)
  })

  it('zapis pod scope A nie tworzy wierszy widocznych dla B', () => {
    repos(db, A).write.upsertSite('url_prefix', 'https://wspolny.example/')
    repos(db, B).write.upsertSite('url_prefix', 'https://wspolny.example/')
    expect(repos(db, A).read.listSites()).toHaveLength(2)
    expect(repos(db, B).read.listSites()).toHaveLength(2)
    expect(repos(db, A).read.listSites().every((s) => s.tenantId === 'tenant-a')).toBe(true)
  })
})
```

- [ ] **Krok 2: Napisać rejestr argumentów metod odczytu**

`packages/db/src/read-fixtures.ts`:
```ts
export interface ForeignFixture {
  readonly marker: string
  readonly siteId: string
  readonly date: string
}

export const FOREIGN_FIXTURE: ForeignFixture = {
  marker: 'obcy-marker-b',
  siteId: 'PODMIENIANE-W-TESCIE',
  date: '2026-03-01',
}

/**
 * Kazda metoda z Repos["read"] MUSI miec tu wpis. Test AC6 porownuje ten
 * rejestr z faktyczna lista metod, wiec nowa metoda bez wpisu psuje CI.
 */
export const READ_METHOD_ARGS: Record<string, (f: ForeignFixture) => unknown[]> = {
  listSites: () => [],
  findSiteByUri: (f) => [`sc-domain:${f.marker}.example`],
  listDailyRange: (f) => [f.siteId, '2000-01-01', '2100-01-01'],
  topQueries: (f) => [f.siteId, '2000-01-01', '2100-01-01', 50],
  listReconciliations: (f) => [f.siteId, '2000-01-01', '2100-01-01'],
  getReconciliation: (f) => [f.siteId, f.date],
  providerCallSummary: () => [0, Number.MAX_SAFE_INTEGER],
  latestSyncRun: (f) => [f.siteId],
}
```

- [ ] **Krok 3: Uruchomić test i potwierdzić, że nie przechodzi**

Uruchom: `pnpm vitest run packages/db/src/isolation.test.ts`
Oczekiwane: FAIL — brak `./repo.js`.

- [ ] **Krok 4: Zaimplementować warstwę repozytoriów**

`packages/db/src/repo.ts`:
```ts
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { GSC_SOURCE_TIMEZONE, type TenantScope, newId } from '@seo/core'
import type { Db } from './connection.js'
import * as s from './schema.js'

// Daty sa tekstem YYYY-MM-DD — porzadek leksykograficzny jest tozsamy
// z chronologicznym, wiec gte/lte na tekscie sa poprawne (D3).

export interface DailyInput {
  date: string; clicks: number; impressions: number; ctr: number; position: number
}
export interface QueryDailyInput extends DailyInput { query: string }
export interface ReconciliationInput {
  date: string; totalClicks: number; querySumClicks: number
  totalImpressions: number; querySumImpressions: number
}
export interface ProviderCallInput {
  providerId: string; capability: string; startedAt: number; durationMs: number
  ok: boolean; httpStatus?: number | undefined; errorCode?: string | undefined
  quotaUnits: number; costMicros: number; requestFingerprint: string
}

export function repos(db: Db, scope: TenantScope) {
  const t = scope.tenantId

  const read = {
    listSites: () =>
      db.select().from(s.site).where(eq(s.site.tenantId, t)).orderBy(asc(s.site.propertyUri)).all(),

    findSiteByUri: (propertyUri: string) =>
      db.select().from(s.site)
        .where(and(eq(s.site.tenantId, t), eq(s.site.propertyUri, propertyUri))).get(),

    listDailyRange: (siteId: string, from: string, to: string) =>
      db.select().from(s.gscDaily)
        .where(and(
          eq(s.gscDaily.tenantId, t), eq(s.gscDaily.siteId, siteId),
          eq(s.gscDaily.dataState, 'final'),
          gte(s.gscDaily.date, from), lte(s.gscDaily.date, to),
        ))
        .orderBy(asc(s.gscDaily.date)).all(),

    topQueries: (siteId: string, from: string, to: string, limit: number) =>
      db.select({
        query: s.gscQueryDaily.query,
        clicks: sql<number>`sum(${s.gscQueryDaily.clicks})`.as('clicks'),
        impressions: sql<number>`sum(${s.gscQueryDaily.impressions})`.as('impressions'),
      }).from(s.gscQueryDaily)
        .where(and(
          eq(s.gscQueryDaily.tenantId, t), eq(s.gscQueryDaily.siteId, siteId),
          eq(s.gscQueryDaily.dataState, 'final'),
          gte(s.gscQueryDaily.date, from), lte(s.gscQueryDaily.date, to),
        ))
        .groupBy(s.gscQueryDaily.query)
        .orderBy(desc(sql`sum(${s.gscQueryDaily.clicks})`))
        .limit(limit).all(),

    listReconciliations: (siteId: string, from: string, to: string) =>
      db.select().from(s.gscReconciliation)
        .where(and(
          eq(s.gscReconciliation.tenantId, t), eq(s.gscReconciliation.siteId, siteId),
          gte(s.gscReconciliation.date, from), lte(s.gscReconciliation.date, to),
        ))
        .orderBy(asc(s.gscReconciliation.date)).all(),

    getReconciliation: (siteId: string, date: string) =>
      db.select().from(s.gscReconciliation)
        .where(and(
          eq(s.gscReconciliation.tenantId, t), eq(s.gscReconciliation.siteId, siteId),
          eq(s.gscReconciliation.date, date),
        )).get(),

    providerCallSummary: (fromMs: number, toMs: number) =>
      db.select({
        providerId: s.providerCall.providerId,
        capability: s.providerCall.capability,
        calls: sql<number>`count(*)`.as('calls'),
        quotaUnits: sql<number>`sum(${s.providerCall.quotaUnits})`.as('quota_units'),
        costMicros: sql<number>`sum(${s.providerCall.costMicros})`.as('cost_micros'),
        failures: sql<number>`sum(case when ${s.providerCall.ok} = 0 then 1 else 0 end)`.as('failures'),
      }).from(s.providerCall)
        .where(and(
          eq(s.providerCall.tenantId, t),
          gte(s.providerCall.startedAt, fromMs), lte(s.providerCall.startedAt, toMs),
        ))
        .groupBy(s.providerCall.providerId, s.providerCall.capability).all(),

    latestSyncRun: (siteId: string) =>
      db.select().from(s.gscSyncRun)
        .where(and(eq(s.gscSyncRun.tenantId, t), eq(s.gscSyncRun.siteId, siteId)))
        .orderBy(desc(s.gscSyncRun.startedAt)).limit(1).get(),
  }

  const write = {
    ensureTenant: (name: string) => {
      db.insert(s.tenant).values({ id: t, name, createdAt: Date.now() })
        .onConflictDoNothing().run()
    },

    upsertSite: (propertyType: 'domain' | 'url_prefix', propertyUri: string) => {
      const existing = read.findSiteByUri(propertyUri)
      if (existing) return existing
      const row = { id: newId(), tenantId: t, propertyType, propertyUri, createdAt: Date.now() }
      db.insert(s.site).values(row).run()
      return row
    },

    startSyncRun: (
      siteId: string, dateFrom: string, dateTo: string,
      dataState: 'final' | 'all', dimensions: string,
    ) => {
      const id = newId()
      db.insert(s.gscSyncRun).values({
        id, tenantId: t, siteId, startedAt: Date.now(),
        dateFrom, dateTo, dataState, dimensions, rowsFetched: 0,
      }).run()
      return id
    },

    finishSyncRun: (runId: string, rowsFetched: number, ok: boolean, error?: string) => {
      db.update(s.gscSyncRun)
        .set({ finishedAt: Date.now(), rowsFetched, ok: ok ? 1 : 0, error: error ?? null })
        .where(and(eq(s.gscSyncRun.tenantId, t), eq(s.gscSyncRun.id, runId))).run()
    },

    upsertDaily: (siteId: string, syncRunId: string, rows: readonly DailyInput[]) => {
      for (const r of rows) {
        db.insert(s.gscDaily).values({
          id: newId(), tenantId: t, siteId, date: r.date,
          sourceTimezone: GSC_SOURCE_TIMEZONE, clicks: r.clicks, impressions: r.impressions,
          ctr: r.ctr, position: r.position, dataState: 'final', syncRunId,
        }).onConflictDoUpdate({
          target: [s.gscDaily.tenantId, s.gscDaily.siteId, s.gscDaily.date, s.gscDaily.dataState],
          set: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, syncRunId },
        }).run()
      }
    },

    upsertQueryDaily: (siteId: string, syncRunId: string, rows: readonly QueryDailyInput[]) => {
      for (const r of rows) {
        db.insert(s.gscQueryDaily).values({
          id: newId(), tenantId: t, siteId, date: r.date, sourceTimezone: GSC_SOURCE_TIMEZONE,
          query: r.query, clicks: r.clicks, impressions: r.impressions,
          ctr: r.ctr, position: r.position, dataState: 'final', syncRunId,
        }).onConflictDoUpdate({
          target: [s.gscQueryDaily.tenantId, s.gscQueryDaily.siteId, s.gscQueryDaily.date,
                   s.gscQueryDaily.query, s.gscQueryDaily.dataState],
          set: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, syncRunId },
        }).run()
      }
    },

    upsertReconciliation: (siteId: string, r: ReconciliationInput) => {
      const values = {
        id: newId(), tenantId: t, siteId, date: r.date,
        totalClicks: r.totalClicks, querySumClicks: r.querySumClicks,
        anonymizedDeltaClicks: r.totalClicks - r.querySumClicks,
        totalImpressions: r.totalImpressions, querySumImpressions: r.querySumImpressions,
        anonymizedDeltaImpressions: r.totalImpressions - r.querySumImpressions,
        checkedAt: Date.now(),
      }
      db.insert(s.gscReconciliation).values(values).onConflictDoUpdate({
        target: [s.gscReconciliation.tenantId, s.gscReconciliation.siteId, s.gscReconciliation.date],
        set: values,
      }).run()
    },

    recordProviderCall: (c: ProviderCallInput) => {
      db.insert(s.providerCall).values({
        id: newId(), tenantId: t, providerId: c.providerId, capability: c.capability,
        startedAt: c.startedAt, durationMs: c.durationMs, ok: c.ok ? 1 : 0,
        httpStatus: c.httpStatus ?? null, errorCode: c.errorCode ?? null,
        quotaUnits: c.quotaUnits, costMicros: c.costMicros, requestFingerprint: c.requestFingerprint,
      }).run()
    },
  }

  return { read, write }
}

export type Repos = ReturnType<typeof repos>
```

`packages/db/src/index.ts`:
```ts
export { openDatabase, type Db } from './connection.js'
export { migrate } from './migrate.js'
export {
  repos,
  type DailyInput, type ProviderCallInput, type QueryDailyInput,
  type ReconciliationInput, type Repos,
} from './repo.js'
// rawHandle i schema swiadomie nieeksportowane — jedynym wejsciem do bazy
// jest repos(), ktore wymusza TenantScope (D5).
```

- [ ] **Krok 5: Uruchomić testy i potwierdzić, że przechodzą**

Uruchom: `pnpm vitest run packages/db`
Oczekiwane: PASS. Jeżeli test „kazda metoda odczytu ma wpis w rejestrze" nie przechodzi, dopisz brakujący wpis do `READ_METHOD_ARGS` — nie osłabiaj testu.

- [ ] **Krok 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): repozytoria scoped per tenant + test izolacji (AC6)"
```

---

### Zadanie 5: Warstwa dostawców — typy i rejestr wywołań

Realizuje D7 i D9.

**Pliki:**
- Utworzyć: `packages/providers/package.json`, `packages/providers/tsconfig.json`
- Utworzyć: `packages/providers/src/types.ts`, `packages/providers/src/ledger.ts`, `packages/providers/src/index.ts`
- Test: `packages/providers/src/ledger.test.ts`

**Interfejsy:**
- Konsumuje: nic
- Produkuje: `SiteMetricsProvider`, `PerformanceQuery`, `PerformanceRow`, `PerformanceRows`, `DataState`, `ProviderId`, `SiteMetricsCapability`, `CallLedger`, `ProviderCallEntry`, `ProviderHttpError`, `withLedger`

- [ ] **Krok 1: Napisać test rejestru (musi nie przejść)**

`packages/providers/src/ledger.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ProviderHttpError, type ProviderCallEntry, withLedger } from './ledger.js'

function collector() {
  const entries: ProviderCallEntry[] = []
  return { entries, ledger: { record: (e: ProviderCallEntry) => { entries.push(e) } } }
}

const META = {
  providerId: 'gsc' as const,
  capability: 'performance.byDate',
  quotaUnits: 1,
  costMicros: 0,
  requestFingerprint: 'odcisk',
}

describe('withLedger', () => {
  it('zapisuje udane wywolanie i zwraca wartosc', async () => {
    const { entries, ledger } = collector()
    let t = 1000
    const value = await withLedger(ledger, META, () => (t += 25), async () => ({ value: 'ok', httpStatus: 200 }))
    expect(value).toBe('ok')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ ok: true, httpStatus: 200, quotaUnits: 1, costMicros: 0 })
    expect(entries[0]!.durationMs).toBe(25)
  })

  it('zapisuje nieudane wywolanie i przepuszcza blad', async () => {
    const { entries, ledger } = collector()
    await expect(
      withLedger(ledger, META, () => 0, async () => { throw new ProviderHttpError(429, 'rate_limit', 'za duzo') }),
    ).rejects.toThrow('za duzo')
    expect(entries[0]).toMatchObject({ ok: false, httpStatus: 429, errorCode: 'rate_limit' })
  })

  it('zapisuje blad nie-HTTP jako unknown', async () => {
    const { entries, ledger } = collector()
    await expect(withLedger(ledger, META, () => 0, async () => { throw new Error('siec padla') })).rejects.toThrow()
    expect(entries[0]).toMatchObject({ ok: false, errorCode: 'unknown' })
    expect(entries[0]!.httpStatus).toBeUndefined()
  })

  it('zapisuje wywolanie ZANIM blad opusci funkcje', async () => {
    const { entries, ledger } = collector()
    try {
      await withLedger(ledger, META, () => 0, async () => { throw new Error('x') })
    } catch {
      expect(entries).toHaveLength(1)
    }
  })
})
```

- [ ] **Krok 2: Uruchomić test i potwierdzić, że nie przechodzi**

Uruchom: `pnpm vitest run packages/providers`
Oczekiwane: FAIL — brak `./ledger.js`.

- [ ] **Krok 3: Zaimplementować typy**

`packages/providers/src/types.ts`:
```ts
export type ProviderId = 'gsc'
export type SiteMetricsCapability = 'performance.byDate' | 'performance.byQuery'
export type DataState = 'final' | 'all'
export type PerformanceDimension = 'date' | 'query'

export interface PerformanceQuery {
  readonly siteUrl: string
  /** YYYY-MM-DD w kalendarzu zrodla. Nigdy nie konwertowac na Date (D3). */
  readonly startDate: string
  readonly endDate: string
  readonly dimensions: readonly PerformanceDimension[]
  readonly dataState: DataState
  readonly rowLimit: number
  readonly startRow: number
}

export interface PerformanceRow {
  /** Wartosci wymiarow w kolejnosci z zapytania, przepisane doslownie z API. */
  readonly keys: readonly string[]
  readonly clicks: number
  readonly impressions: number
  readonly ctr: number
  readonly position: number
}

export interface PerformanceRows {
  readonly rows: readonly PerformanceRow[]
  /** Strefa kalendarza, w ktorym zrodlo raportuje daty. Nie sluzy do konwersji. */
  readonly sourceTimezone: string
}

export interface SiteMetricsProvider {
  readonly id: ProviderId
  readonly capabilities: readonly SiteMetricsCapability[]
  queryPerformance(query: PerformanceQuery): Promise<PerformanceRows>
  /** Ile jednostek limitu zuzyje ten zestaw zapytan. Dla zrodel darmowych to nadal >0. */
  estimateQuota(queries: readonly PerformanceQuery[]): number
}
```

`packages/providers/src/ledger.ts`:
```ts
export class ProviderHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'ProviderHttpError'
  }
}

export interface ProviderCallEntry {
  readonly providerId: string
  readonly capability: string
  readonly startedAt: number
  readonly durationMs: number
  readonly ok: boolean
  readonly httpStatus?: number | undefined
  readonly errorCode?: string | undefined
  readonly quotaUnits: number
  readonly costMicros: number
  readonly requestFingerprint: string
}

export interface CallLedger {
  record(entry: ProviderCallEntry): void
}

/** Rejestr, ktory nic nie zapisuje. Wylacznie do testow jednostkowych. */
export const NULL_LEDGER: CallLedger = { record() {} }

export interface CallMeta {
  readonly providerId: string
  readonly capability: string
  readonly quotaUnits: number
  readonly costMicros: number
  readonly requestFingerprint: string
}

/**
 * Kazde wyjscie poza proces przechodzi tedy (D7). Rejestr zapisuje sie takze
 * przy bledzie — inaczej zuzyty limit po nieudanym wywolaniu bylby niewidoczny.
 */
export async function withLedger<T>(
  ledger: CallLedger,
  meta: CallMeta,
  now: () => number,
  fn: () => Promise<{ value: T; httpStatus: number }>,
): Promise<T> {
  const startedAt = now()
  try {
    const { value, httpStatus } = await fn()
    ledger.record({ ...meta, startedAt, durationMs: now() - startedAt, ok: true, httpStatus })
    return value
  } catch (error) {
    const http = error instanceof ProviderHttpError ? error : undefined
    ledger.record({
      ...meta,
      startedAt,
      durationMs: now() - startedAt,
      ok: false,
      httpStatus: http?.status,
      errorCode: http?.code ?? 'unknown',
    })
    throw error
  }
}
```

`packages/providers/src/index.ts` reeksportuje wszystko z `types.ts` i `ledger.ts`.

- [ ] **Krok 4: Uruchomić test i potwierdzić, że przechodzi**

Uruchom: `pnpm vitest run packages/providers`
Oczekiwane: PASS.

- [ ] **Krok 5: Commit**

```bash
git add packages/providers
git commit -m "feat(providers): SiteMetricsProvider + rejestr wywolan zewnetrznych"
```

---

### Zadanie 6: Adapter Google Search Console

Realizuje AC5 i AC9. Zadanie 0 musi być zakończone, bo jego ustalenia wchodzą tu jako stałe.

**Pliki:**
- Utworzyć: `packages/providers/src/gsc/auth.ts`, `packages/providers/src/gsc/provider.ts`
- Utworzyć: `fixtures/gsc/by-date.json`, `fixtures/gsc/by-query-page1.json`, `fixtures/gsc/by-query-page2.json`, `fixtures/gsc/empty.json`
- Modyfikacja: `packages/providers/src/index.ts`
- Test: `packages/providers/src/gsc/provider.test.ts`

**Interfejsy:**
- Konsumuje: `SiteMetricsProvider`, `withLedger`, `ProviderHttpError`, `CallLedger` (Zadanie 5); `GSC_SOURCE_TIMEZONE` (Zadanie 7 — wykonaj je przed tym zadaniem albo dodaj sama stala do `packages/core/src/dates.ts` już teraz)
- Produkuje: `createGscProvider(deps: GscDeps): SiteMetricsProvider`, `createServiceAccountTokenSource(keyFilePath: string): () => Promise<string>`, `GSC_MAX_ROW_LIMIT`. `GSC_SOURCE_TIMEZONE` jest reeksportowane z `@seo/core` — nie definiuj go tutaj po raz drugi.

- [ ] **Krok 1: Dodać zależność i utworzyć fixture'y**

```bash
pnpm --filter @seo/providers add google-auth-library zod
```

`fixtures/gsc/by-date.json`:
```json
{
  "rows": [
    { "keys": ["2026-03-10"], "clicks": 42, "impressions": 1337, "ctr": 0.0314, "position": 8.2 },
    { "keys": ["2026-03-11"], "clicks": 51, "impressions": 1402, "ctr": 0.0364, "position": 7.9 }
  ]
}
```

`fixtures/gsc/by-query-page1.json`:
```json
{
  "rows": [
    { "keys": ["2026-03-10", "buty trekkingowe"], "clicks": 20, "impressions": 500, "ctr": 0.04, "position": 5.1 },
    { "keys": ["2026-03-10", "buty w gory"], "clicks": 10, "impressions": 300, "ctr": 0.0333, "position": 9.4 }
  ]
}
```

`fixtures/gsc/by-query-page2.json`:
```json
{
  "rows": [
    { "keys": ["2026-03-11", "buty trekkingowe"], "clicks": 30, "impressions": 600, "ctr": 0.05, "position": 4.8 }
  ]
}
```

`fixtures/gsc/empty.json`:
```json
{}
```

`empty.json` odwzorowuje realne zachowanie API: przy braku danych klucz `rows` **nie występuje**.

- [ ] **Krok 2: Napisać testy adaptera (muszą nie przejść)**

`packages/providers/src/gsc/provider.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NULL_LEDGER, ProviderHttpError, type ProviderCallEntry } from '../ledger.js'
import type { PerformanceQuery } from '../types.js'
import { GSC_SOURCE_TIMEZONE, createGscProvider } from './provider.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'fixtures', 'gsc')
const fixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'))

function fakeFetch(bodies: unknown[], status = 200) {
  const calls: { url: string; body: unknown; auth: string | null }[] = []
  let i = 0
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: headers.get('authorization') })
    const body = bodies[Math.min(i++, bodies.length - 1)]
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof globalThis.fetch
  return { fetchFn, calls }
}

const QUERY: PerformanceQuery = {
  siteUrl: 'sc-domain:example.pl',
  startDate: '2026-03-10',
  endDate: '2026-03-11',
  dimensions: ['date'],
  dataState: 'final',
  rowLimit: 25000,
  startRow: 0,
}

describe('adapter GSC', () => {
  it('przepisuje date doslownie, bez konwersji (AC5)', async () => {
    const { fetchFn } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    const result = await p.queryPerformance(QUERY)
    expect(result.rows[0]!.keys[0]).toBe('2026-03-10')
    expect(result.rows[1]!.keys[0]).toBe('2026-03-11')
    expect(result.sourceTimezone).toBe(GSC_SOURCE_TIMEZONE)
  })

  it('wysyla token i poprawne cialo zadania', async () => {
    const { fetchFn, calls } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    await p.queryPerformance(QUERY)
    expect(calls[0]!.auth).toBe('Bearer tok')
    expect(calls[0]!.url).toContain(encodeURIComponent('sc-domain:example.pl'))
    expect(calls[0]!.body).toMatchObject({
      startDate: '2026-03-10', endDate: '2026-03-11',
      dimensions: ['date'], dataState: 'final', rowLimit: 25000, startRow: 0,
    })
  })

  it('zwraca pusta liste, gdy API pomija klucz rows', async () => {
    const { fetchFn } = fakeFetch([fixture('empty.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    expect((await p.queryPerformance(QUERY)).rows).toEqual([])
  })

  it('odczytuje oba wymiary przy dimensions [date, query]', async () => {
    const { fetchFn } = fakeFetch([fixture('by-query-page1.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    const r = await p.queryPerformance({ ...QUERY, dimensions: ['date', 'query'] })
    expect(r.rows[0]!.keys).toEqual(['2026-03-10', 'buty trekkingowe'])
  })

  it('zapisuje wywolanie w rejestrze', async () => {
    const entries: ProviderCallEntry[] = []
    const { fetchFn } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({
      getAccessToken: async () => 'tok', fetchFn,
      ledger: { record: (e) => entries.push(e) }, now: () => 5,
    })
    await p.queryPerformance(QUERY)
    expect(entries[0]).toMatchObject({
      providerId: 'gsc', capability: 'performance.byDate', ok: true, httpStatus: 200, costMicros: 0,
    })
  })

  it('zamienia blad HTTP na ProviderHttpError i rejestruje go', async () => {
    const entries: ProviderCallEntry[] = []
    const { fetchFn } = fakeFetch([{ error: { message: 'brak dostepu' } }], 403)
    const p = createGscProvider({
      getAccessToken: async () => 'tok', fetchFn,
      ledger: { record: (e) => entries.push(e) }, now: () => 0,
    })
    await expect(p.queryPerformance(QUERY)).rejects.toThrow(ProviderHttpError)
    expect(entries[0]).toMatchObject({ ok: false, httpStatus: 403 })
  })

  it('odrzuca rowLimit ponad maksimum', async () => {
    const { fetchFn } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    await expect(p.queryPerformance({ ...QUERY, rowLimit: 1_000_000 })).rejects.toThrow(/rowLimit/)
  })

  it('estimateQuota liczy jedna jednostke na zapytanie', () => {
    const { fetchFn } = fakeFetch([])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    expect(p.estimateQuota([QUERY, QUERY, QUERY])).toBe(3)
  })
})
```

- [ ] **Krok 3: Uruchomić testy i potwierdzić, że nie przechodzą**

Uruchom: `pnpm vitest run packages/providers/src/gsc`
Oczekiwane: FAIL — brak `./provider.js`.

- [ ] **Krok 4: Zaimplementować adapter**

`packages/providers/src/gsc/provider.ts`:
```ts
import { GSC_SOURCE_TIMEZONE } from '@seo/core'
import { z } from 'zod'
import { type CallLedger, ProviderHttpError, withLedger } from '../ledger.js'
import type {
  PerformanceQuery, PerformanceRows, SiteMetricsCapability, SiteMetricsProvider,
} from '../types.js'

export { GSC_SOURCE_TIMEZONE } from '@seo/core'

/** Wartosc ustalona w Zadaniu 0, Krok 4. Zaktualizuj, jesli weryfikacja da inna. */
export const GSC_MAX_ROW_LIMIT = 25_000

const ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites'

const ResponseSchema = z.object({
  rows: z.array(z.object({
    keys: z.array(z.string()),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
  })).optional(),
})

export interface GscDeps {
  readonly getAccessToken: () => Promise<string>
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
}

function capabilityOf(query: PerformanceQuery): SiteMetricsCapability {
  return query.dimensions.includes('query') ? 'performance.byQuery' : 'performance.byDate'
}

function fingerprint(q: PerformanceQuery): string {
  return `${q.siteUrl}|${q.startDate}..${q.endDate}|${q.dimensions.join(',')}|${q.dataState}|${q.startRow}`
}

export function createGscProvider(deps: GscDeps): SiteMetricsProvider {
  return {
    id: 'gsc',
    capabilities: ['performance.byDate', 'performance.byQuery'],

    estimateQuota: (queries) => queries.length,

    async queryPerformance(query: PerformanceQuery): Promise<PerformanceRows> {
      if (query.rowLimit < 1 || query.rowLimit > GSC_MAX_ROW_LIMIT) {
        throw new Error(`rowLimit musi byc z zakresu 1..${GSC_MAX_ROW_LIMIT}, otrzymano ${query.rowLimit}`)
      }
      const token = await deps.getAccessToken()

      return withLedger(
        deps.ledger,
        {
          providerId: 'gsc',
          capability: capabilityOf(query),
          quotaUnits: 1,
          costMicros: 0,
          requestFingerprint: fingerprint(query),
        },
        deps.now,
        async () => {
          const url = `${ENDPOINT}/${encodeURIComponent(query.siteUrl)}/searchAnalytics/query`
          const response = await deps.fetchFn(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              startDate: query.startDate,
              endDate: query.endDate,
              dimensions: [...query.dimensions],
              dataState: query.dataState,
              rowLimit: query.rowLimit,
              startRow: query.startRow,
            }),
          })

          if (!response.ok) {
            throw new ProviderHttpError(
              response.status,
              `http_${response.status}`,
              `Search Console zwrocilo ${response.status}: ${await response.text()}`,
            )
          }

          const parsed = ResponseSchema.parse(await response.json())
          // keys przepisywane doslownie — zadnego Date, zadnej strefy (D3, AC5).
          return {
            value: { rows: parsed.rows ?? [], sourceTimezone: GSC_SOURCE_TIMEZONE },
            httpStatus: response.status,
          }
        },
      )
    },
  }
}
```

`packages/providers/src/gsc/auth.ts`:
```ts
import { JWT } from 'google-auth-library'

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

/**
 * Konto serwisowe zamiast OAuth (D2): token nie wygasa po 7 dniach i nie
 * wymaga weryfikacji aplikacji u Google. Adres e-mail konta musi byc dodany
 * jako uzytkownik property w Search Console.
 */
export function createServiceAccountTokenSource(keyFilePath: string): () => Promise<string> {
  const client = new JWT({ keyFile: keyFilePath, scopes: [GSC_SCOPE] })
  return async () => {
    const { token } = await client.getAccessToken()
    if (!token) throw new Error(`Nie udalo sie uzyskac tokenu z klucza ${keyFilePath}`)
    return token
  }
}
```

Dopisać oba moduły do `packages/providers/src/index.ts`.

- [ ] **Krok 5: Uruchomić testy i potwierdzić, że przechodzą**

Uruchom: `pnpm vitest run packages/providers`
Oczekiwane: PASS.

- [ ] **Krok 6: Uruchomić testy w dwóch skrajnych strefach czasowych (AC5)**

Uruchom: `pnpm test:tz-east && pnpm test:tz-west`
Oczekiwane: PASS w obu. Wyniki muszą być identyczne — różnica oznacza, że gdzieś w ścieżce danych powstaje `Date` z daty GSC.

- [ ] **Krok 7: Commit**

```bash
git add packages/providers fixtures/gsc
git commit -m "feat(providers): adapter GSC na koncie serwisowym, data przepisywana doslownie (AC5)"
```

---

### Zadanie 7: Arytmetyka dat i uzgodnienie (czyste funkcje)

Wydzielone z CLI, bo to najbardziej ryzykowna logika w całej fazie, a jako czyste funkcje testuje się ją bez bazy i bez sieci.

**Pliki:**
- Utworzyć: `packages/core/src/dates.ts`, `packages/core/src/reconcile.ts`
- Modyfikacja: `packages/core/src/index.ts`
- Test: `packages/core/src/dates.test.ts`, `packages/core/src/reconcile.test.ts`

**Interfejsy:**
- Konsumuje: nic
- Produkuje: `GSC_SOURCE_TIMEZONE: string` (jedyna definicja w repo), `todayInCalendar(now: Date, timeZone: string): string`, `addDays(date: string, days: number): string`, `GSC_FRESHNESS_LAG_DAYS: number`, `defaultSyncRange(now: Date, timeZone: string): { from: string; to: string }`, `computeReconciliation(daily, queryDaily): ReconciliationRow[]`, `ReconciliationMismatchError`

- [ ] **Krok 1: Napisać testy (muszą nie przejść)**

`packages/core/src/dates.test.ts`:
```ts
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
})

describe('defaultSyncRange', () => {
  it('konczy sie 3 dni przed dzisiaj w kalendarzu zrodla', () => {
    const r = defaultSyncRange(new Date('2026-03-11T05:30:00Z'), 'America/Los_Angeles')
    expect(r.to).toBe('2026-03-07')   // 2026-03-10 minus 3
    expect(r.from).toBe('2025-12-07') // to minus 90
  })
})
```

`packages/core/src/reconcile.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ReconciliationMismatchError, computeReconciliation } from './reconcile.js'

const daily = [
  { date: '2026-03-10', clicks: 100, impressions: 1000 },
  { date: '2026-03-11', clicks: 50, impressions: 500 },
]

describe('computeReconciliation', () => {
  it('liczy roznice anonimizacji jako total minus suma po haslach', () => {
    const out = computeReconciliation(daily, [
      { date: '2026-03-10', query: 'a', clicks: 60, impressions: 600 },
      { date: '2026-03-10', query: 'b', clicks: 30, impressions: 300 },
      { date: '2026-03-11', query: 'a', clicks: 50, impressions: 500 },
    ])
    expect(out).toEqual([
      { date: '2026-03-10', totalClicks: 100, querySumClicks: 90, anonymizedDeltaClicks: 10,
        totalImpressions: 1000, querySumImpressions: 900, anonymizedDeltaImpressions: 100 },
      { date: '2026-03-11', totalClicks: 50, querySumClicks: 50, anonymizedDeltaClicks: 0,
        totalImpressions: 500, querySumImpressions: 500, anonymizedDeltaImpressions: 0 },
    ])
  })

  it('traktuje brak wierszy po haslach jako pelna anonimizacje', () => {
    const out = computeReconciliation([daily[0]!], [])
    expect(out[0]).toMatchObject({ querySumClicks: 0, anonymizedDeltaClicks: 100 })
  })

  it('rzuca, gdy suma po haslach przekracza sume dzienna (AC4)', () => {
    expect(() =>
      computeReconciliation([daily[0]!], [{ date: '2026-03-10', query: 'a', clicks: 101, impressions: 10 }]),
    ).toThrow(ReconciliationMismatchError)
  })

  it('ignoruje hasla z dni spoza zestawu dziennego', () => {
    const out = computeReconciliation([daily[0]!], [{ date: '2020-01-01', query: 'x', clicks: 5, impressions: 5 }])
    expect(out).toHaveLength(1)
    expect(out[0]!.querySumClicks).toBe(0)
  })
})
```

- [ ] **Krok 2: Uruchomić testy i potwierdzić, że nie przechodzą**

Uruchom: `pnpm vitest run packages/core/src/dates.test.ts packages/core/src/reconcile.test.ts`
Oczekiwane: FAIL — brak modułów.

- [ ] **Krok 3: Zaimplementować arytmetykę dat**

`packages/core/src/dates.ts`:
```ts
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
```

- [ ] **Krok 4: Zaimplementować uzgodnienie**

`packages/core/src/reconcile.ts`:
```ts
export interface DailyTotals { readonly date: string; readonly clicks: number; readonly impressions: number }
export interface QueryTotals extends DailyTotals { readonly query: string }

export interface ReconciliationRow {
  readonly date: string
  readonly totalClicks: number
  readonly querySumClicks: number
  readonly anonymizedDeltaClicks: number
  readonly totalImpressions: number
  readonly querySumImpressions: number
  readonly anonymizedDeltaImpressions: number
}

export class ReconciliationMismatchError extends Error {
  constructor(readonly date: string, readonly total: number, readonly querySum: number) {
    super(
      `Suma po haslach (${querySum}) przekracza sume dzienna (${total}) dla ${date}. ` +
      'Google nie moze ujawnic w rozbiciu wiecej niz raportuje w sumie — to blad w liczeniu, nie w danych.',
    )
    this.name = 'ReconciliationMismatchError'
  }
}

/**
 * Roznica miedzy suma dzienna a suma po haslach to dane, ktore Google ukrywa
 * ze wzgledu na prywatnosc. Mierzymy ja i pokazujemy, zamiast scigac (AC4).
 */
export function computeReconciliation(
  daily: readonly DailyTotals[],
  queryDaily: readonly QueryTotals[],
): ReconciliationRow[] {
  const sums = new Map<string, { clicks: number; impressions: number }>()
  for (const row of queryDaily) {
    const acc = sums.get(row.date) ?? { clicks: 0, impressions: 0 }
    acc.clicks += row.clicks
    acc.impressions += row.impressions
    sums.set(row.date, acc)
  }

  return daily.map((d) => {
    const q = sums.get(d.date) ?? { clicks: 0, impressions: 0 }
    if (q.clicks > d.clicks) throw new ReconciliationMismatchError(d.date, d.clicks, q.clicks)
    if (q.impressions > d.impressions) throw new ReconciliationMismatchError(d.date, d.impressions, q.impressions)
    return {
      date: d.date,
      totalClicks: d.clicks,
      querySumClicks: q.clicks,
      anonymizedDeltaClicks: d.clicks - q.clicks,
      totalImpressions: d.impressions,
      querySumImpressions: q.impressions,
      anonymizedDeltaImpressions: d.impressions - q.impressions,
    }
  })
}
```

Dopisać oba moduły do `packages/core/src/index.ts`.

- [ ] **Krok 5: Uruchomić testy w trzech strefach**

Uruchom: `pnpm vitest run packages/core && pnpm test:tz-east && pnpm test:tz-west`
Oczekiwane: PASS we wszystkich trzech. To jest właściwy moment, żeby złapać zależność od strefy — później byłaby ukryta pod warstwą bazy.

- [ ] **Krok 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): arytmetyka dat odporna na strefy + uzgodnienie anonimizacji (AC4)"
```

---

### Zadanie 8: CLI — `seo init`

**Pliki:**
- Utworzyć: `apps/cli/package.json` (nazwa `@seo/cli`, `"bin": { "seo": "./dist/bin.js" }`, zależności `@seo/core`, `@seo/db`, `@seo/providers`, `@seo/report` jako `workspace:*`), `apps/cli/tsconfig.json`
- Utworzyć: `apps/cli/src/config.ts`, `apps/cli/src/main.ts`, `apps/cli/src/commands/init.ts`
- Test: `apps/cli/src/config.test.ts`, `apps/cli/src/commands/init.test.ts`

**Interfejsy:**
- Konsumuje: `openDatabase`, `migrate`, `repos` (Zadania 3–4); `tenantScope`, `LOCAL_TENANT` (Zadanie 2)
- Produkuje: `loadConfig(env, homeDir): Config` z `Config { dbPath: string; gscKeyFile: string | undefined; tenantId: string }`, `runInit(config): InitResult`

- [ ] **Krok 1: Napisać testy (muszą nie przejść)**

`apps/cli/src/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('domyslnie umieszcza baze w katalogu domowym', () => {
    expect(loadConfig({}, '/home/kto').dbPath).toBe('/home/kto/.seo/seo.db')
  })

  it('SEO_DB_PATH nadpisuje domyslna sciezke', () => {
    expect(loadConfig({ SEO_DB_PATH: '/tmp/x.db' }, '/home/kto').dbPath).toBe('/tmp/x.db')
  })

  it('czyta sciezke klucza serwisowego ze zmiennej srodowiskowej', () => {
    expect(loadConfig({ SEO_GSC_KEY_FILE: '/k.json' }, '/h').gscKeyFile).toBe('/k.json')
  })

  it('bez klucza zwraca undefined, nie rzuca', () => {
    expect(loadConfig({}, '/h').gscKeyFile).toBeUndefined()
  })

  it('domyslnym tenantem jest local', () => {
    expect(loadConfig({}, '/h').tenantId).toBe('local')
  })

  it('odrzuca nieprawidlowy SEO_TENANT', () => {
    expect(() => loadConfig({ SEO_TENANT: 'ZLE' }, '/h')).toThrow()
  })
})
```

`apps/cli/src/commands/init.test.ts`:
```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runInit } from './init.js'

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

describe('runInit', () => {
  it('tworzy baze, stosuje migracje i wstawia tenanta', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'a.db'), gscKeyFile: undefined, tenantId: 'local' }
    const result = runInit(cfg)
    expect(result.migrationsApplied).toEqual(['0001_init.sql'])
    expect(result.tenantId).toBe('local')
  })

  it('jest idempotentny', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'a.db'), gscKeyFile: undefined, tenantId: 'local' }
    runInit(cfg)
    expect(runInit(cfg).migrationsApplied).toEqual([])
  })

  it('tworzy katalog nadrzedny, jesli nie istnieje', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'gleboko', 'a.db'), gscKeyFile: undefined, tenantId: 'local' }
    expect(() => runInit(cfg)).not.toThrow()
  })
})
```

- [ ] **Krok 2: Uruchomić testy i potwierdzić, że nie przechodzą**

Uruchom: `pnpm vitest run apps/cli`
Oczekiwane: FAIL — brak modułów.

- [ ] **Krok 3: Zaimplementować konfigurację**

`apps/cli/src/config.ts`:
```ts
import { join } from 'node:path'
import { LOCAL_TENANT, tenantScope } from '@seo/core'

export interface Config {
  readonly dbPath: string
  readonly gscKeyFile: string | undefined
  readonly tenantId: string
}

export function loadConfig(env: NodeJS.ProcessEnv, homeDir: string): Config {
  const tenantId = env.SEO_TENANT ?? LOCAL_TENANT
  tenantScope(tenantId) // waliduje ksztalt slug-a, rzuca przy bledzie
  return {
    dbPath: env.SEO_DB_PATH ?? join(homeDir, '.seo', 'seo.db'),
    gscKeyFile: env.SEO_GSC_KEY_FILE,
    tenantId,
  }
}
```

`apps/cli/src/commands/init.ts`:
```ts
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import type { Config } from '../config.js'

export interface InitResult {
  readonly dbPath: string
  readonly tenantId: string
  readonly migrationsApplied: string[]
}

export function runInit(config: Config): InitResult {
  mkdirSync(dirname(config.dbPath), { recursive: true })
  const db = openDatabase(config.dbPath)
  const migrationsApplied = migrate(db)
  const scope = tenantScope(config.tenantId)
  repos(db, scope).write.ensureTenant(config.tenantId)
  return { dbPath: config.dbPath, tenantId: config.tenantId, migrationsApplied }
}
```

- [ ] **Krok 4: Zaimplementować wejście CLI**

`apps/cli/src/main.ts`:
```ts
import { homedir } from 'node:os'
import { loadConfig } from './config.js'
import { runInit } from './commands/init.js'

const USAGE = `seo — platforma SEO/GEO (Faza 0)

  seo init                     utworz baze i zastosuj migracje
  seo gsc sync   --site <uri> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  seo gsc verify --site <uri>  --date YYYY-MM-DD
  seo gsc smoke  --site <uri>  jedno prawdziwe wywolanie API (poza CI)
  seo report     --site <uri> [--out sciezka.html]

Zmienne srodowiskowe:
  SEO_DB_PATH        sciezka pliku bazy (domyslnie ~/.seo/seo.db)
  SEO_GSC_KEY_FILE   sciezka klucza JSON konta serwisowego
  SEO_TENANT         identyfikator tenanta (domyslnie "local")
`

export async function main(argv: readonly string[]): Promise<number> {
  const [command, sub] = argv
  const config = loadConfig(process.env, homedir())

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(USAGE)
    return 0
  }

  if (command === 'init') {
    const r = runInit(config)
    process.stdout.write(
      `Baza: ${r.dbPath}\nTenant: ${r.tenantId}\nMigracje zastosowane: ` +
      `${r.migrationsApplied.length ? r.migrationsApplied.join(', ') : 'brak (juz aktualna)'}\n`,
    )
    return 0
  }

  process.stderr.write(`Nieznane polecenie: ${command}${sub ? ` ${sub}` : ''}\n\n${USAGE}`)
  return 1
}
```

Dodać `apps/cli/src/bin.ts`:
```ts
#!/usr/bin/env node
import { main } from './main.js'
main(process.argv.slice(2)).then((code) => { process.exitCode = code })
```

Na tym etapie `seo init` nie przyjmuje flag, więc `parseArgs` **nie jest jeszcze importowane** — dochodzi w Zadaniu 9 razem z pierwszym poleceniem przyjmującym argumenty.

- [ ] **Krok 5: Uruchomić testy i potwierdzić, że przechodzą**

Uruchom: `pnpm vitest run apps/cli`
Oczekiwane: PASS.

- [ ] **Krok 6: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): seo init — baza, migracje, tenant (AC1)"
```

---

### Zadanie 9: CLI — `seo gsc sync`, `verify`, `smoke`

Realizuje AC2 i AC3.

**Pliki:**
- Utworzyć: `apps/cli/src/commands/sync.ts`, `apps/cli/src/commands/verify.ts`, `apps/cli/src/ledger.ts`
- Modyfikacja: `apps/cli/src/main.ts`
- Test: `apps/cli/src/commands/sync.test.ts`

**Interfejsy:**
- Konsumuje: `createGscProvider`, `createServiceAccountTokenSource`, `GSC_MAX_ROW_LIMIT` (Zadanie 6); `defaultSyncRange`, `computeReconciliation` (Zadanie 7); `repos` (Zadanie 4)
- Produkuje: `runSync(deps: SyncDeps, options: SyncOptions): Promise<SyncResult>`, `dbLedger(db, scope): CallLedger`, `runVerify(...)`

- [ ] **Krok 1: Napisać test synchronizacji (musi nie przejść)**

`apps/cli/src/commands/sync.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import type { PerformanceQuery, PerformanceRows, SiteMetricsProvider } from '@seo/providers'
import { runSync } from './sync.js'

const SCOPE = tenantScope('local')

function fakeProvider(pages: Record<string, PerformanceRows[]>): SiteMetricsProvider {
  const cursor: Record<string, number> = {}
  return {
    id: 'gsc',
    capabilities: ['performance.byDate', 'performance.byQuery'],
    estimateQuota: (qs) => qs.length,
    queryPerformance: vi.fn(async (q: PerformanceQuery) => {
      const key = q.dimensions.join(',')
      const i = cursor[key] ?? 0
      cursor[key] = i + 1
      return pages[key]![i] ?? { rows: [], sourceTimezone: 'America/Los_Angeles' }
    }),
  }
}

function freshDb() {
  const db = openDatabase(':memory:')
  migrate(db)
  repos(db, SCOPE).write.ensureTenant('local')
  return db
}

const rows = (r: unknown[]) => ({ rows: r, sourceTimezone: 'America/Los_Angeles' }) as PerformanceRows

describe('runSync', () => {
  it('zapisuje wiersze dzienne i po haslach', async () => {
    const db = freshDb()
    const provider = fakeProvider({
      date: [rows([{ keys: ['2026-03-10'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }])],
      'date,query': [rows([{ keys: ['2026-03-10', 'buty'], clicks: 90, impressions: 900, ctr: 0.1, position: 5 }])],
    })
    const result = await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })
    expect(result.dailyRows).toBe(1)
    expect(result.queryRows).toBe(1)
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.listDailyRange(site.id, '2026-03-10', '2026-03-10')[0]!.date).toBe('2026-03-10')
  })

  it('paginuje az strona bedzie krotsza niz pageSize', async () => {
    const db = freshDb()
    const provider = fakeProvider({
      date: [
        rows([
          { keys: ['2026-03-10'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 },
          { keys: ['2026-03-11'], clicks: 2, impressions: 20, ctr: 0.1, position: 5 },
        ]),
        rows([{ keys: ['2026-03-12'], clicks: 3, impressions: 30, ctr: 0.1, position: 5 }]),
      ],
      'date,query': [rows([])],
    })
    const result = await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-12', pageSize: 2,
    })
    expect(result.dailyRows).toBe(3)
    expect(provider.queryPerformance).toHaveBeenCalledTimes(3) // 2 strony dat + 1 pusta hasel
  })

  it('jest idempotentny — dwa przebiegi nie tworza duplikatow', async () => {
    const db = freshDb()
    const make = () => fakeProvider({
      date: [rows([{ keys: ['2026-03-10'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }])],
      'date,query': [rows([])],
    })
    const opts = { siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2 }
    await runSync({ db, scope: SCOPE, provider: make() }, opts)
    await runSync({ db, scope: SCOPE, provider: make() }, opts)
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.listDailyRange(site.id, '2026-03-10', '2026-03-10')).toHaveLength(1)
  })

  it('zapisuje uzgodnienie z roznica anonimizacji', async () => {
    const db = freshDb()
    const provider = fakeProvider({
      date: [rows([{ keys: ['2026-03-10'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }])],
      'date,query': [rows([{ keys: ['2026-03-10', 'buty'], clicks: 90, impressions: 900, ctr: 0.1, position: 5 }])],
    })
    await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.getReconciliation(site.id, '2026-03-10')).toMatchObject({
      totalClicks: 100, querySumClicks: 90, anonymizedDeltaClicks: 10,
    })
  })

  it('zamyka przebieg jako nieudany, gdy dostawca rzuci', async () => {
    const db = freshDb()
    const provider: SiteMetricsProvider = {
      id: 'gsc', capabilities: ['performance.byDate'], estimateQuota: () => 1,
      queryPerformance: async () => { throw new Error('403') },
    }
    await expect(runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })).rejects.toThrow()
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.latestSyncRun(site.id)).toMatchObject({ ok: 0 })
  })
})
```

- [ ] **Krok 2: Uruchomić test i potwierdzić, że nie przechodzi**

Uruchom: `pnpm vitest run apps/cli/src/commands/sync.test.ts`
Oczekiwane: FAIL — brak `./sync.js`.

- [ ] **Krok 3: Zaimplementować rejestr piszący do bazy**

`apps/cli/src/ledger.ts`:
```ts
import type { TenantScope } from '@seo/core'
import { type Db, repos } from '@seo/db'
import type { CallLedger } from '@seo/providers'

/** Spina rejestr wywolan z tabela provider_call (D7). */
export function dbLedger(db: Db, scope: TenantScope): CallLedger {
  const write = repos(db, scope).write
  return { record: (entry) => write.recordProviderCall(entry) }
}
```

- [ ] **Krok 4: Zaimplementować synchronizację**

`apps/cli/src/commands/sync.ts`:
```ts
import { type TenantScope, computeReconciliation } from '@seo/core'
import { type Db, repos } from '@seo/db'
import type { PerformanceDimension, PerformanceRow, SiteMetricsProvider } from '@seo/providers'

export interface SyncDeps {
  readonly db: Db
  readonly scope: TenantScope
  readonly provider: SiteMetricsProvider
}

export interface SyncOptions {
  readonly siteUrl: string
  readonly from: string
  readonly to: string
  readonly pageSize: number
}

export interface SyncResult {
  readonly siteId: string
  readonly dailyRows: number
  readonly queryRows: number
  readonly reconciledDays: number
}

/** Paginuje po startRow az strona bedzie krotsza niz pageSize. */
async function fetchAllPages(
  provider: SiteMetricsProvider,
  options: SyncOptions,
  dimensions: readonly PerformanceDimension[],
): Promise<PerformanceRow[]> {
  const collected: PerformanceRow[] = []
  let startRow = 0
  for (;;) {
    const page = await provider.queryPerformance({
      siteUrl: options.siteUrl,
      startDate: options.from,
      endDate: options.to,
      dimensions,
      dataState: 'final',
      rowLimit: options.pageSize,
      startRow,
    })
    collected.push(...page.rows)
    if (page.rows.length < options.pageSize) return collected
    startRow += page.rows.length
  }
}

export async function runSync(deps: SyncDeps, options: SyncOptions): Promise<SyncResult> {
  const { write } = repos(deps.db, deps.scope)
  const propertyType = options.siteUrl.startsWith('sc-domain:') ? 'domain' : 'url_prefix'
  const site = write.upsertSite(propertyType, options.siteUrl)
  const runId = write.startSyncRun(site.id, options.from, options.to, 'final', 'date;date,query')

  try {
    const dateRows = await fetchAllPages(deps.provider, options, ['date'])
    const queryRows = await fetchAllPages(deps.provider, options, ['date', 'query'])

    // keys[0] to data — przepisywana doslownie, bez parsowania (D3, AC5).
    const daily = dateRows.map((r) => ({
      date: r.keys[0]!, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    }))
    const byQuery = queryRows.map((r) => ({
      date: r.keys[0]!, query: r.keys[1]!, clicks: r.clicks,
      impressions: r.impressions, ctr: r.ctr, position: r.position,
    }))

    write.upsertDaily(site.id, runId, daily)
    write.upsertQueryDaily(site.id, runId, byQuery)

    const reconciliation = computeReconciliation(daily, byQuery)
    for (const row of reconciliation) write.upsertReconciliation(site.id, row)

    write.finishSyncRun(runId, daily.length + byQuery.length, true)

    return {
      siteId: site.id,
      dailyRows: daily.length,
      queryRows: byQuery.length,
      reconciledDays: reconciliation.length,
    }
  } catch (error) {
    write.finishSyncRun(runId, 0, false, error instanceof Error ? error.message : String(error))
    throw error
  }
}
```

- [ ] **Krok 5: Zaimplementować `verify` (AC3)**

`apps/cli/src/commands/verify.ts`:
```ts
import type { TenantScope } from '@seo/core'
import { type Db, repos } from '@seo/db'

export interface VerifyResult {
  readonly date: string
  readonly clicksInDatabase: number
  readonly impressionsInDatabase: number
  readonly querySumClicks: number
  readonly anonymizedDeltaClicks: number
}

/**
 * Drukuje liczby do recznego porownania z interfejsem Search Console.
 * Kryterium AC3: clicksInDatabase musi zgadzac sie co do jednego kliknięcia
 * dla dnia starszego niz GSC_FRESHNESS_LAG_DAYS.
 */
export function runVerify(db: Db, scope: TenantScope, siteUrl: string, date: string): VerifyResult {
  const { read } = repos(db, scope)
  const site = read.findSiteByUri(siteUrl)
  if (!site) throw new Error(`Brak strony ${siteUrl} w bazie. Uruchom najpierw: seo gsc sync --site ${siteUrl}`)

  const daily = read.listDailyRange(site.id, date, date)[0]
  if (!daily) throw new Error(`Brak danych dziennych dla ${date}. Czy zakres synchronizacji obejmowal ten dzien?`)

  const reconciliation = read.getReconciliation(site.id, date)
  return {
    date,
    clicksInDatabase: daily.clicks,
    impressionsInDatabase: daily.impressions,
    querySumClicks: reconciliation?.querySumClicks ?? 0,
    anonymizedDeltaClicks: reconciliation?.anonymizedDeltaClicks ?? daily.clicks,
  }
}
```

- [ ] **Krok 6: Podpiąć polecenia w `main.ts`**

Rozszerzyć `main.ts` o gałęzie `gsc sync`, `gsc verify` i `gsc smoke`, używając `parseArgs`:
```ts
const { values } = parseArgs({
  args: [...argv.slice(2)],
  options: {
    site: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    date: { type: 'string' },
    out: { type: 'string' },
  },
  allowPositionals: true,
})
```
Zakres domyślny dla `sync` pochodzi z `defaultSyncRange(new Date(), GSC_SOURCE_TIMEZONE)`. Dostawcę składa się z `createServiceAccountTokenSource(config.gscKeyFile)` — brak `SEO_GSC_KEY_FILE` kończy się komunikatem wskazującym, którą zmienną ustawić, i kodem wyjścia `1`. `smoke` wykonuje pojedyncze `queryPerformance` na zakresie jednego dnia i drukuje liczbę zwróconych wierszy.

`verify` drukuje:
```
Dzien:                       2026-03-07
Kliknięcia w bazie:          142      <- porownaj z Search Console
Wyswietlenia w bazie:        4310
Suma kliknięć po haslach:    118
Ukryte przez Google:         24 (16,9%)
```

- [ ] **Krok 7: Uruchomić wszystkie testy**

Uruchom: `pnpm test && pnpm test:tz-east && pnpm test:tz-west`
Oczekiwane: PASS wszędzie.

- [ ] **Krok 8: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): gsc sync z paginacja i uzgodnieniem, verify, smoke (AC2, AC3)"
```

---

### Zadanie 10: Raport HTML

Realizuje D10 i AC11. `packages/report` jest czystym silnikiem — nie dotyka bazy ani sieci, przyjmuje dane i zwraca tekst.

**Pliki:**
- Utworzyć: `packages/report/package.json`, `packages/report/tsconfig.json`
- Utworzyć: `packages/report/src/types.ts`, `packages/report/src/html.ts`, `packages/report/src/chart.ts`, `packages/report/src/render.ts`, `packages/report/src/index.ts`
- Utworzyć: `apps/cli/src/commands/report.ts`
- Test: `packages/report/src/render.test.ts`

**Interfejsy:**
- Konsumuje: nic (silnik czysty)
- Produkuje: `renderReport(data: ReportData): string`, typ `ReportData`, `escapeHtml(s: string): string`, `barChartSvg(points, options): string`

- [ ] **Krok 1: Napisać testy (muszą nie przejść)**

`packages/report/src/render.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { type ReportData, renderReport } from './render.js'

const DATA: ReportData = {
  siteUri: 'sc-domain:example.pl',
  generatedAt: '2026-03-14 09:00',
  daily: [
    { date: '2026-03-10', clicks: 100, impressions: 1000 },
    { date: '2026-03-11', clicks: 150, impressions: 1200 },
  ],
  topQueries: [{ query: 'buty <trekkingowe>', clicks: 90, impressions: 900 }],
  reconciliation: [
    { date: '2026-03-10', totalClicks: 100, querySumClicks: 90, anonymizedDeltaClicks: 10,
      totalImpressions: 1000, querySumImpressions: 900, anonymizedDeltaImpressions: 100 },
  ],
  providerCalls: [
    { providerId: 'gsc', capability: 'performance.byDate', calls: 4, quotaUnits: 4, costMicros: 0, failures: 0 },
  ],
}

describe('renderReport', () => {
  it('nie odwoluje sie do niczego z sieci (AC11)', () => {
    const html = renderReport(DATA)
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    expect(html).not.toContain('<script src')
    expect(html).not.toContain('@import')
  })

  it('eskejpuje tresc pochodzaca z danych', () => {
    const html = renderReport({
      ...DATA,
      topQueries: [{ query: '<img src=x onerror=alert(1)>', clicks: 1, impressions: 1 }],
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('odpowiada na wszystkie piec pytan z D10', () => {
    const html = renderReport(DATA)
    expect(html).toContain('Kliknięcia dziennie')
    expect(html).toContain('Hasła dające kliknięcia')
    expect(html).toContain('Ukryte przez Google')
    expect(html).toContain('Uzgodnienie z Search Console')
    expect(html).toContain('Zużycie darmowych limitów')
  })

  it('pokazuje ukryte dane jako liczbe i procent', () => {
    const html = renderReport(DATA)
    expect(html).toContain('10')
    expect(html).toMatch(/10[,.]0\s*%/)
  })

  it('radzi sobie z pustymi danymi', () => {
    const html = renderReport({
      siteUri: 'sc-domain:x.pl', generatedAt: '2026-03-14 09:00',
      daily: [], topQueries: [], reconciliation: [], providerCalls: [],
    })
    expect(html).toContain('Brak danych')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })

  it('jest kompletnym dokumentem HTML', () => {
    const html = renderReport(DATA)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="pl">')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })
})
```

- [ ] **Krok 2: Uruchomić testy i potwierdzić, że nie przechodzą**

Uruchom: `pnpm vitest run packages/report`
Oczekiwane: FAIL — brak `./render.js`.

- [ ] **Krok 3: Zaimplementować pomocniki HTML i wykres**

`packages/report/src/html.ts`:
```ts
const ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c]!)
}

export function formatInt(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('pl-PL').format(Math.round(value)) : '—'
}

export function formatPercent(part: number, whole: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return '—'
  return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((part / whole) * 100)} %`
}
```

`packages/report/src/chart.ts`:
```ts
export interface ChartPoint { readonly label: string; readonly value: number }

/** Wykres slupkowy jako inline SVG. Zero zaleznosci, zero zadan sieciowych (AC11). */
export function barChartSvg(points: readonly ChartPoint[], width = 960, height = 220): string {
  if (points.length === 0) return '<p class="pusto">Brak danych</p>'
  const max = Math.max(...points.map((p) => p.value), 1)
  const gap = 2
  const barWidth = Math.max(1, width / points.length - gap)
  const bars = points
    .map((p, i) => {
      const h = Math.max(1, (p.value / max) * (height - 24))
      const x = i * (barWidth + gap)
      return `<rect x="${x.toFixed(2)}" y="${(height - h).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}"><title>${p.label}: ${p.value}</title></rect>`
    })
    .join('')
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Wykres slupkowy" preserveAspectRatio="none">${bars}</svg>`
}
```

- [ ] **Krok 4: Zaimplementować renderowanie**

`packages/report/src/render.ts`:
```ts
import { barChartSvg } from './chart.js'
import { escapeHtml, formatInt, formatPercent } from './html.js'

export interface DailyPoint { readonly date: string; readonly clicks: number; readonly impressions: number }
export interface QueryPoint { readonly query: string; readonly clicks: number; readonly impressions: number }
export interface ReconciliationPoint {
  readonly date: string
  readonly totalClicks: number; readonly querySumClicks: number; readonly anonymizedDeltaClicks: number
  readonly totalImpressions: number; readonly querySumImpressions: number; readonly anonymizedDeltaImpressions: number
}
export interface ProviderCallPoint {
  readonly providerId: string; readonly capability: string
  readonly calls: number; readonly quotaUnits: number; readonly costMicros: number; readonly failures: number
}

export interface ReportData {
  readonly siteUri: string
  readonly generatedAt: string
  readonly daily: readonly DailyPoint[]
  readonly topQueries: readonly QueryPoint[]
  readonly reconciliation: readonly ReconciliationPoint[]
  readonly providerCalls: readonly ProviderCallPoint[]
}

const STYLE = `
:root { color-scheme: light dark; --tlo: #fff; --tekst: #16181d; --slabe: #6b7280; --linia: #e5e7eb; --akcent: #2563eb; --alarm: #b45309; }
@media (prefers-color-scheme: dark) {
  :root { --tlo: #0f1115; --tekst: #e8eaed; --slabe: #9aa1ac; --linia: #262a31; --akcent: #60a5fa; --alarm: #fbbf24; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 1.5rem 4rem; background: var(--tlo); color: var(--tekst);
       font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1040px; margin: 0 auto; }
h1 { font-size: 1.45rem; margin: 0 0 .25rem; }
h2 { font-size: 1.05rem; margin: 2.5rem 0 .75rem; }
.meta { color: var(--slabe); font-size: .85rem; margin: 0 0 2rem; }
.kafelki { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
.kafelek { border: 1px solid var(--linia); border-radius: 10px; padding: .85rem 1rem; }
.kafelek .etykieta { color: var(--slabe); font-size: .78rem; }
.kafelek .liczba { font-size: 1.5rem; font-weight: 650; font-variant-numeric: tabular-nums; }
.kafelek.uwaga .liczba { color: var(--alarm); }
.przewijane { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid var(--linia); white-space: nowrap; }
td.l, th.l { text-align: right; }
svg { width: 100%; height: 220px; display: block; }
svg rect { fill: var(--akcent); }
.pusto { color: var(--slabe); font-style: italic; }
.nota { color: var(--slabe); font-size: .85rem; max-width: 62ch; }
`

function tile(label: string, value: string, warn = false): string {
  return `<div class="kafelek${warn ? ' uwaga' : ''}"><div class="etykieta">${escapeHtml(label)}</div><div class="liczba">${escapeHtml(value)}</div></div>`
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return '<p class="pusto">Brak danych</p>'
  const head = headers.map((h, i) => `<th${i === 0 ? '' : ' class="l"'}>${escapeHtml(h)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? '' : ' class="l"'}>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="przewijane"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
}

export function renderReport(data: ReportData): string {
  const clicks = data.daily.reduce((a, d) => a + d.clicks, 0)
  const impressions = data.daily.reduce((a, d) => a + d.impressions, 0)
  const hidden = data.reconciliation.reduce((a, r) => a + r.anonymizedDeltaClicks, 0)
  const reconciled = data.reconciliation.length
  const quota = data.providerCalls.reduce((a, c) => a + c.quotaUnits, 0)
  const cost = data.providerCalls.reduce((a, c) => a + c.costMicros, 0)

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Raport SEO — ${escapeHtml(data.siteUri)}</title>
<style>${STYLE}</style>
</head>
<body><main>
<h1>${escapeHtml(data.siteUri)}</h1>
<p class="meta">Wygenerowano ${escapeHtml(data.generatedAt)} · dane z Google Search Console, kalendarz America/Los_Angeles</p>

<div class="kafelki">
  ${tile('Kliknięcia w okresie', formatInt(clicks))}
  ${tile('Wyświetlenia w okresie', formatInt(impressions))}
  ${tile('Ukryte przez Google', `${formatInt(hidden)} (${formatPercent(hidden, clicks)})`, hidden > 0)}
  ${tile('Uzgodnione dni', formatInt(reconciled))}
  ${tile('Zużyte jednostki limitu', formatInt(quota))}
  ${tile('Koszt', cost === 0 ? '0 zł' : `${formatInt(cost / 10_000)} gr`)}
</div>

<h2>Kliknięcia dziennie</h2>
${barChartSvg(data.daily.map((d) => ({ label: d.date, value: d.clicks })))}

<h2>Hasła dające kliknięcia</h2>
${table(['Hasło', 'Kliknięcia', 'Wyświetlenia'],
  data.topQueries.map((q) => [q.query, formatInt(q.clicks), formatInt(q.impressions)]))}

<h2>Uzgodnienie z Search Console</h2>
<p class="nota">Google celowo ukrywa rzadkie zapytania, żeby chronić prywatność wyszukujących.
Kolumna „Ukryte przez Google" to różnica między sumą dzienną a sumą po hasłach.
To nie jest błąd — to część Twoich danych, której żadne narzędzie Ci nie pokaże, bo jej nie dostaje.</p>
${table(['Dzień', 'Kliknięcia razem', 'Suma po hasłach', 'Ukryte przez Google', 'Udział ukrytych'],
  data.reconciliation.map((r) => [
    r.date, formatInt(r.totalClicks), formatInt(r.querySumClicks),
    formatInt(r.anonymizedDeltaClicks), formatPercent(r.anonymizedDeltaClicks, r.totalClicks),
  ]))}

<h2>Zużycie darmowych limitów</h2>
${table(['Dostawca', 'Zdolność', 'Wywołania', 'Jednostki limitu', 'Błędy'],
  data.providerCalls.map((c) => [
    c.providerId, c.capability, formatInt(c.calls), formatInt(c.quotaUnits), formatInt(c.failures),
  ]))}
</main></body>
</html>
`
}
```

- [ ] **Krok 5: Podpiąć polecenie `seo report`**

`apps/cli/src/commands/report.ts` — czyta z `repos(db, scope).read` (`listDailyRange`, `topQueries`, `listReconciliations`, `providerCallSummary`), buduje `ReportData`, woła `renderReport`, zapisuje do `--out` (domyślnie `./raport-seo.html`) i drukuje ścieżkę. Zakres dat: ten sam co `defaultSyncRange`. `generatedAt` formatowane przez `Intl.DateTimeFormat('pl-PL')` — to jedyne miejsce, gdzie wolno formatować czas lokalnie, bo dotyczy momentu wygenerowania raportu, a nie danych z GSC.

- [ ] **Krok 6: Uruchomić testy i obejrzeć wynik**

Uruchom: `pnpm vitest run packages/report`
Oczekiwane: PASS.

Następnie: `pnpm --filter @seo/cli exec node dist/bin.js report --site <twoje-property>` i otworzyć powstały plik w przeglądarce. **Odciąć sieć i odświeżyć** — strona musi wyglądać identycznie.

- [ ] **Krok 7: Commit**

```bash
git add packages/report apps/cli
git commit -m "feat(report): statyczny raport HTML bez zaleznosci sieciowych (AC11)"
```

---

### Zadanie 11: CI, reguły zależności, skan sekretów

Realizuje AC8, AC9, AC10 i zamyka fazę.

**Pliki:**
- Utworzyć: `scripts/check-deps.ts`, `scripts/check-secrets.ts`, `.github/workflows/ci.yml`
- Utworzyć: `README.md`
- Test: `scripts/check-deps.test.ts`

**Interfejsy:**
- Konsumuje: nic
- Produkuje: `checkDependencyRules(root: string): Violation[]`, `checkSecrets(root: string): string[]`

- [ ] **Krok 1: Napisać test reguł zależności (musi nie przejść)**

`scripts/check-deps.test.ts`:
```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDependencyRules } from './check-deps.js'

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function fakeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'deps-'))
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

describe('checkDependencyRules', () => {
  it('nie zglasza nic dla poprawnego ukladu', () => {
    dir = fakeRepo({ 'packages/core/src/a.ts': "import { z } from 'zod'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('zglasza drizzle poza packages/db', () => {
    dir = fakeRepo({ 'packages/core/src/a.ts': "import { eq } from 'drizzle-orm'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('zglasza google-auth-library poza packages/providers', () => {
    dir = fakeRepo({ 'packages/db/src/a.ts': "import { JWT } from 'google-auth-library'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('zglasza node:fs w czystym silniku', () => {
    dir = fakeRepo({ 'packages/report/src/a.ts': "import { readFileSync } from 'node:fs'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('pozwala better-sqlite3 w packages/db', () => {
    dir = fakeRepo({ 'packages/db/src/a.ts': "import Database from 'better-sqlite3'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('pomija pliki testowe', () => {
    dir = fakeRepo({ 'packages/core/src/a.test.ts': "import { readFileSync } from 'node:fs'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('wykrywa import dynamiczny', () => {
    dir = fakeRepo({ 'packages/core/src/a.ts': "const m = await import('drizzle-orm')\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })
})
```

- [ ] **Krok 2: Uruchomić test i potwierdzić, że nie przechodzi**

Uruchom: `pnpm vitest run scripts/check-deps.test.ts`
Oczekiwane: FAIL — brak `./check-deps.js`.

- [ ] **Krok 3: Zaimplementować kontrolę zależności**

`scripts/check-deps.ts`:
```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export interface Violation { readonly file: string; readonly specifier: string; readonly rule: string }

const IO_MODULES = [/^node:fs$/, /^node:http/, /^node:net$/, /^undici$/, /^better-sqlite3$/, /^drizzle-orm/, /^google-auth-library$/]

const RULES: readonly { prefix: string; forbidden: readonly RegExp[]; rule: string }[] = [
  { prefix: 'packages/core',   forbidden: IO_MODULES, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/report', forbidden: IO_MODULES, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/providers', forbidden: [/^drizzle-orm/, /^better-sqlite3$/], rule: 'tylko packages/db dotyka bazy' },
  { prefix: 'packages/db', forbidden: [/^google-auth-library$/, /^undici$/, /^node:http/], rule: 'tylko packages/providers wychodzi na zewnatrz' },
]

const IMPORT_PATTERN = /(?:^|[^\w$])(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|(?:^|[^\w$])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

export function checkDependencyRules(root: string): Violation[] {
  const violations: Violation[] = []
  for (const file of walk(root)) {
    const rel = relative(root, file).split(sep).join('/')
    const rule = RULES.find((r) => rel.startsWith(`${r.prefix}/`))
    if (!rule) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (rule.forbidden.some((p) => p.test(specifier))) {
        violations.push({ file: rel, specifier, rule: rule.rule })
      }
    }
  }
  return violations
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = checkDependencyRules(process.cwd())
  for (const v of found) process.stderr.write(`${v.file}: import "${v.specifier}" — ${v.rule}\n`)
  process.exitCode = found.length === 0 ? 0 : 1
}
```

- [ ] **Krok 4: Zaimplementować skan sekretów (AC10)**

`scripts/check-secrets.ts`:
```ts
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SUSPICIOUS_NAME = /(\.sa\.json|service[-_]account.*\.json|credentials?\.json)$/i
const PRIVATE_KEY_MARKER = '-----BEGIN PRIVATE KEY-----'

export function checkSecrets(root: string): string[] {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const found: string[] = []
  for (const file of tracked) {
    if (SUSPICIOUS_NAME.test(file)) { found.push(`${file}: nazwa wyglada na klucz konta serwisowego`); continue }
    if (!/\.(json|ts|js|env|txt|md|ya?ml)$/i.test(file)) continue
    if (readFileSync(`${root}/${file}`, 'utf8').includes(PRIVATE_KEY_MARKER)) {
      found.push(`${file}: zawiera klucz prywatny`)
    }
  }
  return found
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = checkSecrets(process.cwd())
  for (const f of found) process.stderr.write(`${f}\n`)
  process.exitCode = found.length === 0 ? 0 : 1
}
```

- [ ] **Krok 5: Napisać workflow CI**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: ["**"] }
  pull_request:

jobs:
  sprawdz:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        # AC5: identyczne wyniki po obu stronach linii zmiany daty.
        tz: ["UTC", "Pacific/Kiritimati", "Pacific/Niue"]
    env:
      TZ: ${{ matrix.tz }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm check:deps    # AC8
      - run: pnpm check:secrets # AC10
```

`seo gsc smoke` świadomie nie występuje w CI — to jedyne polecenie sięgające do prawdziwego API (AC9).

- [ ] **Krok 6: Napisać README**

`README.md`: co to jest, wymagania (Node 22, pnpm), instalacja, konfiguracja konta serwisowego w pięciu krokach (z Zadania 0), cztery polecenia, gdzie leży baza, link do specyfikacji i planu. Bez marketingu — instrukcja obsługi.

- [ ] **Krok 7: Uruchomić pełną bramkę**

Uruchom: `pnpm typecheck && pnpm test && pnpm test:tz-east && pnpm test:tz-west && pnpm check:deps && pnpm check:secrets`
Oczekiwane: wszystko zielone.

- [ ] **Krok 8: Commit**

```bash
git add scripts .github README.md package.json
git commit -m "ci: reguly zaleznosci, skan sekretow, testy w trzech strefach (AC8, AC10)"
```

---

### Zadanie 12: Odbiór Fazy 0 na prawdziwych danych

Jedyne zadanie z udziałem człowieka. Zamyka fazę.

**Pliki:**
- Modyfikacja: `docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md` (dopisać aneks z wynikiem)

- [ ] **Krok 1: Zsynchronizować prawdziwe dane**

```bash
export SEO_GSC_KEY_FILE=~/.seo/gsc.sa.json
seo init
seo gsc sync --site "sc-domain:twoja-domena.pl"
```
Oczekiwane: komunikat z liczbą wierszy dziennych, wierszy po hasłach i uzgodnionych dni.

- [ ] **Krok 2: Zweryfikować uzgodnienie (AC3)**

Wybrać dzień co najmniej cztery dni wstecz. Uruchomić:
```bash
seo gsc verify --site "sc-domain:twoja-domena.pl" --date 2026-08-20
```
Otworzyć Search Console, ustawić zakres na ten jeden dzień, odczytać liczbę kliknięć.

**Kryterium: liczby muszą się zgadzać co do jednego kliknięcia.** Jeżeli się nie zgadzają, sprawdzić w tej kolejności: (1) czy property w Search Console jest tym samym, którego użyto w `--site` (domenowe vs z prefiksem URL to różne zbiory danych), (2) czy zakres w interfejsie to dokładnie ten jeden dzień, (3) czy interfejs nie pokazuje danych świeżych (`dataState`). **Nie osłabiać kryterium** — przy niezgodności z nieznanej przyczyny zapisać ją jako aneks R3 w specyfikacji i dopiero wtedy korygować.

- [ ] **Krok 3: Wygenerować i obejrzeć raport**

```bash
seo report --site "sc-domain:twoja-domena.pl" --out raport.html
```
Otworzyć w przeglądarce. Sprawdzić, czy „Ukryte przez Google" ma sensowną wartość — dla większości małych stron to zwykle znaczący ułamek kliknięć. Zero przy niezerowym ruchu jest podejrzane i oznacza, że wymiar `query` nie został pobrany.

- [ ] **Krok 4: Dopisać wynik odbioru do specyfikacji**

Dopisać sekcję „Aneks: odbiór Fazy 0" z datą, liczbą zsynchronizowanych dni, wynikiem AC3 (zgodne / niezgodne i dlaczego) oraz zmierzonym udziałem danych ukrytych przez Google.

- [ ] **Krok 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md
git commit -m "docs: odbior Fazy 0 na prawdziwych danych (AC3)"
```

---

## Mapa pokrycia specyfikacji

| Wymaganie | Zadanie |
|---|---|
| D1 SQLite jednodialektowo, migracje SQL | 3 |
| D2 konto serwisowe | 0, 6 |
| D3 data GSC jako tekst | 6 (AC5), 7 |
| D4 normalizacja URL, `NORMALIZER_VERSION` | 1 |
| D5 izolacja tenantów | 3, 4 |
| D6 ULID | 2 |
| D7 rejestr wywołań | 5, 9 |
| D8 kolejka — decyzja bez implementacji | poza zakresem (Faza 1) |
| D9 jeden interfejs dostawcy | 5, 6 |
| D10 raport HTML | 10 |
| AC1 inicjalizacja | 8 |
| AC2 pobranie, idempotencja | 9 |
| AC3 uzgodnienie z Google | 9, 12 |
| AC4 anonimizacja mierzona | 7, 9 |
| AC5 data nietknięta | 6, 7, 11 |
| AC6 izolacja klientów | 4 |
| AC7 normalizacja URL | 1 |
| AC8 reguły zależności | 11 |
| AC9 testy bez sieci | 6, 11 |
| AC10 klucz nie wycieka | 11 |
| AC11 raport bez sieci | 10 |

## Realny czas

Trzy dni z specyfikacji dotyczyły zakresu bez raportu HTML i bez zadania odbiorowego. Z nimi uczciwy szacunek to **cztery dni roboty**, plus czas oczekiwania w Zadaniu 0, którego nie kontrolujemy. Zadanie 0 należy wykonać pierwszego dnia rano — jest jedynym punktem, w którym opóźnienie zewnętrzne może zablokować całą fazę.

## Kolejność

Zadania 1–2 są niezależne od Zadania 0 i można je robić w oczekiwaniu na dostęp do Google. Zadania 3–5 zależą od 1–2. Zadanie 6 zależy od 0 i 5. Zadania 8–10 zależą od 3–7. Zadanie 11 może powstać w dowolnym momencie po Zadaniu 1, ale zielone staje się dopiero na końcu. Zadanie 12 jest ostatnie.
