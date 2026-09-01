import { escapeHtml } from '@seo/report'
import type { Job } from './jobs.js'
import { kafel, plakietka, szkielet } from './layout.js'

/** Dane witryny na potrzeby list i kafelkow. */
export interface SiteRow {
  readonly id: string
  readonly propertyUri: string
  readonly pages: number
  readonly failedPages: number
  readonly findings: number
  readonly blocking: number
  readonly crawledAt: string | null
  readonly hasGeo: boolean
  readonly hasClusters: boolean
  readonly agentTasks: number
}

function formularzAnalizy(wartosc = '', autofocus = false): string {
  return `<form class="pole-obok" method="post" action="/analizuj">
  <div class="pole">
    <label for="url">Adres strony</label>
    <input type="url" id="url" name="url" required inputmode="url"
           placeholder="https://twoja-strona.pl/" value="${escapeHtml(wartosc)}"
           ${autofocus ? 'autofocus' : ''}>
  </div>
  <div class="pole" style="flex: 0 1 9rem">
    <label for="maxPages">Ile stron</label>
    <input type="number" id="maxPages" name="maxPages" value="25" min="1" max="200">
  </div>
  <button type="submit">Przeanalizuj</button>
</form>
<p class="podpowiedz">Pełny adres z <code>https://</code>. Crawler czeka sekundę
między żądaniami, więc 25 stron to około pół minuty.</p>`
}

function kartaWitryny(s: SiteRow): string {
  const stan = s.blocking > 0
    ? plakietka(`${s.blocking} do naprawy`, 'zla')
    : s.findings > 0
      ? plakietka(`${s.findings} ustaleń`, 'uwaga')
      : plakietka('bez ustaleń', 'dobra')

  return `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3><a href="/strona/${encodeURIComponent(s.id)}">${escapeHtml(s.propertyUri)}</a></h3>
      <div class="adres">${s.pages} stron · ${escapeHtml(s.crawledAt ?? 'brak crawla')}</div>
    </div>
    <div style="display:flex; gap:.4rem; align-items:center; flex-wrap:wrap">
      ${stan}
      <a class="przycisk cichy" href="/strona/${encodeURIComponent(s.id)}">Otwórz</a>
    </div>
  </div>
</li>`
}

export function stronaStart(sites: readonly SiteRow[], jobs: readonly Job[]): string {
  const wToku = jobs.filter((j) => j.state === 'w-toku')

  const trwajace = wToku.length === 0 ? '' : `
<h2>W trakcie</h2>
<ul class="czysta">
${wToku.map((j) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(j.siteUrl)}</h3>
      <div class="adres">${escapeHtml(j.step)}</div>
    </div>
    <a class="przycisk cichy" href="/zadanie/${encodeURIComponent(j.id)}">Podgląd</a>
  </div>
</li>`).join('')}
</ul>`

  const lista = sites.length === 0
    ? `<div class="pusto">
  <p><strong>Nie masz jeszcze żadnej strony.</strong></p>
  <p>Wklej adres powyżej — nawet cudzy. Analiza jest tylko do odczytu i niczego nie zmienia.</p>
</div>`
    : `<ul class="czysta">${sites.slice(0, 6).map(kartaWitryny).join('')}</ul>
${sites.length > 6 ? '<p style="margin-top:.9rem"><a href="/strony">Zobacz wszystkie ' + sites.length + '</a></p>' : ''}`

  return szkielet({ tytul: 'Start', aktywne: 'start' }, `
<h1>Sprawdź, co blokuje Twoją stronę</h1>
<p class="wiodacy">Crawler przechodzi witrynę, silnik reguł sprawdza 61 rzeczy,
a raport pokazuje każde ustalenie z adresem i zmierzoną wartością.
Bez oceny w skali 0–100, bo taka liczba zachęca do poprawiania wskaźnika zamiast strony.</p>

<div class="karta">
${formularzAnalizy('', sites.length === 0)}
</div>

${trwajace}

<h2>Twoje strony</h2>
${lista}

