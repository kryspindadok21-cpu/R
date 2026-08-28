import { describe, expect, it } from 'vitest'
import { readPageFixture } from './fixtures.test-helper.js'
import { parsePage } from './parse.js'

const BASE = 'https://przyklad.test/audyt-techniczny'

function factsFor(fixture: string, url = BASE) {
  return parsePage(readPageFixture(fixture), { url })
}

describe('parsePage — strona poprawna', () => {
  const facts = factsFor('dobra-strona.html')

  it('wydobywa tytul i jego dlugosc', () => {
    expect(facts.title).toBe('Audyt techniczny strony — jak go zrobić samemu')
    expect(facts.titleLength).toBe(facts.title?.length)
    expect(facts.titleCount).toBe(1)
  })

  it('wydobywa opis, jezyk, kodowanie i viewport', () => {
    expect(facts.metaDescription).toContain('Przewodnik po audycie technicznym')
    expect(facts.lang).toBe('pl')
    expect(facts.charset).toBe('utf-8')
    expect(facts.viewport).toBe('width=device-width, initial-scale=1')
  })

  it('rozwiazuje canonical do adresu bezwzglednego', () => {
    expect(facts.canonicalRaw).toBe('https://przyklad.test/audyt-techniczny')
    expect(facts.canonicalResolved).toBe('https://przyklad.test/audyt-techniczny')
  })

  it('nie zglasza dyrektyw robots, ktorych nie ma', () => {
    expect(facts.metaRobots.raw).toBeNull()
    expect(facts.metaRobots.noindex).toBe(false)
    expect(facts.metaRobots.nofollow).toBe(false)
  })

  it('zbiera naglowki w kolejnosci dokumentu, bez przeskokow', () => {
    expect(facts.headings.map((h) => h.level)).toEqual([1, 2, 2, 3])
    expect(facts.h1Count).toBe(1)
    expect(facts.h1Texts).toEqual(['Audyt techniczny strony'])
    expect(facts.headingOrderJumps).toEqual([])
  })

  it('bierze pierwszy akapit po H1 jako material na odpowiedz wprost', () => {
    expect(facts.firstParagraphAfterH1).toMatch(/^Audyt techniczny to lista konkretnych usterek/)
  })

  it('rozroznia linki wewnetrzne od zewnetrznych i czyta rel', () => {
    const byHref = new Map(facts.links.map((l) => [l.href, l]))
    expect(byHref.get('/')?.isInternal).toBe(true)
    expect(byHref.get('/kontakt')?.rel).toBe('nofollow')
    expect(byHref.get('https://zewnetrzna.test/artykul')?.isInternal).toBe(false)
    expect(byHref.get('/blog')?.resolved).toBe('https://przyklad.test/blog')
  })

  it('czyta obrazy razem z wymiarami i opisem', () => {
    expect(facts.images).toHaveLength(1)
    const image = facts.images[0]
    expect(image?.hasAlt).toBe(true)
    expect(image?.alt).toBe('Schemat kolejności sprawdzeń w audycie')
    expect(image?.width).toBe('800')
    expect(image?.resolved).toBe('https://przyklad.test/obrazy/schemat.png')
  })

  it('parsuje JSON-LD i wyciaga typy', () => {
    expect(facts.jsonLd).toHaveLength(1)
    expect(facts.jsonLd[0]?.parseError).toBeNull()
    expect(facts.jsonLd[0]?.types).toEqual(['Article', 'Person'])
  })

  it('zbiera OpenGraph, Twitter i hreflang', () => {
    expect(facts.openGraph['og:title']).toBe('Audyt techniczny strony')
    expect(facts.twitterCard['twitter:card']).toBe('summary_large_image')
    expect(facts.hreflang.map((h) => h.lang)).toEqual(['en', 'pl'])
  })

  it('liczy tekst widoczny, pomijajac znaczniki niewidoczne', () => {
    expect(facts.wordCount).toBeGreaterThan(80)
    expect(facts.text).not.toContain('schema.org')
    expect(facts.textToHtmlRatio).toBeGreaterThan(0)
    expect(facts.textToHtmlRatio).toBeLessThan(1)
  })
})

