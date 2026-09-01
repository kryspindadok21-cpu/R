import { escapeHtml } from '@seo/report'
import { kafel, plakietka, szkielet } from './layout.js'

/**
 * Strona silnika tresci: klastry fraz i briefy.
 *
 * Ta warstwa **nie dziala bez Search Console** i strona ma to mowic wprost,
 * zamiast pokazywac pusty formularz. Klastry powstaja z prawdziwych wyswietlen
 * i pozycji; zbudowane z szacunkow bylyby zgadywaniem podanym jako pomiar.
 */

export interface KlasterWidok {
  readonly slug: string
  readonly head: string
  readonly impressions: number
  readonly clicks: number
  readonly keywords: number
}

export interface BriefWidok {
  readonly id: string
  readonly clusterHead: string
  readonly decision: string
  readonly createdAt: string
}

export interface TrescStan {
  readonly siteId: string
  readonly siteUri: string
  /** Zakres dat, ktory naprawde jest w bazie; `null` znaczy brak danych z GSC. */
  readonly zakres: { readonly from: string; readonly to: string } | null
  readonly metoda: string | null
  readonly zestawZakres: { readonly from: string; readonly to: string } | null
  readonly klastry: readonly KlasterWidok[]
  readonly briefy: readonly BriefWidok[]
  readonly ostrzezenie: string | null
  readonly komunikat: string | null
}

const DECYZJA_ETYKIETA: Readonly<Record<string, string>> = {
  refresh: 'odświeżyć istniejącą', create: 'napisać nową',
}

const METODA_ETYKIETA: Readonly<Record<string, string>> = {
  'serp-overlap': 'pokrywanie się wyników wyszukiwarki',
  'lexical-overlap': 'podobieństwo słów',
}