<h2>Co ten panel potrafi</h2>
<div class="siatka siatka-2">
  <div class="karta">
    <h3>Audyt techniczny</h3>
    <p class="podpowiedz">61 reguł: indeksacja, treść, linki, obrazy, dane strukturalne.
    Każde ustalenie ma adres i dowód. Reguła bez danych milczy i melduje się jako pominięta.</p>
    <span class="plakietka dobra">działa od razu</span>
  </div>
  <div class="karta">
    <h3>Widoczność w AI</h3>
    <p class="podpowiedz">Ile razy modele wymieniają Twoją markę na pytania klientów,
    z przedziałem ufności przy każdej liczbie. Markę i pytania ustawiasz
    w panelu; sam pomiar wymaga darmowego klucza do silnika.</p>
    <span class="plakietka uwaga">potrzebny klucz</span>
  </div>
  <div class="karta">
    <h3>Silnik treści</h3>
    <p class="podpowiedz">Klastry fraz, briefy z Twoich danych, draft za bramkami
    anty-slop, publikacja przez pull request. Wymaga danych z Search Console.</p>
    <span class="plakietka uwaga">potrzebne GSC</span>
  </div>
  <div class="karta">
    <h3>Pętla agentowa</h3>
    <p class="podpowiedz">Scoring okazji, polityki, wyłączniki bezpieczeństwa
    i pomiar różnicą w różnicach — czy zmiana naprawdę pomogła.</p>
    <span class="plakietka dobra">działa od razu</span>
  </div>
</div>

<p class="nota">Ten panel nie podaje oceny w skali 0–100. Taka liczba wymaga wag,
których nikt nie umie uzasadnić. Zamiast tego każde ustalenie ma adres i zmierzoną
wartość — to da się sprawdzić palcem.</p>
`)
}

export function stronaListyWitryn(sites: readonly SiteRow[]): string {
  return szkielet({ tytul: 'Moje strony', aktywne: 'strony' }, `
<h1>Moje strony</h1>
<p class="wiodacy">${sites.length === 0 ? 'Jeszcze nic tu nie ma.' : `${sites.length} ${sites.length === 1 ? 'witryna' : 'witryn'} w lokalnej bazie.`}</p>

<div class="karta" style="margin-bottom:1.5rem">
${formularzAnalizy()}
</div>

${sites.length === 0
  ? '<div class="pusto"><p>Dodaj pierwszą stronę powyżej.</p></div>'
  : `<ul class="czysta">${sites.map(kartaWitryny).join('')}</ul>`}
