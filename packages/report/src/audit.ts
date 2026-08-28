import { escapeHtml, formatInt } from './html.js'
import { STYLE } from './style.js'
import type { AuditReportData, FindingRow, Severity } from './audit-types.js'
import { SEVERITY_ORDER } from '@seo/rules'

export type * from './audit-types.js'

/**
 * Raport techniczny audytu — kamien milowy Fazy 1.
 *
 * Trzy zasady, ktore rozstrzygaja, jak on wyglada:
 *  1. **Zadnej oceny zbiorczej 0-100** (D18). Liczba, ktorej nie da sie sprawdzic,
 *     jest gorsza niz brak liczby, bo zacheca do poprawiania wskaznika zamiast strony.
 *  2. **Kazde ustalenie ma dowod** — konkretna zmierzona wartosc, nie etykiete.
 *  3. **Reguly pominiete pokazujemy wprost.** Cichy brak reguly to falszywe
 *     poczucie porzadku, a nie brak problemu.
 */

const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  blocker: 'blokujące',
  high: 'wysokie',
  medium: 'średnie',
  low: 'niskie',
  info: 'informacyjne',
}

/** Co waga znaczy w praktyce — zeby czytelnik nie musial zgadywac. */
const SEVERITY_MEANING: Readonly<Record<Severity, string>> = {
  blocker: 'strona nie może trafić do wyników',
  high: 'realnie kosztuje widoczność',
  medium: 'warto poprawić przy najbliższej okazji',
  low: 'drobiazg, ale mierzalny',
  info: 'obserwacja, nie usterka',
}

const ROBOTS_LABEL: Readonly<Record<AuditReportData['robotsState'], string>> = {
  ok: 'odczytany',
  missing: 'brak pliku (crawl dozwolony)',
  unreachable: 'nieosiągalny — crawl wstrzymany',
}

