import { escapeHtml } from '@seo/report'

/**
 * Powloka panelu: nawigacja, style, stopka.
 *
 * Panel ma wlasny arkusz, a nie arkusz raportu. Powod nie jest estetyczny:
 * raport jest **dokumentem do wyslania klientowi** i musi wygladac tak samo za
 * rok, a panel jest narzedziem, ktore bedzie sie zmieniac. Wspolne sa tokeny
 * kolorow, zeby oba czuly sie jednym produktem.
 *
 * Zero zasobow z sieci — to samo ograniczenie, co w raportach. Narzedzie
 * mierzace niezaleznosc stron od zewnetrznych zasobow, ktore samo ich wymaga,
 * byloby zartem.
 */

export const PANEL_STYLE = `
*, *::before, *::after { box-sizing: border-box; }

:root {
  color-scheme: light dark;
  --tlo: #fbfcfe;
  --tlo-karta: #ffffff;
  --tekst: #141821;
  --slabe: #5d6673;
  --linia: #e3e8ef;
  --akcent: #2757d6;
  --akcent-tlo: #eaf0ff;
  --dobrze: #0f7a4d;
  --dobrze-tlo: #e6f6ee;
  --uwaga: #9a5b00;
  --uwaga-tlo: #fdf1dd;
  --zle: #b3261e;
  --zle-tlo: #fdeceb;
  --cien: 0 1px 2px rgba(16, 24, 40, .05), 0 4px 12px rgba(16, 24, 40, .04);
  --promien: .7rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --tlo: #0d1017;
    --tlo-karta: #151a23;
    --tekst: #e9edf3;
    --slabe: #98a2b3;
    --linia: #232a36;
    --akcent: #7aa2ff;
    --akcent-tlo: #172239;
    --dobrze: #56d19a;
    --dobrze-tlo: #10261d;
    --uwaga: #f5b944;
    --uwaga-tlo: #2a2113;
    --zle: #ff8b82;
    --zle-tlo: #2d1614;
    --cien: none;
  }
}

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--tlo);
  color: var(--tekst);
  font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

a { color: var(--akcent); text-decoration: none; }
a:hover { text-decoration: underline; }

.pasek {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--tlo) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--linia);
}
.pasek-srodek {
  max-width: 68rem; margin: 0 auto; padding: .8rem 1.25rem;
  display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
}
.marka {
  font-weight: 700; font-size: 1.05rem; letter-spacing: -.01em;
  color: var(--tekst); display: inline-flex; align-items: center; gap: .55rem;
}
.marka:hover { text-decoration: none; }
.znak {
  width: 1.6rem; height: 1.6rem; border-radius: .45rem;
  background: var(--akcent); color: #fff;
  display: grid; place-items: center; font-size: .8rem; font-weight: 800;
}
@media (prefers-color-scheme: dark) { .znak { color: #0d1017; } }

nav.menu { display: flex; gap: .25rem; flex-wrap: wrap; margin-left: auto; }
nav.menu a {
  padding: .4rem .75rem; border-radius: .45rem; color: var(--slabe);
  font-weight: 600; font-size: .9rem;
}
nav.menu a:hover { background: var(--linia); color: var(--tekst); text-decoration: none; }
nav.menu a[aria-current="page"] { background: var(--akcent-tlo); color: var(--akcent); }

main { max-width: 68rem; margin: 0 auto; padding: 2rem 1.25rem 5rem; }

h1 { font-size: 1.9rem; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 .4rem; }
h2 { font-size: 1.15rem; letter-spacing: -.01em; margin: 2.5rem 0 .9rem; }
h3 { font-size: .95rem; margin: 0 0 .3rem; }
p { margin: 0 0 .9rem; }
.wiodacy { font-size: 1.05rem; color: var(--slabe); max-width: 60ch; margin-bottom: 1.5rem; }

.karta {
  background: var(--tlo-karta); border: 1px solid var(--linia);
  border-radius: var(--promien); padding: 1.15rem 1.25rem; box-shadow: var(--cien);
}
.siatka { display: grid; gap: .9rem; }
.siatka-2 { grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); }
.siatka-3 { grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); }

.kafel { text-align: left; }
.kafel .etykieta {
  color: var(--slabe); font-size: .78rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .04em;
}
.kafel .liczba { font-size: 1.85rem; font-weight: 700; letter-spacing: -.02em; margin-top: .2rem; }
.kafel .pod { color: var(--slabe); font-size: .82rem; }
.kafel.alarm .liczba { color: var(--zle); }
.kafel.ok .liczba { color: var(--dobrze); }

.plakietka {
  display: inline-flex; align-items: center; gap: .35rem;
  padding: .18rem .5rem; border-radius: 999px;
  font-size: .76rem; font-weight: 700; letter-spacing: .01em;
}
.plakietka.neutralna { background: var(--linia); color: var(--slabe); }
.plakietka.dobra { background: var(--dobrze-tlo); color: var(--dobrze); }
.plakietka.uwaga { background: var(--uwaga-tlo); color: var(--uwaga); }
.plakietka.zla { background: var(--zle-tlo); color: var(--zle); }
.plakietka.akcent { background: var(--akcent-tlo); color: var(--akcent); }

form.pole-obok {
  display: flex; gap: .6rem; flex-wrap: wrap; align-items: flex-end;
}
.pole { display: grid; gap: .3rem; flex: 1 1 20rem; }
label { font-weight: 600; font-size: .85rem; }
input[type=url], input[type=number], input[type=text] {
  padding: .62rem .7rem; font: inherit; width: 100%;
  border: 1px solid var(--linia); border-radius: .5rem;
  background: var(--tlo-karta); color: var(--tekst);
}
input:focus-visible, button:focus-visible, a:focus-visible {
  outline: 2px solid var(--akcent); outline-offset: 2px;
}
.podpowiedz { font-size: .8rem; color: var(--slabe); }

button, .przycisk {
  padding: .62rem 1.1rem; font: inherit; font-weight: 650; cursor: pointer;
  border: 1px solid transparent; border-radius: .5rem;
  background: var(--akcent); color: #fff; white-space: nowrap;
  display: inline-flex; align-items: center; gap: .4rem;
}
@media (prefers-color-scheme: dark) { button, .przycisk { color: #0d1017; } }
button:hover, .przycisk:hover { filter: brightness(1.08); text-decoration: none; }
.przycisk.cichy {
  background: var(--tlo-karta); color: var(--tekst); border-color: var(--linia);
}
.przycisk.cichy:hover { background: var(--linia); filter: none; }

ul.czysta { list-style: none; padding: 0; margin: 0; display: grid; gap: .6rem; }

.wiersz {
  display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap;
}
.wiersz-tresc { flex: 1 1 22rem; min-width: 0; }
.adres {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem;
  word-break: break-all; color: var(--slabe);
}

.nota {
  color: var(--slabe); font-size: .88rem; max-width: 64ch;
  border-left: 3px solid var(--linia); padding-left: .9rem; margin: 1.25rem 0;
}
.pusto {
  color: var(--slabe); background: var(--tlo-karta);
  border: 1px dashed var(--linia); border-radius: var(--promien);
  padding: 1.5rem; text-align: center;
}

.krok { display: flex; gap: .8rem; align-items: baseline; }
.krok-numer {
  flex: none; width: 1.5rem; height: 1.5rem; border-radius: 999px;
  background: var(--akcent-tlo); color: var(--akcent);
  display: grid; place-items: center; font-size: .78rem; font-weight: 800;
}

.postep-tlo { height: .4rem; background: var(--linia); border-radius: 999px; overflow: hidden; }
.postep-pasek { height: 100%; background: var(--akcent); transition: width .3s; }

footer {
  max-width: 68rem; margin: 0 auto; padding: 2rem 1.25rem 3rem;
  color: var(--slabe); font-size: .82rem; border-top: 1px solid var(--linia);
}

@media (max-width: 40rem) {
  nav.menu { margin-left: 0; width: 100%; }
  h1 { font-size: 1.5rem; }
}
`

