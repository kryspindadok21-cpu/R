import { escapeHtml, STYLE } from '@seo/report'
import type { Job } from './jobs.js'

/**
 * Strony panelu.
 *
 * Ten sam zakaz, co w raportach: **zero zasobow z sieci**. Panel ma dzialac
 * na komputerze bez internetu tak samo jak z nim — a poza tym narzedzie
 * mierzace niezaleznosc od zewnetrznych zasobow, ktore samo ich wymaga,
 * bylo by zartem.
 */

const DODATKOWY_STYL = `
form { display: grid; gap: .75rem; max-width: 40rem; margin: 1.5rem 0; }
label { font-weight: 600; font-size: .9rem; }
input[type=url], input[type=number] {
  padding: .6rem .7rem; font: inherit; border: 1px solid var(--linia);
  border-radius: .4rem; background: var(--tlo); color: var(--tekst); width: 100%;
}
button {
  padding: .7rem 1.2rem; font: inherit; font-weight: 600; cursor: pointer;
  border: 0; border-radius: .4rem; background: var(--akcent);
  /* Tlo strony jako kolor tekstu: w jasnym motywie biale na niebieskim,
     w ciemnym ciemne na jasnoniebieskim. Sztywne #fff dawaloby w ciemnym
     motywie bialy tekst na jasnym tle. */
  color: var(--tlo);
  justify-self: start;
}
button:hover { filter: brightness(1.1); }
.pole { display: grid; gap: .3rem; }
.podpowiedz { font-size: .82rem; color: var(--slabe); font-weight: 400; }
.karta { border: 1px solid var(--linia); border-radius: .5rem; padding: 1rem; margin: .6rem 0; }
.karta a { font-weight: 600; }
.postep { font-size: 1.1rem; font-weight: 600; }
.blad { color: #b3261e; }
nav { margin: 1rem 0 2rem; display: flex; gap: 1rem; flex-wrap: wrap; }
`