function tile(label: string, value: string, warn = false): string {
  return `<div class="kafelek${warn ? ' uwaga' : ''}">`
    + `<div class="etykieta">${escapeHtml(label)}</div>`
    + `<div class="liczba">${escapeHtml(value)}</div></div>`
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return '<p class="pusto">Brak danych</p>'
  const head = headers.map((h, i) => `<th${i === 0 ? '' : ' class="l"'}>${escapeHtml(h)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? '' : ' class="l"'}>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="przewijane"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
}

/** Dowod w jednej komorce: `klucz: wartosc`, rozdzielone srednikiem. */
function evidenceText(evidence: FindingRow['evidence']): string {
  const parts = Object.entries(evidence).map(([key, value]) => `${key}: ${String(value)}`)
  return parts.length === 0 ? '—' : parts.join(' · ')
}

function findingsBySeverity(findings: readonly FindingRow[]): [Severity, FindingRow[]][] {
  const grouped = new Map<Severity, FindingRow[]>()
  for (const finding of findings) {
    const bucket = grouped.get(finding.severity)
    if (bucket) bucket.push(finding)
    else grouped.set(finding.severity, [finding])
  }
  return SEVERITY_ORDER
    .filter((severity) => (grouped.get(severity)?.length ?? 0) > 0)
    .map((severity) => [severity, grouped.get(severity) ?? []])
}

function findingsSection(findings: readonly FindingRow[]): string {
  const groups = findingsBySeverity(findings)
  if (groups.length === 0) {
    return '<p class="pusto">Żadna reguła nie zgłosiła ustalenia.</p>'
  }
  return groups.map(([severity, rows]) => {
    const label = `${SEVERITY_LABEL[severity]} — ${SEVERITY_MEANING[severity]}`
    return `<h3>${escapeHtml(label)} (${formatInt(rows.length)})</h3>`
      + table(
        ['Reguła', 'Strona', 'Dowód'],
        rows.map((f) => [
          `${f.ruleId} — ${f.title}`,
          f.url ?? 'cały serwis',
          evidenceText(f.evidence),
        ]),
      )
  }).join('')
}

export function renderAuditReport(data: AuditReportData): string {
  const counts = data.countsBySeverity
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + counts[severity], 0)
  const blocking = counts.blocker + counts.high

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audyt techniczny — ${escapeHtml(data.siteUri)}</title>
<style>${STYLE}
h3 { font-size: .95rem; margin: 1.5rem 0 .5rem; color: var(--slabe); }
td:last-child { white-space: normal; }
</style>
</head>
<body><main>
<h1>Audyt techniczny — ${escapeHtml(data.siteUri)}</h1>
<p class="meta">Wygenerowano ${escapeHtml(data.generatedAt)} · crawl z ${escapeHtml(data.crawlStartedAt)}
 · agent ${escapeHtml(data.userAgent)}</p>

<div class="kafelki">
  ${tile('Strony w crawlu', formatInt(data.pagesCrawled))}
  ${tile('Strony nieudane', formatInt(data.pagesFailed), data.pagesFailed > 0)}
  ${tile('Ustalenia razem', formatInt(total))}
  ${tile('Blokujące i wysokie', formatInt(blocking), blocking > 0)}
  ${tile('robots.txt', ROBOTS_LABEL[data.robotsState], data.robotsState === 'unreachable')}
  ${tile('Crawl kompletny', data.truncated ? 'nie' : 'tak', data.truncated)}
</div>

<p class="nota">Ten raport nie podaje oceny w skali 0–100. Taka liczba wymaga wag,
których nikt nie umie uzasadnić, i zachęca do poprawiania wskaźnika zamiast strony.
Zamiast tego każde ustalenie ma adres i zmierzoną wartość — to da się sprawdzić palcem.</p>

${data.truncated
  ? `<p class="nota"><strong>Crawl został ucięty</strong>${data.truncationReason === null ? '' : ` (${escapeHtml(data.truncationReason)})`}.
Reguły wymagające pełnego obrazu serwisu — strony osierocone, zepsute linki wewnętrzne,
duplikaty — zamilkły, bo „nie doszliśmy" to nie to samo, co „jest źle”. Ich lista jest na dole.</p>`
  : ''}

<h2>Ustalenia według wagi</h2>
${table(
  ['Waga', 'Co to znaczy', 'Liczba'],
  SEVERITY_ORDER.map((severity) => [
    SEVERITY_LABEL[severity], SEVERITY_MEANING[severity], formatInt(counts[severity]),
  ]),
)}

<h2>Od czego zacząć</h2>
${table(
  ['Reguła', 'Waga', 'Trafień'],
  data.topRules.map((r) => [`${r.ruleId} — ${r.title}`, SEVERITY_LABEL[r.severity], formatInt(r.count)]),
)}

<h2>Pełna lista ustaleń</h2>
${findingsSection(data.findings)}

<h2>Odpowiedzi serwera</h2>
${table(['Status', 'Strony'], data.statusCounts.map((s) => [s.status, formatInt(s.count)]))}

<h2>Strony osierocone</h2>
<p class="nota">Do tych stron nie prowadzi żaden link wewnętrzny. Wyszukiwarka trafia
na nie tylko przez mapę witryny — a modele AI zwykle wcale.</p>
${table(['Adres'], data.orphans.map((url) => [url]))}

<h2>Najgłębiej ukryte strony</h2>
${table(
  ['Adres', 'Kliknięć od strony głównej'],
  data.deepestPages.map((p) => [p.url, formatInt(p.clickDepth)]),
)}

<h2>Przekierowania</h2>
<p class="nota">Każdy przeskok kosztuje budżet crawlowania i rozmywa sygnały.
Link prowadzący prosto do adresu docelowego jest zawsze lepszy niż link przez przekierowanie.</p>
${table(
  ['Adres żądany', 'Adres docelowy', 'Przeskoków'],
  data.redirects.map((r) => [r.from, r.to, formatInt(r.hops)]),
)}

<h2>Reguły pominięte</h2>
<p class="nota">Te reguły nie miały prawa głosu, bo zabrakło im danych. Pokazujemy je wprost:
cicho pominięta reguła daje fałszywe poczucie porządku, a nie brak problemu.</p>
${table(
  ['Reguła', 'Czego zabrakło'],
  data.skipped.map((s) => [s.ruleId, s.missing.join(', ')]),
)}
</main></body>
</html>
`
}
