/**
 * Jeden arkusz stylow na wszystkie raporty. Powod: raport SEO i raport audytu
 * maja wygladac jak ten sam produkt, a nie jak dwa narzedzia sklejone tasma.
 *
 * Zero zasobow z sieci — styl jest wpisany w plik, tak samo jak wykresy (AC11).
 */
export const STYLE = `
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