`)
}

export interface SiteDetail extends SiteRow {
  readonly severity: Readonly<Record<string, number>>
  readonly topRules: readonly { ruleId: string; title: string; count: number; severity: string }[]
  readonly orphans: number
  readonly truncated: boolean
  readonly robotsState: string
  readonly agentSummary: Readonly<Record<string, number>>
}

const WAGA_ETYKIETA: Readonly<Record<string, string>> = {
  blocker: 'blokujące', high: 'wysokie', medium: 'średnie', low: 'niskie', info: 'informacyjne',
}

export function stronaWitryny(s: SiteDetail): string {
  const id = encodeURIComponent(s.id)

  const reguly = s.topRules.length === 0
    ? '<div class="pusto"><p>Audyt nie znalazł żadnych ustaleń.</p></div>'
    : `<ul class="czysta">${s.topRules.slice(0, 8).map((r) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(r.title)}</h3>
      <div class="adres">${escapeHtml(r.ruleId)}</div>
    </div>
    <div style="display:flex; gap:.4rem; align-items:center">
      ${plakietka(WAGA_ETYKIETA[r.severity] ?? r.severity,
        r.severity === 'blocker' || r.severity === 'high' ? 'zla'
        : r.severity === 'medium' ? 'uwaga' : 'neutralna')}
      <span class="plakietka neutralna">${r.count}×</span>
    </div>
  </div>
</li>`).join('')}</ul>`

  return szkielet({ tytul: s.propertyUri, aktywne: 'strony' }, `
<p><a href="/strony">← Moje strony</a></p>
<h1>${escapeHtml(s.propertyUri)}</h1>
<p class="wiodacy">
  ${escapeHtml(s.crawledAt ?? 'brak crawla')} ·
  robots.txt: ${escapeHtml(s.robotsState)}
  ${s.truncated ? ' · <strong>crawl ucięty</strong>' : ''}
</p>

<div class="siatka siatka-3">
  ${kafel('Strony', String(s.pages), s.failedPages > 0 ? `${s.failedPages} nieudanych` : 'wszystkie pobrane',
    s.failedPages > 0 ? 'alarm' : 'ok')}
  ${kafel('Ustalenia', String(s.findings), 'razem')}
  ${kafel('Do naprawy', String(s.blocking), 'blokujące i wysokie', s.blocking > 0 ? 'alarm' : 'ok')}
  ${kafel('Osierocone', String(s.orphans), 'bez linków wewnętrznych', s.orphans > 0 ? 'alarm' : 'ok')}
  ${kafel('Zadania agenta', String(s.agentTasks), 'wnioski i w toku')}
  ${kafel('Widoczność w AI', s.hasGeo ? 'zmierzona' : '—', s.hasGeo ? '' : 'brak pomiaru')}
</div>

<h2>Co dalej</h2>
<div class="siatka siatka-2">
  <div class="karta">
    <h3>Raport techniczny</h3>
    <p class="podpowiedz">Pełna lista ustaleń z adresami, dowodami i kolejnością napraw.</p>
    <a class="przycisk" href="/raport/${id}">Otwórz raport</a>
  </div>
  <div class="karta">
    <h3>Tablica agenta</h3>
    <p class="podpowiedz">Okazje uszeregowane arytmetyką, z polityką i wyłącznikami.</p>
    <a class="przycisk cichy" href="/agent/${id}">Otwórz tablicę</a>
  </div>
  <div class="karta">
    <h3>Widoczność w AI</h3>
    <p class="podpowiedz">${s.hasGeo
      ? 'Ile razy modele wymieniają markę, z przedziałem ufności przy każdej liczbie.'
      : 'Ustaw markę i pytania klientów, a policzymy, jak często modele Cię wymieniają.'}</p>
    <a class="przycisk cichy" href="/geo/${id}">${s.hasGeo ? 'Otwórz tracker' : 'Ustaw tracker'}</a>
    ${s.hasGeo ? `<a class="przycisk cichy" href="/raport-geo/${id}"
       style="margin-left:.4rem">Raport GEO</a>` : ''}
  </div>
  <div class="karta">
    <h3>Silnik treści</h3>
    <p class="podpowiedz">${s.hasClusters
      ? 'Tematy z fraz Search Console i briefy: co pokryć i czy w ogóle pisać nową stronę.'
      : 'Klastry fraz i briefy. Liczy na prawdziwych wyświetleniach, więc potrzebuje Search Console.'}</p>
    <a class="przycisk cichy" href="/tresc/${id}">Otwórz treść</a>
  </div>
  <div class="karta">
    <h3>llms.txt</h3>
    <p class="podpowiedz">Spis treści witryny dla modeli językowych, złożony
    z zapisanego crawla — bez jednego nowego żądania do Twojego serwera.</p>
    <a class="przycisk cichy" href="/llms-txt/${id}">Zobacz plik</a>
  </div>
  <div class="karta">
    <h3>Przeanalizuj ponownie</h3>
    <p class="podpowiedz">Nowy crawl i audyt na tym samym adresie.</p>
    <form method="post" action="/analizuj" style="margin-top:.6rem">
      <input type="hidden" name="url" value="${escapeHtml(s.propertyUri)}">
      <input type="hidden" name="maxPages" value="25">
      <button type="submit">Przeanalizuj ponownie</button>
    </form>
  </div>
</div>

<h2>Ustalenia według wagi</h2>
<div class="siatka siatka-3">
  ${(['blocker', 'high', 'medium', 'low', 'info'] as const).map((w) =>
    kafel(WAGA_ETYKIETA[w] as string, String(s.severity[w] ?? 0), '',
      (w === 'blocker' || w === 'high') && (s.severity[w] ?? 0) > 0 ? 'alarm' : 'zwykly'),
  ).join('')}
</div>

<h2>Najczęstsze ustalenia</h2>
${reguly}
<p style="margin-top:.9rem"><a href="/raport/${id}">Zobacz wszystkie w raporcie →</a></p>
`)
}