export function stronaTresci(stan: TrescStan): string {
  const id = encodeURIComponent(stan.siteId)

  if (stan.zakres === null) {
    return szkielet({ tytul: `Treść · ${stan.siteUri}`, aktywne: 'strony' }, `
<p><a href="/strona/${id}">← ${escapeHtml(stan.siteUri)}</a></p>
<h1>Silnik treści</h1>
<p class="wiodacy">Klastry fraz, briefy i drafty za bramkami anty-slop.</p>

<div class="karta">
  <p>${plakietka('brak danych z Search Console', 'uwaga')}</p>
  <p><strong>Ta warstwa nie ma z czego liczyć.</strong></p>
  <p class="podpowiedz">Klastry powstają z prawdziwych wyświetleń, kliknięć
  i pozycji — nie z szacunków. Bez nich nie ma klastrów, więc nie ma briefów,
  więc nie ma draftów. To nie jest awaria: to odmowa policzenia czegoś,
  czego nie da się policzyć.</p>
  <p class="podpowiedz">Co trzeba zrobić raz: utworzyć konto serwisowe w Google
  Cloud, włączyć <code>Search Console API</code>, nadać temu kontu dostęp
  do witryny w Search Console, zapisać klucz w <code>~/.seo/gsc.sa.json</code>,
  a potem w terminalu <code>pnpm seo gsc sync</code>.</p>
  <p style="margin-top:1rem"><a class="przycisk cichy" href="/pomoc">Jak to działa</a></p>
</div>

<h2>Co się odblokuje</h2>
<div class="siatka siatka-2">
  <div class="karta">
    <h3>Klastry fraz</h3>
    <p class="podpowiedz">Frazy grupowane w tematy metodą nazwaną wprost.
    Bez źródła wyników wyszukiwarki działa metoda zapasowa i mówi o sobie,
    że jest hipotezą, a nie pomiarem (D33).</p>
  </div>
  <div class="karta">
    <h3>Briefy</h3>
    <p class="podpowiedz">Domyślną decyzją dla pokrytego tematu jest
    <strong>odświeżyć istniejącą stronę</strong>, nie napisać nową (D38).
    Nowa strona zawsze niesie uzasadnienie.</p>
  </div>
</div>
`)
  }

  const klastry = stan.klastry.length === 0
    ? `<div class="pusto">
  <p><strong>Jeszcze nie policzone.</strong></p>
  <p>Wybierz zakres dat i kliknij „Policz klastry".</p>
</div>`
    : `<ul class="czysta">${stan.klastry.map((k) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(k.head)}</h3>
      <div class="adres">${k.keywords} fraz · ${k.impressions} wyświetleń · ${k.clicks} kliknięć</div>
    </div>
    <form method="post" action="/tresc/${id}/brief">
      <input type="hidden" name="slug" value="${escapeHtml(k.slug)}">
      <button class="przycisk cichy" type="submit">Zrób brief</button>
    </form>
  </div>
</li>`).join('')}</ul>`

  const briefy = stan.briefy.length === 0
    ? '<div class="pusto"><p>Żadnego briefu.</p></div>'
    : `<ul class="czysta">${stan.briefy.map((b) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3><a href="/brief/${encodeURIComponent(b.id)}">${escapeHtml(b.clusterHead)}</a></h3>
      <div class="adres">${escapeHtml(b.createdAt)}</div>
    </div>
    ${plakietka(DECYZJA_ETYKIETA[b.decision] ?? b.decision,
      b.decision === 'refresh' ? 'dobra' : 'uwaga')}
  </div>
</li>`).join('')}</ul>`

  return szkielet({ tytul: `Treść · ${stan.siteUri}`, aktywne: 'strony' }, `
<p><a href="/strona/${id}">← ${escapeHtml(stan.siteUri)}</a></p>
<h1>Silnik treści</h1>
<p class="wiodacy">Frazy z Search Console grupowane w tematy, a z tematu brief:
co pokryć, czego brakuje, i czy w ogóle pisać nową stronę.</p>

${stan.komunikat === null ? '' : `<div class="karta" style="margin-bottom:1.25rem">
  <p>${plakietka('zrobione', 'dobra')} ${escapeHtml(stan.komunikat)}</p>
</div>`}

<div class="siatka siatka-3">
  ${kafel('Klastry', String(stan.klastry.length))}
  ${kafel('Briefy', String(stan.briefy.length))}
  ${kafel('Dane z GSC', `${escapeHtml(stan.zakres.from)} → ${escapeHtml(stan.zakres.to)}`, 'zakres w bazie')}
</div>

<h2>Policz klastry</h2>
<div class="karta">
  <form class="pole-obok" method="post" action="/tresc/${id}/klastry">
    <div class="pole">
      <label for="from">Od</label>
      <input type="date" id="from" name="from" required
             value="${escapeHtml(stan.zakres.from)}"
             min="${escapeHtml(stan.zakres.from)}" max="${escapeHtml(stan.zakres.to)}">
    </div>
    <div class="pole">
      <label for="to">Do</label>
      <input type="date" id="to" name="to" required
             value="${escapeHtml(stan.zakres.to)}"
             min="${escapeHtml(stan.zakres.from)}" max="${escapeHtml(stan.zakres.to)}">
    </div>
    <button type="submit">Policz klastry</button>
  </form>
  <p class="podpowiedz" style="margin-top:.8rem">Daty są takie, jak przyszły
  z Search Console — bez przeliczania stref. Źródłem jest
  <code>America/Los_Angeles</code>, a przepisanie tej daty na lokalną
  przesunęłoby część wierszy o dzień.</p>
</div>

${stan.ostrzezenie === null ? '' : `<div class="karta" style="margin-top:1.25rem">
  <p>${plakietka('metoda zapasowa', 'uwaga')}</p>
  <p class="podpowiedz">${escapeHtml(stan.ostrzezenie)}</p>
</div>`}

<h2>Tematy${stan.metoda === null ? '' : ` · ${escapeHtml(METODA_ETYKIETA[stan.metoda] ?? stan.metoda)}`}</h2>
${stan.zestawZakres === null ? '' : `<p class="podpowiedz">Policzone z zakresu
${escapeHtml(stan.zestawZakres.from)} → ${escapeHtml(stan.zestawZakres.to)}.</p>`}
${klastry}

<h2>Briefy</h2>
${briefy}

<p class="nota">Draft powstaje z briefu w terminalu (<code>pnpm seo draft</code>)
i przechodzi bramki anty-slop: bez własnych danych, cytatu z pierwszej ręki albo
podpisu eksperta jest odrzucany. Publikacja idzie <strong>zawsze</strong> przez
pull request na osobnej gałęzi — merge jest Twoją decyzją, nie naszą.</p>
`)
}

export interface BriefStan {
  readonly siteId: string
  readonly clusterHead: string
  readonly decision: string
  readonly targetUrl: string | null
  readonly markdown: string
}

export function stronaBriefu(stan: BriefStan): string {
  const id = encodeURIComponent(stan.siteId)
  return szkielet({ tytul: `Brief · ${stan.clusterHead}`, aktywne: 'strony' }, `
<p><a href="/tresc/${id}">← Silnik treści</a></p>
<h1>${escapeHtml(stan.clusterHead)}</h1>
<p class="wiodacy">
  ${plakietka(DECYZJA_ETYKIETA[stan.decision] ?? stan.decision,
    stan.decision === 'refresh' ? 'dobra' : 'uwaga')}
  ${stan.targetUrl === null ? '' : ` · <a href="${escapeHtml(stan.targetUrl)}"
     rel="noreferrer noopener">${escapeHtml(stan.targetUrl)}</a>`}
</p>

<div class="karta">
  <pre class="zrzut">${escapeHtml(stan.markdown)}</pre>
</div>

<p class="nota">Brief to wejście do <code>pnpm seo draft</code>. Sam brief niczego
nie publikuje i nie zmienia — jest dokumentem do przeczytania.</p>
`)
}
