import { barChartSvg } from './chart.js'
import { escapeHtml, formatInt, formatPercent } from './html.js'
import type { ReportData } from './types.js'

export type {
  DailyPoint, ProviderCallPoint, QueryPoint, ReconciliationPoint, ReportData,
} from './types.js'

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
