import { escapeHtml } from '@seo/report'
import { kafel, plakietka, szkielet } from './layout.js'

/**
 * Strona widocznosci w AI.
 *
 * Tracker ma trzy skladniki i **kazdy z nich jest wymagany**: definicje wlasnej
 * marki, zestaw promptow i przynajmniej jeden silnik z kluczem. Brak ktoregokolwiek
 * konczy sie odmowa z powodem, a nie pustym wykresem — to ta sama zasada, co
 * regula milczaca bez `requires` (D17). Strona pokazuje wszystkie trzy naraz,
 * zeby bylo widac, czego brakuje, zanim ktokolwiek kliknie „Zmierz".
 */

export interface EncjaWidok {
  readonly name: string
  readonly variants: readonly string[]
  readonly exclusions: readonly string[]
  readonly version: number
}

export interface PrzebiegWidok {
  readonly engine: string
  readonly modelVersion: string
  readonly startedAt: string
  readonly answers: number
}

export interface SilnikWidok {
  readonly id: string
  readonly dostepny: boolean
  readonly powod: string
}

export interface GeoStan {
  readonly siteId: string
  readonly siteUri: string
  readonly wlasna: EncjaWidok | null
  readonly konkurenci: readonly EncjaWidok[]
  readonly zestawNazwa: string | null
  readonly zestawWersja: number
  readonly zamrozony: boolean
  readonly prompty: readonly string[]
  readonly silniki: readonly SilnikWidok[]
  readonly przebiegi: readonly PrzebiegWidok[]
  /** Komunikat po zapisie formularza — znika przy nastepnym wejsciu. */
  readonly komunikat: string | null
}

const PRZYKLADOWE_PROMPTY = [
  'jaka firma robi audyt SEO w Polsce',
  'najlepsze narzędzie do monitorowania widoczności w ChatGPT',
  'jak sprawdzić, czy AI wymienia moją markę',
]

function listaEncji(e: EncjaWidok): string {
  return `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(e.name)}</h3>
      <p class="podpowiedz">${e.variants.length === 0
        ? 'bez wariantów'
        : `warianty: ${escapeHtml(e.variants.join(', '))}`}${
        e.exclusions.length === 0 ? '' : ` · wyklucza: ${escapeHtml(e.exclusions.join(', '))}`}</p>
    </div>
    ${plakietka(`wersja ${e.version}`, 'neutralna')}
  </div>
</li>`
}

