import { escapeHtml, formatInt } from './html.js'
import { STYLE } from './style.js'
import type {
  AccessMode, GeoReportData, GeoComparisonRow, ShareRow,
} from './geo-types.js'

export type * from './geo-types.js'

/**
 * Raport trackera widocznosci w AI — kamien milowy Fazy 2.
 *
 * Trzy zasady, ktore rozstrzygaja, jak on wyglada:
 *  1. **Zadnej liczby bez przedzialu** (D24). Pojedynczy przebieg promptu to proba
 *     Bernoulliego, nie pomiar; „34%" bez przedzialu udaje precyzje, ktorej nie ma.
 *  2. **Zmiana obejmujaca zero nie dostaje kierunku** (D26). Liczba jest pokazana,
 *     ale bez strzalki i bez koloru. Zielona strzalka przy zmianie z 34% na 36%
 *     uczy klienta reagowac na szum.
 *  3. **Nadal zero oceny zbiorczej** (D18) i nadal zero zasobow z sieci.
 */

const ACCESS_LABEL: Readonly<Record<AccessMode, string>> = {
  api: 'bez groundingu',
  api_grounded: 'z groundingiem',
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`
}

/** Odsetek zawsze razem z przedzialem — osobno nie wystepuja (D24). */
function share(row: ShareRow): string {
  return `${pct(row.rate)} (${pct(row.low)} – ${pct(row.high)})`
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

/**
 * Bramka istotnosci (D26). Zmiana obejmujaca zero jest **szara i bez kierunku** —
 * liczba zostaje widoczna, zeby czytelnik wiedzial, ze pomiar byl, i ze jest
 * za wczesnie na wniosek. Ukrywanie takiej zmiany byloby rownie mylace.
 */
function comparisonCell(row: GeoComparisonRow): string {
  if (row.kind === 'odmowa') {
    return `<span class="odmowa">nie porównano — ${escapeHtml(row.reason)}</span>`
  }
  const wartosc = `${row.meanDifference >= 0 ? '+' : '−'}${pct(Math.abs(row.meanDifference))}`
  const zakres = `${pct(row.low)} – ${pct(row.high)}`
  if (!row.significant) {
    return `<span class="nieistotne">${escapeHtml(wartosc)} `
      + `<span class="zakres">(${escapeHtml(zakres)}, jeszcze nieistotne)</span></span>`
  }
  const kierunek = row.meanDifference > 0 ? 'wzrost' : 'spadek'
  return `<span class="istotne ${row.meanDifference > 0 ? 'w-gore' : 'w-dol'}">`
    + `${escapeHtml(wartosc)} <span class="zakres">(${escapeHtml(zakres)}, ${kierunek})</span></span>`
}

export function renderGeoReport(data: GeoReportData): string {
  const own = data.voice.find((v) => v.isOwn)
  const odpowiedzi = data.engines.reduce((sum, e) => sum + e.answersOk, 0)
  const nieudane = data.engines.reduce((sum, e) => sum + e.answersFailed, 0)

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Widoczność w AI — ${escapeHtml(data.siteUri)}</title>
<style>${STYLE}
h3 { font-size: .95rem; margin: 1.5rem 0 .5rem; color: var(--slabe); }
td:last-child { white-space: normal; }
.zakres { color: var(--slabe); font-weight: 400; }
.nieistotne { color: var(--slabe); }
.istotne { font-weight: 600; }
.odmowa { color: var(--slabe); font-style: italic; }
</style>
</head>
<body><main>
<h1>Widoczność w AI — ${escapeHtml(data.siteUri)}</h1>
<p class="meta">Wygenerowano ${escapeHtml(data.generatedAt)} · pomiar z ${escapeHtml(data.runStartedAt)}
 · marka ${escapeHtml(data.ownBrand)}
 · zestaw „${escapeHtml(data.promptSetName)}" w wersji ${formatInt(data.promptSetVersion)}
 · definicja encji w wersji ${formatInt(data.entityVersion)}</p>

<div class="kafelki">
  ${tile('Prompty', formatInt(data.prompts))}
  ${tile('Przebiegi na prompt', formatInt(data.runsPerPrompt))}
  ${tile('Odpowiedzi', formatInt(odpowiedzi))}
  ${tile('Nieudane wywołania', formatInt(nieudane), nieudane > 0)}
  ${tile('Widoczność marki', own === undefined ? '—' : share(own.share))}
  ${tile('Rozdzielczość pomiaru', pct(data.detectableDifference))}
</div>

<p class="nota">Każda liczba w tym raporcie ma przedział ufności, bo pojedynczy przebieg
promptu to rzut monetą, a nie pomiar. Przy ${formatInt(data.prompts)} promptach
i ${formatInt(data.runsPerPrompt)} przebiegach ten zestaw wykrywa dopiero zmiany rzędu
${pct(data.detectableDifference)}. Mniejsze zmiany mogą być prawdziwe, ale tego pomiaru
na nie nie starcza — a większa liczba przebiegów tego nie naprawi, bo ma podłogę,
której nie przeskoczy. Naprawi to większy zestaw promptów.</p>

<p class="nota">Ten raport nie podaje oceny w skali 0–100 ani jednej liczby zbiorczej
„widoczności w AI". Każdy silnik jest osobną linią, bo model z dostępem do wyszukiwarki
i model odpowiadający z pamięci to dwa różne procesy, nie dwa ustawienia.</p>

<h2>Widoczność według silnika</h2>
${table(
  ['Silnik', 'Model', 'Tryb', 'Odpowiedzi', 'Nieudane', 'Odmowy', 'Widoczność marki'],
  data.engines.map((e) => [
    e.engine,
    e.modelVersion,
    ACCESS_LABEL[e.accessMode],
    formatInt(e.answersOk),
    formatInt(e.answersFailed),
    formatInt(e.refusals),
    share(e.visibility),
  ]),
)}
${data.engines.some((e) => e.refusals > 0)
  ? `<p class="nota">Odmowa modelu liczy się jako odpowiedź, w której marki nie było —
bo tak właśnie wygląda z perspektywy pytającego. Nieudane wywołanie nie liczy się wcale:
awaria łącza nie jest spadkiem widoczności.</p>`
  : ''}

${data.skipped.length === 0
  ? ''
  : `<h2>Silniki pominięte</h2>
<p class="nota">Te silniki nie wzięły udziału w pomiarze. Pokazujemy je wprost:
cicha lista dwóch silników zamiast trzech wygląda jak komplet danych, a nie jak brak klucza.</p>
${table(['Silnik', 'Powód'], data.skipped.map((s) => [s.id, s.reason]))}`}

<h2>Zmiana od poprzedniego pomiaru</h2>
<p class="nota">Porównanie idzie prompt po prompcie — ten sam prompt przed i po, różnica,
dopiero potem średnia z różnic. Porównanie surowych poziomów zawiera rozrzut między
promptami i prawie nigdy nie wykryje realnej zmiany o kilka punktów.</p>
${data.comparisons.length === 0
  ? '<p class="pusto">To pierwszy pomiar — nie ma z czym porównywać</p>'
  : `<div class="przewijane"><table><thead><tr><th>Silnik</th><th class="l">Zmiana widoczności</th></tr></thead><tbody>`
    + data.comparisons.map((c) =>
      `<tr><td>${escapeHtml(c.engine)}</td><td class="l">${comparisonCell(c)}</td></tr>`,
    ).join('')
    + '</tbody></table></div>'}

<h2>Udział w rozmowie</h2>
<p class="nota">Liczymy odpowiedzi ze wzmianką, a nie liczbę wzmianek. Marka wymieniona
w jednej odpowiedzi pięć razy nie jest pięciokrotnie bardziej widoczna — to mierzyłoby
gadatliwość modelu, nie widoczność strony. Pozycja to udział znaków przed pierwszą
wzmianką: 0% znaczy „na samym początku odpowiedzi".</p>
${table(
  ['Marka', 'Odpowiedzi ze wzmianką', 'Udział', 'Mediana pozycji'],
  data.voice.map((v) => [
    v.isOwn ? `${v.name} (nasza)` : v.name,
    formatInt(v.answersWithMention),
    share(v.share),
    v.medianFirstPosition === null ? '—' : pct(v.medianFirstPosition),
  ]),
)}

<h2>Cytowania</h2>
<p class="nota">Adres z metadanych groundingu jest świadectwem, że model <strong>pobrał</strong>
dokument. Adres wypisany w treści odpowiedzi jest tym, co model <strong>napisał</strong> —
i bywa zmyślony, bo generowanie adresu URL to generowanie tekstu, nie odczyt. Dlatego
nie ma tu jednej „liczby cytowań".</p>
${table(
  ['Źródło', 'Odpowiedzi cytujące nas', 'Najczęściej cytowane hosty'],
  data.citations.map((c) => [
    c.source === 'grounding' ? 'grounding (pobrane)' : 'treść (napisane)',
    share(c.ourRate),
    c.topHosts.length === 0
      ? '—'
      : c.topHosts.map((h) => `${h.host} (${h.count})`).join(' · '),
  ]),
)}
</main></body>
</html>
`
}