function szkielet(tytul: string, tresc: string, odswiez: number | null = null): string {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${odswiez === null ? '' : `<meta http-equiv="refresh" content="${odswiez}">`}
<title>${escapeHtml(tytul)}</title>
<style>${STYLE}${DODATKOWY_STYL}</style>
</head>
<body><main>
${tresc}
</main></body>
</html>
`
}

export interface SiteRow {
  readonly id: string
  readonly propertyUri: string
  readonly pages: number
  readonly findings: number
  readonly hasGeo: boolean
}

export function stronaGlowna(sites: readonly SiteRow[], jobs: readonly Job[]): string {
  const lista = sites.length === 0
    ? '<p class="pusto">Nie ma jeszcze zadnej strony. Dodaj pierwsza powyzej.</p>'
    : sites.map((s) => `<div class="karta">
  <div><strong>${escapeHtml(s.propertyUri)}</strong></div>
  <p class="meta">${s.pages} stron w ostatnim crawlu · ${s.findings} ustalen audytu</p>
  <p>
    <a href="/raport/${encodeURIComponent(s.id)}">Raport techniczny</a>
    · <a href="/agent/${encodeURIComponent(s.id)}">Tablica agenta</a>
    ${s.hasGeo ? `· <a href="/raport-geo/${encodeURIComponent(s.id)}">Widocznosc w AI</a>` : ''}
  </p>
</div>`).join('\n')

  const wToku = jobs.filter((j) => j.state === 'w-toku')
  const trwajace = wToku.length === 0 ? '' : `<h2>W trakcie</h2>
${wToku.map((j) => `<div class="karta">
  <div><strong>${escapeHtml(j.siteUrl)}</strong></div>
  <p class="meta">${escapeHtml(j.step)} · <a href="/zadanie/${encodeURIComponent(j.id)}">podglad</a></p>
</div>`).join('\n')}`

  return szkielet('Panel SEO/GEO', `
<h1>Panel SEO/GEO</h1>
<p class="meta">Wszystko dzieje sie na Twoim komputerze. Zadne dane nie wychodza
na zewnatrz poza samym pobraniem stron, ktore analizujesz.</p>

<h2>Dodaj strone do analizy</h2>
<form method="post" action="/analizuj">
  <div class="pole">
    <label for="url">Adres strony</label>
    <input type="url" id="url" name="url" required placeholder="https://przyklad.pl/"
           value="">
    <span class="podpowiedz">Pelny adres z <code>https://</code>. Crawler czyta
    <code>robots.txt</code> i przedstawia sie jawnie — nigdy nie podszywa sie pod przegladarke.</span>
  </div>
  <div class="pole">
    <label for="maxPages">Ile stron najwyzej</label>
    <input type="number" id="maxPages" name="maxPages" value="25" min="1" max="500">
    <span class="podpowiedz">Jedno zadanie na sekunde na host, wiec 25 stron to okolo pol minuty.</span>
  </div>
  <button type="submit">Przeanalizuj</button>
</form>

${trwajace}

<h2>Twoje strony</h2>
${lista}

<p class="nota">Ten panel nie podaje oceny w skali 0–100. Taka liczba wymaga wag,
ktorych nikt nie umie uzasadnic, i zacheca do poprawiania wskaznika zamiast strony.
Kazde ustalenie ma adres i zmierzona wartosc — to da sie sprawdzic palcem.</p>
`)
}

export function stronaZadania(job: Job): string {
  if (job.state === 'blad') {
    return szkielet('Nie udalo sie', `
<h1>Nie udalo sie przeanalizowac</h1>
<p class="meta">${escapeHtml(job.siteUrl)}</p>
<div class="karta">
  <p class="blad postep">${escapeHtml(job.error ?? 'nieznany blad')}</p>
</div>
<nav><a href="/">← wroc do panelu</a></nav>
`)
  }

  if (job.state === 'gotowe' && job.siteId !== null) {
    const sekundy = Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000)
    return szkielet('Gotowe', `
<h1>Gotowe</h1>
<p class="meta">${escapeHtml(job.siteUrl)} · ${sekundy} s</p>
<div class="karta">
  <p><a href="/raport/${encodeURIComponent(job.siteId)}">Otworz raport techniczny</a></p>
  <p><a href="/agent/${encodeURIComponent(job.siteId)}">Zobacz, co agent proponuje</a></p>
</div>
<nav><a href="/">← wroc do panelu</a></nav>
`, null)
  }

  const sekundy = Math.round((Date.now() - job.startedAt) / 1000)
  return szkielet('Analizuje…', `
<h1>Analizuje…</h1>
<p class="meta">${escapeHtml(job.siteUrl)} · ${sekundy} s</p>
<div class="karta">
  <p class="postep">${escapeHtml(job.step)}</p>
  <p class="podpowiedz">Ta strona odswieza sie sama co dwie sekundy.
  Crawler czeka sekunde miedzy zadaniami, zeby nie obciazac serwera — to nie jest
  wolnosc narzedzia, tylko uprzejmosc wobec strony, ktora badasz.</p>
</div>
<nav><a href="/">← wroc do panelu</a></nav>
`, 2)
}

export function stronaBledu(kod: number, wiadomosc: string): string {
  return szkielet(`Blad ${kod}`, `
<h1>Blad ${kod}</h1>
<p>${escapeHtml(wiadomosc)}</p>
<nav><a href="/">← wroc do panelu</a></nav>
`)
}

export interface AgentRow {
  readonly title: string
  readonly state: string
  readonly gate: string
  readonly gateReason: string
  readonly verdict: string | null
}

export function stronaAgenta(
  siteUri: string,
  siteId: string,
  summary: Readonly<Record<string, number>>,
  rows: readonly AgentRow[],
): string {
  const etykieta: Readonly<Record<string, string>> = {
    auto: 'idzie samo',
    'needs-approval': 'czeka na Ciebie',
    blocked: 'zablokowane',
  }

  const lista = rows.length === 0
    ? '<p class="pusto">Agent nie ma jeszcze zadnych wnioskow. Kliknij „Znajdz okazje".</p>'
    : rows.map((r) => `<div class="karta">
  <div><strong>${escapeHtml(r.title)}</strong></div>
  <p class="meta">${escapeHtml(r.state)} · ${escapeHtml(etykieta[r.gate] ?? r.gate)}</p>
  ${r.gateReason === '' ? '' : `<p class="nota">${escapeHtml(r.gateReason)}</p>`}
  ${r.verdict === null ? '' : `<p><strong>${escapeHtml(r.verdict)}</strong></p>`}
</div>`).join('\n')

  return szkielet(`Agent — ${siteUri}`, `
<h1>Tablica agenta</h1>
<p class="meta">${escapeHtml(siteUri)}</p>

<div class="kafelki">
  <div class="kafelek"><div class="etykieta">Wnioski</div><div class="liczba">${summary.proposed ?? 0}</div></div>
  <div class="kafelek"><div class="etykieta">Czeka na Ciebie</div><div class="liczba">${summary.needsYou ?? 0}</div></div>
  <div class="kafelek"><div class="etykieta">W trakcie</div><div class="liczba">${summary.inFlight ?? 0}</div></div>
  <div class="kafelek"><div class="etykieta">W pomiarze</div><div class="liczba">${summary.measuring ?? 0}</div></div>
  <div class="kafelek"><div class="etykieta">Z werdyktem</div><div class="liczba">${summary.done ?? 0}</div></div>
</div>

<form method="post" action="/agent/${encodeURIComponent(siteId)}/plan">
  <button type="submit">Znajdz okazje</button>
</form>

<p class="nota">Agent <strong>proponuje</strong> i nie wykonuje. Zadanie powstaje
jako wniosek; do wykonania trzeba albo polityki „idzie samo", albo Twojej zgody.
Wylacznik bije polityke: przy spadku klikniec o ponad 20% tydzien do tygodnia
wstrzymywane jest wszystko, co zapisuje.</p>

${lista}

<nav><a href="/">← wroc do panelu</a> · <a href="/raport/${encodeURIComponent(siteId)}">raport techniczny</a></nav>
`)
}