export function stronaGeo(stan: GeoStan): string {
  const id = encodeURIComponent(stan.siteId)
  const gotowe = stan.silniki.filter((s) => s.dostepny)

  const brakujace: string[] = []
  if (stan.wlasna === null) brakujace.push('definicji własnej marki')
  if (stan.prompty.length === 0) brakujace.push('choć jednego promptu')
  if (gotowe.length === 0) brakujace.push('klucza do choć jednego silnika')

  const gotowoscTresc = brakujace.length === 0
    ? `<p>${plakietka('gotowe do pomiaru', 'dobra')}</p>
<p class="podpowiedz">${stan.prompty.length} promptów × 3 przebiegi ×
${gotowe.length} ${gotowe.length === 1 ? 'silnik' : 'silniki'} =
${stan.prompty.length * 3 * gotowe.length} pytań. Idzie kilka minut.</p>
<form method="post" action="/geo/${id}/run" style="margin-top:.8rem">
  <button type="submit">Zmierz widoczność</button>
</form>`
    : `<p>${plakietka('brakuje danych', 'uwaga')}</p>
<p class="podpowiedz">Do pomiaru brakuje ${escapeHtml(brakujace.join(', '))}.
Uzupełnij poniżej — pomiar bez tego nie ruszy, bo policzyłby coś innego,
niż nazwa sugeruje.</p>`

  const silniki = stan.silniki.map((s) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(s.id)}</h3>
      <p class="podpowiedz">${escapeHtml(s.powod)}</p>
    </div>
    ${plakietka(s.dostepny ? 'gotowy' : 'brak klucza', s.dostepny ? 'dobra' : 'neutralna')}
  </div>
</li>`).join('')

  const przebiegi = stan.przebiegi.length === 0
    ? '<div class="pusto"><p>Jeszcze żadnego przebiegu.</p></div>'
    : `<ul class="czysta">${stan.przebiegi.map((p) => `<li class="karta">
  <div class="wiersz">
    <div class="wiersz-tresc">
      <h3>${escapeHtml(p.engine)}</h3>
      <div class="adres">${escapeHtml(p.modelVersion)} · ${escapeHtml(p.startedAt)}</div>
    </div>
    ${plakietka(`${p.answers} odpowiedzi`, 'neutralna')}
  </div>
</li>`).join('')}</ul>
<p style="margin-top:.9rem"><a class="przycisk cichy" href="/raport-geo/${id}">Otwórz raport GEO</a></p>`

  const promptyLista = stan.prompty.length === 0
    ? `<div class="pusto">
  <p><strong>Zestaw jest pusty.</strong></p>
  <p>Wpisz pytania, które zadałby Twój klient — nie nazwę marki.
  Pytanie o markę zmierzy tylko to, że model umie ją powtórzyć.</p>
</div>`
    : `<ol style="margin:0; padding-left:1.4rem">${
      stan.prompty.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ol>`

  return szkielet({ tytul: `Widoczność w AI · ${stan.siteUri}`, aktywne: 'strony' }, `
<p><a href="/strona/${id}">← ${escapeHtml(stan.siteUri)}</a></p>
<h1>Widoczność w AI</h1>
<p class="wiodacy">Ile razy modele wymieniają Twoją markę, gdy klient pyta
o Twoją usługę. Każda liczba wraca z przedziałem ufności, bo pojedynczy przebieg
promptu to próba losowa, a nie pomiar.</p>

${stan.komunikat === null ? '' : `<div class="karta" style="margin-bottom:1.25rem">
  <p>${plakietka('zapisane', 'dobra')} ${escapeHtml(stan.komunikat)}</p>
</div>`}

<div class="siatka siatka-3">
  ${kafel('Prompty', String(stan.prompty.length), stan.zamrozony ? 'zestaw zamrożony' : 'w zestawie')}
  ${kafel('Marki śledzone', String((stan.wlasna === null ? 0 : 1) + stan.konkurenci.length), 'twoja i konkurenci')}
  ${kafel('Silniki gotowe', `${gotowe.length}/${stan.silniki.length}`, '', gotowe.length === 0 ? 'alarm' : 'ok')}
</div>

<h2>Czy można mierzyć</h2>
<div class="karta">
${gotowoscTresc}
</div>

<h2>1. Twoja marka</h2>
<div class="karta">
  ${stan.wlasna === null
    ? '<p class="podpowiedz">Jeszcze nie ustawiona.</p>'
    : `<ul class="czysta">${listaEncji(stan.wlasna)}</ul>`}
  <form class="pole-pod" method="post" action="/geo/${id}/encja" style="margin-top:1rem">
    <div class="pole">
      <label for="name">Nazwa marki</label>
      <input type="text" id="name" name="name" required maxlength="120"
             placeholder="Mentiometry"
             value="${escapeHtml(stan.wlasna?.name ?? '')}">
    </div>
    <div class="pole">
      <label for="variants">Warianty pisowni, po przecinku</label>
      <input type="text" id="variants" name="variants" maxlength="400"
             placeholder="mentiometry, Mentiometry.com"
             value="${escapeHtml(stan.wlasna?.variants.join(', ') ?? '')}">
    </div>
    <div class="pole">
      <label for="exclusions">Wyklucz, gdy w odpowiedzi jest, po przecinku</label>
      <input type="text" id="exclusions" name="exclusions" maxlength="400"
             placeholder="Mentimeter"
             value="${escapeHtml(stan.wlasna?.exclusions.join(', ') ?? '')}">
    </div>
    <input type="hidden" name="wlasna" value="1">
    <button type="submit">Zapisz markę</button>
  </form>
  <p class="nota">Zmiana wariantów zakłada <strong>nową wersję</strong>, nie nadpisuje
  starej. Bez tego nie dałoby się odtworzyć, jak liczyliśmy wzmianki w poprzednich
  tygodniach — a porównanie między różnymi wersjami definicji kończy się odmową (D29).</p>
</div>

<h2>2. Konkurenci</h2>
<div class="karta">
  ${stan.konkurenci.length === 0
    ? '<p class="podpowiedz">Bez konkurentów policzymy tylko Twoją widoczność, bez udziału w głosie.</p>'
    : `<ul class="czysta">${stan.konkurenci.map(listaEncji).join('')}</ul>`}
  <form class="pole-obok" method="post" action="/geo/${id}/encja" style="margin-top:1rem">
    <div class="pole">
      <label for="k-name">Nazwa konkurenta</label>
      <input type="text" id="k-name" name="name" required maxlength="120">
    </div>
    <div class="pole">
      <label for="k-variants">Warianty, po przecinku</label>
      <input type="text" id="k-variants" name="variants" maxlength="400">
    </div>
    <button class="przycisk cichy" type="submit">Dodaj</button>
  </form>
</div>

<h2>3. Prompty${stan.zestawNazwa === null ? '' : ` · ${escapeHtml(stan.zestawNazwa)} v${stan.zestawWersja}`}</h2>
<div class="karta">
  ${promptyLista}
  <form class="pole-pod" method="post" action="/geo/${id}/prompty" style="margin-top:1rem">
    <div class="pole">
      <label for="prompty">Dodaj pytania — jedno na linię</label>
      <textarea id="prompty" name="prompty" rows="4"
                placeholder="${escapeHtml(PRZYKLADOWE_PROMPTY.join('\n'))}"></textarea>
    </div>
    <button type="submit">Dodaj prompty</button>
  </form>
  ${stan.zamrozony ? `<p class="nota">Ten zestaw jest zamrożony. Dodanie promptu
  założy <strong>nową wersję</strong> zestawu — porównanie między różnymi składami
  promptów jest odmawiane, a nie liczone po cichu (D25).</p>` : ''}
</div>

<h2>4. Silniki</h2>
<ul class="czysta">${silniki}</ul>
<p class="nota">Groq daje 14 400 żądań dziennie za darmo — na tygodniowy pomiar
z zapasem. Ustaw klucz w terminalu: <code>export SEO_GROQ_KEY=…</code>,
potem uruchom panel ponownie. Silnik bez klucza jest pomijany
<strong>z podaniem powodu</strong>, nigdy po cichu.</p>

<h2>Przebiegi</h2>
${przebiegi}

<p class="nota">Porównujemy wyłącznie w obrębie tej samej trójki: silnik, wersja
modelu, tryb dostępu (D27). Ta sama liczba z dwóch różnych modeli to dwie różne
rzeczy, więc różnica między nimi nie mierzy nic.</p>
`)
}

export interface LlmsStan {
  readonly siteId: string
  readonly siteUri: string
  readonly tresc: string
  readonly pages: number
  readonly skippedPages: number
}

/**
 * Podglad `llms.txt` (D31).
 *
 * Zrodlem jest **zapisany crawl**, a nie nowe pobranie: strony, ktore juz znamy,
 * maja tytul, opis i informacje o indeksowalnosci. Drugie przejscie po witrynie
 * tylko po to, zeby zlozyc plik, byloby ruchem sieciowym bez nowej informacji.
 */
export function stronaLlmsTxt(stan: LlmsStan): string {
  const id = encodeURIComponent(stan.siteId)
  return szkielet({ tytul: `llms.txt · ${stan.siteUri}`, aktywne: 'strony' }, `
<p><a href="/strona/${id}">← ${escapeHtml(stan.siteUri)}</a></p>
<h1>llms.txt</h1>
<p class="wiodacy">Spis treści witryny dla modeli językowych: adres, tytuł i opis
każdej strony, którą warto czytać. Złożony z zapisanego crawla — bez ani jednego
nowego żądania do Twojego serwera.</p>

<div class="siatka siatka-3">
  ${kafel('Strony w pliku', String(stan.pages), 'HTTP 200 i indeksowalne')}
  ${kafel('Pominięte', String(stan.skippedPages), 'błąd, przekierowanie albo noindex')}
  ${kafel('Rozmiar', `${(stan.tresc.length / 1024).toFixed(1)} kB`)}
</div>

<h2>Co dalej</h2>
<div class="karta">
  <p class="podpowiedz">Zapisz plik i wgraj go pod adres
  <code>${escapeHtml(new URL('/llms.txt', stan.siteUri.replace(/^sc-domain:/, 'https://')).toString())}</code>.
  To propozycja standardu, a nie obowiązek — żaden silnik nie karze za jego brak,
  ale kilka już go czyta.</p>
  <p style="margin-top:.8rem">
    <a class="przycisk" href="/llms-txt/${id}?format=txt" download="llms.txt">Pobierz plik</a>
  </p>
</div>

<h2>Zawartość</h2>
<div class="karta">
  <pre class="zrzut">${escapeHtml(stan.tresc)}</pre>
</div>
`)
}