export function stronaZadania(job: Job): string {
  if (job.state === 'blad') {
    return szkielet({ tytul: 'Nie udało się', aktywne: 'start' }, `
<h1>Nie udało się przeanalizować</h1>
<p class="wiodacy">${escapeHtml(job.siteUrl)}</p>
<div class="karta">
  <p>${plakietka('błąd', 'zla')}</p>
  <p><strong>${escapeHtml(job.error ?? 'nieznany błąd')}</strong></p>
  <p class="podpowiedz">Najczęstsze przyczyny: adres nie istnieje, serwer nie odpowiada,
  albo <code>robots.txt</code> zabrania crawlowania. Sprawdź adres i spróbuj ponownie.</p>
</div>
<p style="margin-top:1.25rem"><a class="przycisk cichy" href="/">← wróć do panelu</a></p>
`)
  }

  if (job.state === 'gotowe' && job.siteId !== null) {
    const sekundy = Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000)
    const id = encodeURIComponent(job.siteId)

    const dalej = job.rodzaj === 'geo'
      ? `<div class="karta">
    <h3>Raport widoczności</h3>
    <p class="podpowiedz">Udział w głosie, cytowania i pozycja wzmianki —
    każda liczba z przedziałem ufności.</p>
    <a class="przycisk" href="/raport-geo/${id}">Otwórz raport GEO</a>
  </div>
  <div class="karta">
    <h3>Tracker</h3>
    <p class="podpowiedz">Prompty, marki i historia przebiegów.</p>
    <a class="przycisk cichy" href="/geo/${id}">Wróć do trackera</a>
  </div>`
      : `<div class="karta">
    <h3>Przegląd witryny</h3>
    <p class="podpowiedz">Liczby, najczęstsze ustalenia i co robić dalej.</p>
    <a class="przycisk" href="/strona/${id}">Otwórz przegląd</a>
  </div>
  <div class="karta">
    <h3>Raport techniczny</h3>
    <p class="podpowiedz">Pełna lista z adresami i dowodami.</p>
    <a class="przycisk cichy" href="/raport/${id}">Otwórz raport</a>
  </div>`

    return szkielet({ tytul: 'Gotowe', aktywne: 'start' }, `
<h1>Gotowe</h1>
<p class="wiodacy">${escapeHtml(job.siteUrl)} · zajęło ${sekundy} s</p>
<div class="siatka siatka-2">
${dalej}
</div>
`)
  }

  const sekundy = Math.round((Date.now() - job.startedAt) / 1000)
  // Szacunek na rodzaj zadania. Crawl 25 stron to okolo pol minuty; przebieg
  // trackera to kilkadziesiat wywolan modelu i idzie kilka minut. Wspolny pasek
  // dobity do 95% po trzydziestu sekundach klamalby przez reszte czekania.
  const oczekiwane = job.rodzaj === 'geo' ? 240 : 40
  const procent = Math.min(95, Math.round((sekundy / oczekiwane) * 100))

  const nota = job.rodzaj === 'geo'
    ? `Każde pytanie idzie do silnika osobno, a każdy prompt powtarzamy trzy razy —
  jeden przebieg to próba losowa, nie pomiar. Stąd czekanie: liczymy przedział
  ufności, a nie pojedynczą odpowiedź.`
    : `Crawler czeka sekundę między żądaniami — to nie jest wolność narzędzia, tylko
  uprzejmość wobec strony, którą badasz.`

  return szkielet({
    tytul: job.rodzaj === 'geo' ? 'Pytam modele…' : 'Analizuję…', aktywne: 'start', odswiez: 2,
  }, `
<h1>${job.rodzaj === 'geo' ? 'Pytam modele…' : 'Analizuję…'}</h1>
<p class="wiodacy">${escapeHtml(job.siteUrl)} · ${sekundy} s</p>
<div class="karta">
  <p><strong>${escapeHtml(job.step)}</strong></p>
  <div class="postep-tlo"><div class="postep-pasek" style="width:${procent}%"></div></div>
  <p class="podpowiedz" style="margin-top:.8rem">Ta strona odświeża się sama co dwie sekundy.
  ${nota}</p>
</div>
<p style="margin-top:1.25rem"><a href="/">← wróć do panelu</a></p>
`)
}

export interface AgentRow {
  readonly title: string
  readonly state: string
  readonly gate: string
  readonly gateReason: string
  readonly verdict: string | null
}

const STAN_ETYKIETA: Readonly<Record<string, string>> = {
  proposed: 'wniosek', 'needs-you': 'czeka na Ciebie', 'in-flight': 'w trakcie',
  measuring: 'w pomiarze', done: 'zakończone',
}

const BRAMKA_ETYKIETA: Readonly<Record<string, string>> = {
  auto: 'idzie samo', 'needs-approval': 'wymaga zgody', blocked: 'zablokowane',
}

export interface PodsumowaniePomiaru {
  readonly experiments: number
  readonly windows: number
  readonly pending: number
  readonly finished: number
  readonly zdania: readonly string[]
}

