import { fold } from './skills-pick.js'

/**
 * Opisy umiejetnosci sa po angielsku, a zadania przychodza po polsku —
 * bez tego mostka dopasowanie po slowach nie ma czego trafic. To slownik
 * pojec dziedzinowych, nie tlumacz: ma pokryc slownictwo SEO i wytwarzania
 * oprogramowania, ktore faktycznie pada w zadaniach.
 *
 * Klucze podawane bez ogonkow, bo porownanie idzie po tekscie zlozonym.
 * Rdzenie zamiast pelnych form, zeby zlapac odmiane przez przypadki.
 */
const SLOWNIK: readonly (readonly [string, string])[] = [
  // frazy — sprawdzane przed pojedynczymi slowami
  ['dane strukturaln', 'structured data schema markup'],
  ['dlugi ogon', 'long tail keywords'],
  ['dlugiego ogona', 'long tail keywords'],
  ['core web vitals', 'core web vitals page speed'],
  ['szybkosc strony', 'page speed core web vitals'],
  ['mapa strony', 'sitemap'],
  ['linkowanie wewnetrzn', 'internal links site architecture'],
  ['architektura serwisu', 'site architecture navigation'],
  ['badanie slow kluczowych', 'keyword research'],
  ['slowa kluczow', 'keywords'],
  ['slow kluczow', 'keywords'],
  ['strategia tresci', 'content strategy'],
  ['plan wykonawcz', 'implementation plan'],
  ['wyniki wyszukiwania', 'search results ranking'],
  ['sztuczna inteligencj', 'ai llm'],
  ['modele jezykow', 'ai llm chatgpt'],
  ['analiza konkurencj', 'competitors analysis'],
  ['scieznka konwersji', 'attribution conversion'],
  ['zrodla ruchu', 'attribution traffic sources'],

  // pojedyncze pojecia
  ['audyt', 'audit'],
  ['indeksowani', 'indexing crawl'],
  ['indeksacj', 'indexing crawl'],
  ['przeszukiwani', 'crawl'],
  ['wyszukiwark', 'search engine google'],
  ['pozycjonowani', 'ranking seo'],
  ['pozycj', 'ranking position'],
  ['ruch', 'traffic clicks'],
  ['klikniec', 'clicks'],
  ['wyswietlen', 'impressions'],
  ['tresc', 'content'],
  ['tresci', 'content'],
  ['artykul', 'content article'],
  ['konkurencj', 'competitors'],
  ['przekierowani', 'redirect'],
  ['naglowk', 'headings meta tags'],
  ['metadan', 'meta tags'],
  ['blad', 'bug error'],
  ['bled', 'bug error'],
  ['awari', 'bug failure'],
  ['debugowa', 'debugging bug'],
  ['zdebugowa', 'debugging bug'],
  ['przyczyn', 'root cause'],
  ['test', 'test'],
  ['wywala', 'failure failing'],
  ['nie dziala', 'failure bug'],
  ['plan', 'plan'],
  ['wykonaj plan', 'executing plans'],
  ['burza mozgow', 'brainstorming'],
  ['pomysl', 'brainstorming idea'],
  ['weryfikacj', 'verification'],
  ['sprawdzeni', 'verification check'],
  ['skalowani', 'programmatic scale'],
  ['szablon', 'template'],
  ['strona', 'page site'],
  ['stron', 'pages site'],
  ['sklep', 'ecommerce store'],
  ['produkt', 'product'],
]

/**
 * Dopisuje do zadania angielskie odpowiedniki rozpoznanych pojec.
 * Oryginal zostaje — polskie slowo nadal moze trafic w polski opis.
 */
export function expandTask(task: string): string {
  const folded = fold(task)
  const added = new Set<string>()
  for (const [pl, en] of SLOWNIK) {
    if (folded.includes(pl)) {
      for (const word of en.split(' ')) added.add(word)
    }
  }
  return added.size === 0 ? task : `${task} ${[...added].join(' ')}`
}