export type MenuKey = 'start' | 'strony' | 'pomoc' | null

const POZYCJE: readonly { key: Exclude<MenuKey, null>; href: string; label: string }[] = [
  { key: 'start', href: '/', label: 'Start' },
  { key: 'strony', href: '/strony', label: 'Moje strony' },
  { key: 'pomoc', href: '/pomoc', label: 'Jak to działa' },
]

export interface SzkieletOpcje {
  readonly tytul: string
  readonly aktywne?: MenuKey
  /** Sekundy do samoodswiezenia; `null` znaczy: nie odswiezaj. */
  readonly odswiez?: number | null
}

export function szkielet(opcje: SzkieletOpcje, tresc: string): string {
  const menu = POZYCJE.map((p) =>
    `<a href="${p.href}"${p.key === opcje.aktywne ? ' aria-current="page"' : ''}>${p.label}</a>`,
  ).join('')

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
${opcje.odswiez === undefined || opcje.odswiez === null ? '' : `<meta http-equiv="refresh" content="${opcje.odswiez}">`}
<title>${escapeHtml(opcje.tytul)} · Panel SEO/GEO</title>
<style>${PANEL_STYLE}</style>
</head>
<body>
<header class="pasek">
  <div class="pasek-srodek">
    <a class="marka" href="/"><span class="znak">R</span> Panel SEO/GEO</a>
    <nav class="menu">${menu}</nav>
  </div>
</header>
<main>
${tresc}
</main>
<footer>
  Wszystko dzieje się na Twoim komputerze. Jedyny ruch na zewnątrz to pobranie
  stron, które sam wskazałeś — crawler czyta <code>robots.txt</code>, czeka
  sekundę między żądaniami i przedstawia się jawnie.
</footer>
</body>
</html>
`
}

export function kafel(
  etykieta: string, wartosc: string, pod = '', stan: 'zwykly' | 'ok' | 'alarm' = 'zwykly',
): string {
  const klasa = stan === 'zwykly' ? '' : ` ${stan}`
  return `<div class="karta kafel${klasa}">
  <div class="etykieta">${escapeHtml(etykieta)}</div>
  <div class="liczba">${escapeHtml(wartosc)}</div>
  ${pod === '' ? '' : `<div class="pod">${escapeHtml(pod)}</div>`}
</div>`
}

export function plakietka(tekst: string, rodzaj: string): string {
  return `<span class="plakietka ${rodzaj}">${escapeHtml(tekst)}</span>`
}
