import { describe, expect, it } from 'vitest'
import {
  CONTROLS_PER_TREATMENT, pageDistance, selectControlGroup, type CandidatePage,
} from './control-group.js'

const strona = (
  url: string, clicks: number, impressions: number, position = 10, clickDepth: number | null = 1,
): CandidatePage => ({ url, before: { clicks, impressions, position }, clickDepth })

describe('pageDistance', () => {
  it('strona jest najblizej samej siebie', () => {
    const a = strona('https://a.test/1', 50, 1000)
    expect(pageDistance(a, a)).toBe(0)
  })

  it('normalizuje ruch logarytmicznie', () => {
    // Ta sama roznica bezwzgledna (90) znaczy wiecej przy malym ruchu.
    const male = pageDistance(strona('a', 0, 10), strona('b', 0, 100))
    const duze = pageDistance(strona('c', 0, 10_000), strona('d', 0, 10_090))
    expect(male).toBeGreaterThan(duze)
  })

  it('rozna glebokosc oddala strony', () => {
    const blisko = pageDistance(strona('a', 10, 100, 10, 1), strona('b', 10, 100, 10, 1))
    const daleko = pageDistance(strona('a', 10, 100, 10, 1), strona('b', 10, 100, 10, 5))
    expect(daleko).toBeGreaterThan(blisko)
  })

  it('nieznana glebokosc kosztuje stala kare, a nie zero', () => {
    const znana = pageDistance(strona('a', 10, 100, 10, 1), strona('b', 10, 100, 10, 1))
    const nieznana = pageDistance(strona('a', 10, 100, 10, null), strona('b', 10, 100, 10, 1))
    expect(nieznana).toBeGreaterThan(znana)
  })
})

describe('selectControlGroup', () => {
  const kandydaci = Array.from({ length: 30 }, (_, i) =>
    strona(`https://a.test/k${i}`, 10 + i, 100 + i * 10, 10 + (i % 7)))

  it('dobiera po podobienstwie okresu przed', () => {
    const treatment = [strona('https://a.test/t0', 15, 150, 11)]
    const wynik = selectControlGroup(treatment, kandydaci, { now: () => 1000 })

    expect(wynik.control).toHaveLength(CONTROLS_PER_TREATMENT)
    expect(wynik.selectedAt).toBe(1000)
    expect(wynik.shortfall).toBeNull()
    // Najblizszy kandydat ma podobny ruch, a nie przypadkowy.
    expect(wynik.control[0]?.distance).toBeLessThan(wynik.control[3]?.distance ?? 0 + 1)
  })

  it('D49: strona zmieniona nigdy nie trafia do wlasnej kontroli', () => {
    const wspolna = strona('https://a.test/k5', 15, 150)
    const wynik = selectControlGroup([wspolna], kandydaci)
    expect(wynik.control.map((c) => c.url)).not.toContain('https://a.test/k5')
  })

  it('ta sama strona nie liczy sie jako kontrola dwa razy', () => {
    // Powtorzenie zawyzaloby liczebnosc grupy, a wiec i precyzje przedzialu.
    const treatment = [
      strona('https://a.test/t0', 15, 150),
      strona('https://a.test/t1', 15, 150),
    ]
    const wynik = selectControlGroup(treatment, kandydaci)
    expect(new Set(wynik.control.map((c) => c.url)).size).toBe(wynik.control.length)
  })

  it('pierwsza strona zmieniona nie zabiera wszystkich dobrych kandydatow', () => {
    const treatment = [
      strona('https://a.test/t0', 15, 150),
      strona('https://a.test/t1', 300, 5000, 3),
    ]
    const wynik = selectControlGroup(treatment, kandydaci, { perTreatment: 2 })
    expect(wynik.control).toHaveLength(4)
    // Kazda zmieniona strona ma kontrole dobrana wlasnie do niej.
    const uzasadnienia = wynik.control.map((c) => c.basis).join(' ')
    expect(uzasadnienia).toContain('t0')
    expect(uzasadnienia).toContain('t1')
  })

  it('brak kandydatow melduje sie wprost, a nie cicha mala grupa', () => {
    const wynik = selectControlGroup([strona('https://a.test/t0', 10, 100)], [
      strona('https://a.test/k0', 10, 100),
      strona('https://a.test/k1', 10, 100),
    ])
    expect(wynik.control).toHaveLength(2)
    expect(wynik.shortfall).toContain('wybrano 2 stron kontrolnych z potrzebnych 4')
  })

  it('brak jakichkolwiek kandydatow nie wybucha', () => {
    const wynik = selectControlGroup([strona('https://a.test/t0', 10, 100)], [])
    expect(wynik.control).toEqual([])
    expect(wynik.shortfall).toContain('0 kandydatow')
  })

  it('wynik jest powtarzalny — dobor nie zalezy od kolejnosci wejscia', () => {
    const treatment = [strona('https://a.test/t0', 15, 150)]
    const a = selectControlGroup(treatment, kandydaci, { now: () => 1 })
    const b = selectControlGroup(treatment, [...kandydaci].reverse(), { now: () => 1 })
    expect(b.control.map((c) => c.url)).toEqual(a.control.map((c) => c.url))
  })

  it('zapisuje adresy grupy zmienionej razem z wyborem', () => {
    const wynik = selectControlGroup([
      strona('https://a.test/t0', 10, 100), strona('https://a.test/t1', 10, 100),
    ], kandydaci)
    expect(wynik.treatmentUrls).toEqual(['https://a.test/t0', 'https://a.test/t1'])
  })
})
