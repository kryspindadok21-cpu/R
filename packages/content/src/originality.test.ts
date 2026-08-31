import { describe, expect, it } from 'vitest'
import {
  MIN_SHINGLES, ORIGINALITY_THRESHOLD, checkOriginality, shingles, tokenize,
} from './originality.js'

const ORYGINAL = `
Zmierzyliśmy widoczność marki w odpowiedziach trzech modeli językowych przez
sześć tygodni. Wynik zaskoczył nas w jednym miejscu: model z dostępem do
wyszukiwarki wymieniał nas o jedenaście punktów procentowych częściej niż ten
sam model odpowiadający z pamięci. Różnica utrzymała się w każdym tygodniu
pomiaru i nie dało się jej wytłumaczyć zmianą treści na stronie, bo strona
w tym czasie nie była ruszana. To jest obserwacja, której nie znaleźliśmy
w żadnym opracowaniu branżowym, więc opisujemy metodę razem z surowymi danymi.
`

const INNY_TEMAT = `
Kwas foliowy w diecie kobiet w ciąży jest przedmiotem badań od lat
siedemdziesiątych. Zalecana dzienna dawka wynosi czterysta mikrogramów
i powinna być przyjmowana już na etapie planowania ciąży, ponieważ cewa
nerwowa zamyka się w czwartym tygodniu, zanim wiele kobiet w ogóle wie,
że jest w ciąży. Suplementacja rozpoczęta później nie daje tego efektu.
`

describe('tokenize', () => {
  it('nie rozbija polskich slow na kawalki', () => {
    // `\\w` z JavaScriptu zna tylko ASCII i zrobilby z tego trzy tokeny.
    expect(tokenize('właściwość')).toEqual(['właściwość'])
    expect(tokenize('Żółw zjadł ćwierć')).toEqual(['żółw', 'zjadł', 'ćwierć'])
  })

  it('gubi interpunkcje, zachowuje liczby', () => {
    expect(tokenize('Wynik: 11,3% — sprawdzone!')).toEqual(['wynik', '11', '3', 'sprawdzone'])
  })
})

describe('shingles', () => {
  it('sklada n-gramy przesuwane o jeden token', () => {
    expect(shingles(['a', 'b', 'c', 'd'], 3)).toEqual(['a b c', 'b c d'])
  })

  it('tekst krotszy niz n-gram nie daje zadnego', () => {
    expect(shingles(['a', 'b'], 3)).toEqual([])
  })
})

describe('checkOriginality', () => {
  it('tekst identyczny jest odrzucany', () => {
    const wynik = checkOriginality(ORYGINAL, [{ id: 'top10-1', text: ORYGINAL }])
    expect(wynik.passed).toBe(false)
    expect(wynik.closest?.similarity).toBeCloseTo(1, 6)
    expect(wynik.closest?.documentId).toBe('top10-1')
  })

  it('tekst o zupelnie innym temacie przechodzi', () => {
    const wynik = checkOriginality(ORYGINAL, [{ id: 'obcy', text: INNY_TEMAT }])
    expect(wynik.passed).toBe(true)
    expect(wynik.closest?.similarity).toBeLessThan(0.1)
  })

  it('przepisanie z podmienionymi slowami nadal jest lapane', () => {
    const przepisane = ORYGINAL
      .replace('zaskoczył', 'zdziwił')
      .replace('opracowaniu', 'raporcie')
    const wynik = checkOriginality(ORYGINAL, [{ id: 'zrodlo', text: przepisane }])
    expect(wynik.passed).toBe(false)
    expect(wynik.closest?.similarity).toBeGreaterThan(ORIGINALITY_THRESHOLD)
  })

  it('podaje pokrywajace sie fragmenty jako dowod, nie sama liczbe', () => {
    const wynik = checkOriginality(ORYGINAL, [{ id: 'zrodlo', text: ORYGINAL }])
    expect(wynik.closest?.overlapping.length).toBeGreaterThan(0)
    expect(wynik.closest?.overlapping[0]?.split(' ')).toHaveLength(3)
  })

  it('wybiera najbardziej podobny dokument z wielu', () => {
    const wynik = checkOriginality(ORYGINAL, [
      { id: 'obcy', text: INNY_TEMAT },
      { id: 'kopia', text: ORYGINAL },
      { id: 'obcy-2', text: INNY_TEMAT },
    ])
    expect(wynik.closest?.documentId).toBe('kopia')
  })

  it('pusty zestaw porownawczy NIE znaczy „przeszlo"', () => {
    // Cicha zgoda przy braku danych jest dokladnie tym mechanizmem, ktory
    // ta bramka ma zablokowac.
    const wynik = checkOriginality(ORYGINAL, [])
    expect(wynik.passed).toBe(false)
    expect(wynik.undecidable).toContain('pusty zestaw')
    expect(wynik.closest).toBeNull()
  })

  it('tekst za krotki, zeby ocenic, nie przechodzi po cichu', () => {
    const wynik = checkOriginality('Trzy slowa tutaj.', [{ id: 'x', text: ORYGINAL }])
    expect(wynik.passed).toBe(false)
    expect(wynik.undecidable).toContain(`${MIN_SHINGLES}`)
  })

  it('dokumenty zbyt krotkie do porownania sa pomijane, a nie liczone jako zero', () => {
    const wynik = checkOriginality(ORYGINAL, [
      { id: 'pusty', text: '' },
      { id: 'kopia', text: ORYGINAL },
    ])
    expect(wynik.undecidable).toBeNull()
    expect(wynik.closest?.documentId).toBe('kopia')
  })

  it('sam pusty korpus po odfiltrowaniu jest nieorzekalny', () => {
    const wynik = checkOriginality(ORYGINAL, [{ id: 'pusty', text: '   ' }])
    expect(wynik.passed).toBe(false)
    expect(wynik.undecidable).toContain('pusty zestaw')
  })

  it('prog da sie podniesc, ale domyslny jest ten z analizy', () => {
    const luzny = checkOriginality(ORYGINAL, [{ id: 'kopia', text: ORYGINAL }], 1.01)
    expect(luzny.passed).toBe(true)
    expect(checkOriginality(ORYGINAL, [{ id: 'x', text: INNY_TEMAT }]).threshold)
      .toBe(ORIGINALITY_THRESHOLD)
  })

  it('powtarzajaca sie stopka nie napompuje podobienstwa', () => {
    // IDF liczone na calym korpusie zbija wage termow obecnych wszedzie.
    const stopka = ' Wszystkie prawa zastrzezone. Polityka prywatnosci. Kontakt z nami. '
    const wynik = checkOriginality(ORYGINAL + stopka, [
      { id: 'a', text: INNY_TEMAT + stopka },
      { id: 'b', text: INNY_TEMAT + stopka },
      { id: 'c', text: INNY_TEMAT + stopka },
    ])
    expect(wynik.passed).toBe(true)
  })
})