describe('parsePage — strona wadliwa', () => {
  const facts = factsFor('bez-tytulu.html', 'https://przyklad.test/wadliwa')

  it('brak tytulu to null, nie pusty tekst', () => {
    expect(facts.title).toBeNull()
    expect(facts.titleLength).toBe(0)
    expect(facts.titleCount).toBe(0)
  })

  it('rozklada meta robots na dyrektywy', () => {
    expect(facts.metaRobots.noindex).toBe(true)
    expect(facts.metaRobots.nofollow).toBe(true)
    expect(facts.metaRobots.noarchive).toBe(false)
  })

  it('brak H1 i przeskok poziomow sa widoczne w faktach', () => {
    expect(facts.h1Count).toBe(0)
    expect(facts.firstParagraphAfterH1).toBeNull()
  })

  it('obraz bez atrybutu alt rozni sie od obrazu z pustym alt', () => {
    expect(facts.images[0]?.hasAlt).toBe(false)
    expect(facts.images[0]?.alt).toBe('')
  })

  it('pusty href nie daje adresu, pusta kotwica daje pusty tekst', () => {
    const empty = facts.links.find((l) => l.href === '')
    expect(empty?.resolved).toBeNull()
    const blank = facts.links.find((l) => l.href === '/cel')
    expect(blank?.anchorText).toBe('')
  })

  it('zepsuty JSON-LD to fakt z trescia bledu, nie wyjatek', () => {
    expect(facts.jsonLd).toHaveLength(1)
    expect(facts.jsonLd[0]?.parsed).toBeNull()
    expect(facts.jsonLd[0]?.parseError).toBeTruthy()
    expect(facts.jsonLd[0]?.types).toEqual([])
  })
})

describe('parsePage — odpornosc', () => {
  it('zepsuty HTML nie wywala parsera i nadal oddaje tytul', () => {
    const facts = factsFor('zepsuty-html.html', 'https://przyklad.test/zepsuta')
    expect(facts.title).toContain('Tytuł mimo bałaganu')
    expect(facts.links[0]?.resolved).toBe('https://przyklad.test/cel-bez-cudzyslowow')
    expect(facts.images[0]?.alt).toBe('Opis')
  })

  it('dwa H1 i przeskok poziomow sa policzone', () => {
    const facts = factsFor('dwa-h1.html', 'https://przyklad.test/dwa')
    expect(facts.h1Count).toBe(2)
    expect(facts.headingOrderJumps).toEqual([{ from: 1, to: 4 }])
  })

  it('strona zlozona z samego JS ma znikoma tresc i obecny noscript', () => {
    const facts = factsFor('csr-pusty.html', 'https://przyklad.test/sklep')
    expect(facts.wordCount).toBe(0)
    expect(facts.hasNoscript).toBe(true)
    expect(facts.scriptCount).toBe(1)
  })

  it('adresy nienawigacyjne nie trafiaja do grafu linkow', () => {
    const html = '<a href="mailto:a@b.test">Mail</a><a href="javascript:void(0)">JS</a><a href="/ok">OK</a>'
    const facts = parsePage(html, { url: 'https://przyklad.test/' })
    expect(facts.links.filter((l) => l.resolved !== null)).toHaveLength(1)
  })

  it('zbiera zasoby strony razem z ich rodzajem', () => {
    const html = '<html><head><link rel="stylesheet" href="/s.css">'
      + '<script src="http://przyklad.test/a.js"></script></head>'
      + '<body><img src="/i.png" alt="x"><iframe src="/ramka"></iframe>'
      + '<video src="/f.mp4"></video></body></html>'
    const facts = parsePage(html, { url: 'https://przyklad.test/' })

    expect(facts.resources.map((r) => r.kind).sort())
      .toEqual(['iframe', 'image', 'media', 'script', 'stylesheet'])
    expect(facts.resources.find((r) => r.kind === 'script')?.resolved)
      .toBe('http://przyklad.test/a.js')
  })

  it('liczy canonicale, bo dwa znaczą, że Google zignoruje oba', () => {
    const html = '<html><head><link rel="canonical" href="/a">'
      + '<link rel="canonical" href="/b"></head><body></body></html>'
    const facts = parsePage(html, { url: 'https://przyklad.test/' })

    expect(facts.canonicalCount).toBe(2)
    expect(facts.canonicalResolved).toBe('https://przyklad.test/a')
  })

  it('czyta meta refresh — przekierowanie, którego nie widać w HTTP', () => {
    const html = '<html><head><meta http-equiv="refresh" content="0;url=/gdzie-indziej">'
      + '</head><body></body></html>'
    expect(parsePage(html, { url: 'https://przyklad.test/' }).metaRefresh)
      .toBe('0;url=/gdzie-indziej')
  })

  it('strona bez meta refresh ma tam null', () => {
    expect(parsePage('<html><body>x</body></html>', { url: 'https://przyklad.test/' }).metaRefresh)
      .toBeNull()
  })

  it('fragment odpada z adresu — kotwica to ta sama strona', () => {
    const facts = parsePage('<a href="/cel#sekcja">X</a>', { url: 'https://przyklad.test/' })
    expect(facts.links[0]?.resolved).toBe('https://przyklad.test/cel')
  })
})