export function stronaAgenta(
  siteUri: string, siteId: string,
  summary: Readonly<Record<string, number>>,
  rows: readonly AgentRow[],
  pomiar: PodsumowaniePomiaru | null = null,
): string {
  const id = encodeURIComponent(siteId)

  const lista = rows.length === 0
    ? `<div class="pusto">
  <p><strong>Agent nie ma jeszcze żadnych wniosków.</strong></p>
  <p>Kliknij „Znajdź okazje" — przejrzy ustalenia audytu, klastry fraz i luki
  widoczności, a potem uszereguje je arytmetyką.</p>
</div>`
    : `<ul class="czysta">${rows.map((r) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(r.title)}</h3>
      ${r.gateReason === '' ? '' : `<p class="podpowiedz">${escapeHtml(r.gateReason)}</p>`}
      ${r.verdict === null ? '' : `<p><strong>${escapeHtml(r.verdict)}</strong></p>`}
    </div>
    <div style="display:flex; gap:.4rem; align-items:center; flex-wrap:wrap">
      ${plakietka(STAN_ETYKIETA[r.state] ?? r.state, 'neutralna')}
      ${plakietka(BRAMKA_ETYKIETA[r.gate] ?? r.gate,
        r.gate === 'auto' ? 'dobra' : r.gate === 'blocked' ? 'zla' : 'uwaga')}
    </div>
  </div>
</li>`).join('')}</ul>`

  return szkielet({ tytul: `Agent · ${siteUri}`, aktywne: 'strony' }, `
<p><a href="/strona/${id}">← ${escapeHtml(siteUri)}</a></p>
<h1>Tablica agenta</h1>
<p class="wiodacy">Agent <strong>proponuje i nie wykonuje</strong>. Zadanie powstaje
jako wniosek; do wykonania trzeba albo polityki „idzie samo", albo Twojej zgody.</p>

<div class="siatka siatka-3">
  ${kafel('Wnioski', String(summary.proposed ?? 0))}
  ${kafel('Czeka na Ciebie', String(summary.needsYou ?? 0), '', (summary.needsYou ?? 0) > 0 ? 'alarm' : 'zwykly')}
  ${kafel('W trakcie', String(summary.inFlight ?? 0))}
  ${kafel('W pomiarze', String(summary.measuring ?? 0))}
  ${kafel('Z werdyktem', String(summary.done ?? 0), '', 'ok')}
</div>

<div class="siatka siatka-2" style="margin:1.5rem 0">
  <div class="karta">
    <h3>Przejrzyj okazje jeszcze raz</h3>
    <p class="podpowiedz">Przelicza ranking na aktualnych danych i wystawia nowe wnioski.</p>
    <form method="post" action="/agent/${id}/plan">
      <button type="submit">Znajdź okazje</button>
    </form>
  </div>
  <div class="karta">
    <h3>Zmierz skutek zmian</h3>
    <p class="podpowiedz">Różnica w różnicach: porównuje strony zmienione ze stronami
    kontrolnymi, więc odejmuje core update, sezon i ruchy konkurencji.</p>
    <form method="post" action="/agent/${id}/measure">
      <button class="przycisk cichy" type="submit">Zmierz</button>
    </form>
  </div>
</div>

${pomiar === null ? '' : `<div class="karta" style="margin-bottom:1.5rem">
  <h3>Ostatni pomiar</h3>
  <p class="podpowiedz">Eksperymenty: ${pomiar.experiments} ·
  okna zmierzone: ${pomiar.windows} · okna jeszcze trwają: ${pomiar.pending} ·
  zadania zakończone: ${pomiar.finished}</p>
  ${pomiar.zdania.length === 0
    ? '<p class="podpowiedz">Nie było czego mierzyć. Eksperyment powstaje, gdy zadanie wchodzi w wykonanie — a do tego trzeba danych z Search Console.</p>'
    : `<ul style="margin:.6rem 0 0; padding-left:1.2rem">${pomiar.zdania.map((z) => `<li>${escapeHtml(z)}</li>`).join('')}</ul>`}
</div>`}

${lista}

<p class="nota">Wyłącznik bije politykę. Przy spadku kliknięć o ponad 20% tydzień
do tygodnia wstrzymywane jest wszystko, co zapisuje — także akcje oznaczone jako
„idzie samo". Wyłącznik, który da się ominąć zatwierdzeniem, jest ostrzeżeniem,
a nie wyłącznikiem.</p>
`)
}

export interface PomocStan {
  readonly silniki: readonly { readonly id: string; readonly dostepny: boolean; readonly powod: string }[]
  readonly gscKlucz: boolean
  readonly dbPath: string
}

export function stronaPomocy(stan: PomocStan): string {
  const silniki = stan.silniki.map((s) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(s.id)}</h3>
      <p class="podpowiedz">${escapeHtml(s.powod)}</p>
    </div>
    ${plakietka(s.dostepny ? 'gotowy' : 'wyłączony', s.dostepny ? 'dobra' : 'neutralna')}
  </div>
</li>`).join('')

  return szkielet({ tytul: 'Jak to działa', aktywne: 'pomoc' }, `
<h1>Jak to działa</h1>
<p class="wiodacy">Cztery warstwy. Pierwsza działa od razu, pozostałe potrzebują
darmowych kluczy albo danych z Search Console.</p>

<h2>Co działa bez niczego</h2>
<div class="karta">
  <div class="krok"><span class="krok-numer">1</span><div>
    <strong>Wklej adres i kliknij „Przeanalizuj".</strong>
    <p class="podpowiedz">Crawler czyta <code>robots.txt</code>, przechodzi witrynę
    i zapisuje stan techniczny. Bezpieczniki są w kodzie: 1 żądanie/s na host,
    500 stron, głębokość 5, 15 minut na crawl.</p>
  </div></div>
  <div class="krok" style="margin-top:1rem"><span class="krok-numer">2</span><div>
    <strong>Przeczytaj raport.</strong>
    <p class="podpowiedz">61 reguł. Każde ustalenie ma adres i zmierzoną wartość.
    Reguła bez danych milczy i melduje się jako pominięta — cicho pominięta reguła
    to fałszywe poczucie porządku, nie brak problemu.</p>
  </div></div>
  <div class="krok" style="margin-top:1rem"><span class="krok-numer">3</span><div>
    <strong>Zobacz, co proponuje agent.</strong>
    <p class="podpowiedz">Ranking okazji to arytmetyka, nie wywołanie modelu:
    <code>(wpływ × pewność × dopasowanie) / (nakład × ryzyko)</code>.
    Każdy czynnik niesie źródło — widać, co zmierzone, a co zadeklarowane.</p>
  </div></div>
  <div class="krok" style="margin-top:1rem"><span class="krok-numer">4</span><div>
    <strong>Pobierz <code>llms.txt</code>.</strong>
    <p class="podpowiedz">Spis treści witryny dla modeli językowych, złożony
    z zapisanego crawla — bez ani jednego nowego żądania do Twojego serwera.
    Jest na stronie każdej witryny.</p>
  </div></div>
</div>

<h2>Co robisz w panelu, a co w terminalu</h2>
<div class="karta">
  <ul style="margin:0; padding-left:1.2rem">
    <li><strong>W panelu:</strong> analiza witryny, raport, tablica agenta i pomiar
    skutku zmian, ustawienie marki i pytań do trackera AI oraz sam pomiar,
    klastry fraz, briefy, <code>llms.txt</code>.</li>
    <li><strong>W terminalu:</strong> pobranie danych z Search Console
    (<code>pnpm seo gsc sync</code>), pisanie draftu (<code>pnpm seo draft</code>)
    i publikacja przez pull request (<code>pnpm seo publish</code>).</li>
  </ul>
  <p class="podpowiedz" style="margin-top:.8rem">Pisanie i publikacja zostają
  w terminalu świadomie: draft kosztuje wywołania modelu, a publikacja dotyka
  Twojego repozytorium. Jedno i drugie ma wymagać wpisania polecenia, a nie
  przypadkowego kliknięcia.</p>
</div>

<h2>Silniki językowe</h2>
<p class="podpowiedz">Do pomiaru widoczności w AI i do pisania treści. Brak klucza
pomija silnik i melduje to wprost — nigdy po cichu.</p>
<ul class="czysta">${silniki}</ul>
<p class="nota">Groq daje 14 400 żądań dziennie za darmo i to wystarcza na tygodniowy
pomiar. Ustaw klucz w terminalu: <code>export SEO_GROQ_KEY=…</code>, potem uruchom
panel ponownie.</p>

<h2>Search Console</h2>
<div class="karta">
  <p>${plakietka(stan.gscKlucz ? 'klucz znaleziony' : 'brak klucza', stan.gscKlucz ? 'dobra' : 'uwaga')}</p>
  <p class="podpowiedz">Bez fraz z Search Console nie ma klastrów, briefów ani pomiaru
  różnicą w różnicach — te warstwy liczą na prawdziwych wyświetleniach i pozycjach,
  a nie na szacunkach.</p>
  ${stan.gscKlucz ? `<p class="podpowiedz">Klucz jest na miejscu. Dane pobierasz
  w terminalu: <code>pnpm seo gsc sync --site &lt;adres-property&gt;</code>.</p>`
  : `<div class="krok"><span class="krok-numer">1</span><div>
    <strong>Konto serwisowe w Google Cloud.</strong>
    <p class="podpowiedz">Nowy projekt, włącz <em>Google Search Console API</em>,
    utwórz konto usługi i pobierz jego klucz w formacie JSON. Bez roli IAM —
    dostęp do danych nadaje się w Search Console, nie w Cloud.</p>
  </div></div>
  <div class="krok" style="margin-top:1rem"><span class="krok-numer">2</span><div>
    <strong>Klucz na dysk.</strong>
    <p class="podpowiedz">Zapisz pobrany plik jako <code>~/.seo/gsc.sa.json</code>
    i zawęź prawa: <code>chmod 600 ~/.seo/gsc.sa.json</code>.
    Nic nie musisz eksportować — panel szuka klucza właśnie tam.</p>
  </div></div>
  <div class="krok" style="margin-top:1rem"><span class="krok-numer">3</span><div>
    <strong>Dostęp w Search Console.</strong>
    <p class="podpowiedz">Adres konta znajdziesz w pliku, w polu
    <code>client_email</code>. W Search Console: <em>Ustawienia</em> →
    <em>Użytkownicy i uprawnienia</em> → <em>Dodaj użytkownika</em> →
    uprawnienie <em>Pełny</em>.</p>
  </div></div>
  <div class="krok" style="margin-top:1rem"><span class="krok-numer">4</span><div>
    <strong>Sprawdź jednym wywołaniem.</strong>
    <p class="podpowiedz"><code>pnpm seo gsc smoke --site &lt;adres-property&gt;</code> —
    to jedyne prawdziwe wywołanie API w całym projekcie poza crawlem.
    Przejdzie ono, przejdzie reszta.</p>
  </div></div>
  <p class="nota">Nie masz własnej domeny? Nie jest potrzebna. Dodaj property typu
  <em>prefiks adresu URL</em> dla strony na GitHub Pages i potwierdź własność
  tagiem HTML. Pamiętaj tylko, że Search Console <strong>nie ma danych wstecz</strong>:
  zbieranie zaczyna się w dniu dodania property.</p>`}
</div>

<h2>Czego ten panel świadomie nie robi</h2>
<div class="karta">
  <ul style="margin:0; padding-left:1.2rem">
    <li>Nie publikuje niczego bez Ciebie — treść trafia do pull requesta, merge jest Twoją decyzją.</li>
    <li>Nie podaje oceny 0–100, bo taka liczba zachęca do poprawiania wskaźnika zamiast strony.</li>
    <li>Nie miesza danych terenowych z laboratoryjnymi i nie sumuje cytowań z groundingu z tymi z treści.</li>
    <li>Nie orzeka o zmianie bez grupy kontrolnej — mówi „nie da się zmierzyć" zamiast zgadywać.</li>
    <li>Nie podszywa się pod przeglądarkę. <code>User-Agent</code> jest jawny i możliwy do zablokowania.</li>
  </ul>
</div>

<h2>Gdzie są dane</h2>
<div class="karta">
  <p class="adres">${escapeHtml(stan.dbPath)}</p>
  <p class="podpowiedz">Jeden plik SQLite. Skasowanie go kasuje wszystko;
  skopiowanie przenosi całość na inny komputer.</p>
</div>
`)
}

export function stronaBledu(kod: number, wiadomosc: string): string {
  return szkielet({ tytul: `Błąd ${kod}`, aktywne: null }, `
<h1>Błąd ${kod}</h1>
<p class="wiodacy">${escapeHtml(wiadomosc)}</p>
<p><a class="przycisk cichy" href="/">← wróć do panelu</a></p>
`)
}
