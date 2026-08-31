import { describe, expect, it } from 'vitest'
import {
  MIN_CONTROL_PAGES, differenceInDifferences, lowerIsBetter, verdictSentence,
  type PageObservation, type WindowStats,
} from './did.js'

const okno = (clicks: number, impressions: number, position = 10): WindowStats =>
  ({ clicks, impressions, position })

const strona = (
  url: string, before: WindowStats, after: WindowStats,
): PageObservation => ({ url, before, after })

/**
 * Deterministyczny rozrzut miedzy stronami.
 *
 * Fikstury bez rozrzutu daja bootstrapowi przedzial punktowy, wiec bramka
 * `hasSpread` slusznie odmawia orzekania. Prawdziwe strony zawsze roznia sie
 * miedzy soba i fikstura, ktora tego nie oddaje, testuje sytuacje, ktora nie
 * wystepuje.
 */
const jitter = (i: number, skala: number): number => ((i * 7) % 11) - 5 + (i % 3) * skala

/**
 * Wzorce o **sumie zero** — rozrzut *zmiany* jest prawdziwy, ale srednia zostaje
 * dokladna, wiec test moze sprawdzac efekt co do dziesiatego miejsca po przecinku.
 *
 * Rozrzut musi siedziec w **zmianie**, a nie w poziomie. Fikstura, w ktorej kazda
 * strona rosnie o dokladnie tyle samo, daje bootstrapowi przedzial punktowy —
 * i bramka slusznie odmawia orzekania, choc test spodziewa sie werdyktu.
 */
const ROZRZUT_KONTROLI = [-4, -1, 1, 4] as const
const ROZRZUT_ZMIENIONYCH = [-6, -2, 2, 6] as const

/** Grupa kontrolna rosnaca srednio o `wzrost` klikniec na strone. */
function kontrola(n: number, wzrost: number, bazowe = 100): PageObservation[] {
  return Array.from({ length: n }, (_, i) =>
    strona(
      `https://a.test/k${i}`,
      okno(bazowe + jitter(i, 1), 1000),
      okno(bazowe + jitter(i, 1) + wzrost + (ROZRZUT_KONTROLI[i % 4] as number), 1000),
    ))
}

/** Grupa zmieniona rosnaca srednio o `wzrost`, z wlasnym rozrzutem zmiany. */
function zmienione(n: number, wzrost: number, bazowe = 100): PageObservation[] {
  return Array.from({ length: n }, (_, i) =>
    strona(
      `https://a.test/t${i}`,
      okno(bazowe + jitter(i, 2), 1000),
      okno(bazowe + jitter(i, 2) + wzrost + (ROZRZUT_ZMIENIONYCH[i % 4] as number), 1000),
    ))
}

const OPCJE = { metric: 'clicks' as const, windowDays: 30, seed: 7, resamples: 2000 }

describe('lowerIsBetter', () => {
  it('tylko pozycja jest metryka, w ktorej mniej znaczy lepiej', () => {
    expect(lowerIsBetter('position')).toBe(true)
    for (const m of ['clicks', 'impressions', 'ctr'] as const) {
      expect(lowerIsBetter(m)).toBe(false)
    }
  })
})

describe('differenceInDifferences', () => {
  it('odejmuje trend wspolny — sam core update nie jest efektem', () => {
    // Wszystko urosło o 50: i zmienione, i kontrolne. Efekt = 0.
    const treatment = Array.from({ length: 6 }, (_, i) =>
      strona(`https://a.test/t${i}`, okno(100, 1000), okno(150, 1000)))
    const wynik = differenceInDifferences(treatment, kontrola(20, 50), OPCJE)

    expect(wynik.kind).toBe('werdykt')
    if (wynik.kind !== 'werdykt') return
    expect(wynik.effect).toBeCloseTo(0, 10)
    expect(wynik.significant).toBe(false)
    expect(wynik.direction).toBeNull()
  })

  it('lapie efekt ponad trend wspolny', () => {
    // Kontrolne +50, zmienione +90. Efekt = +40 klikniec na strone.
    const wynik = differenceInDifferences(zmienione(8, 90), kontrola(20, 50), OPCJE)

    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.effect).toBeCloseTo(40, 10)
    expect(wynik.significant).toBe(true)
    expect(wynik.direction).toBe('poprawa')
  })

  it('naiwne przed/po dalo by tu falszywy sukces', () => {
    // Zmienione urosly o 90 — samo „przed/po" krzyczy +90%. Ale kontrolne
    // urosly o 95, wiec nasza zmiana faktycznie **zaszkodzila**.
    const wynik = differenceInDifferences(zmienione(8, 90), kontrola(20, 95), OPCJE)

    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.levels.treatmentAfter - wynik.levels.treatmentBefore).toBeCloseTo(90, 10)
    expect(wynik.effect).toBeCloseTo(-5, 10)
    expect(wynik.direction).toBe('pogorszenie')
  })

  it('D48: za mala grupa kontrolna to odmowa, a nie zejscie do przed/po', () => {
    const treatment = [strona('https://a.test/t0', okno(100, 1000), okno(200, 1000))]
    const wynik = differenceInDifferences(treatment, kontrola(2, 0), OPCJE)

    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('za-mala-kontrola')
    expect(wynik.detail).toContain(`brakuje ${MIN_CONTROL_PAGES - 2}`)
    expect(wynik.detail).toContain('core update')
  })

  it('D48: pusta grupa zmieniona tez jest odmowa', () => {
    const wynik = differenceInDifferences([], kontrola(20, 0), OPCJE)
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('za-malo-zmienionych')
  })

  it('prog kontroli da sie zmienic, gdy ktos wie, co robi', () => {
    const treatment = [strona('https://a.test/t0', okno(100, 1000), okno(200, 1000))]
    const wynik = differenceInDifferences(treatment, kontrola(2, 0), {
      ...OPCJE, minControlPages: 2,
    })
    expect(wynik.kind).toBe('werdykt')
  })

  it('licznik liczy sie na strone, nie sumarycznie', () => {
    // Grupy roznych rozmiarow: 4 strony kontra 20. Suma dalaby zmiany rozniace
    // sie o rzad wielkosci i „efekt" mowilby o licznosci grup, a nie o zmianie.
    const treatment = Array.from({ length: 4 }, (_, i) =>
      strona(
        `https://a.test/t${i}`,
        okno(100, 1000),
        okno(100 + 40 + (ROZRZUT_ZMIENIONYCH[i % 4] as number), 1000),
      ))
    const wynik = differenceInDifferences(treatment, kontrola(20, 40), OPCJE)

    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.levels.treatmentBefore).toBe(100)
    expect(wynik.levels.treatmentAfter - wynik.levels.treatmentBefore).toBeCloseTo(40, 10)
    expect(wynik.levels.controlAfter - wynik.levels.controlBefore).toBeCloseTo(40, 10)
    expect(wynik.effect).toBeCloseTo(0, 10)
  })

  it('CTR liczy sie na sumach, wiec strona z dwoma wyswietleniami nie wazy tyle samo', () => {
    const treatment = [
      strona('https://a.test/duza', okno(100, 10_000), okno(200, 10_000)),
      strona('https://a.test/mala', okno(1, 2), okno(2, 2)),
    ]
    const wynik = differenceInDifferences(treatment, kontrola(10, 0), {
      ...OPCJE, metric: 'ctr',
    })
    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    // (100+1)/10002 ≈ 0,0101 → (200+2)/10002 ≈ 0,0202. Srednia z CTR-ow stron
    // dalaby ~0,26, bo mala strona ma CTR 50%.
    expect(wynik.levels.treatmentBefore).toBeCloseTo(101 / 10_002, 6)
    expect(wynik.levels.treatmentAfter).toBeCloseTo(202 / 10_002, 6)
  })

  it('pozycja wazy sie wyswietleniami', () => {
    const treatment = [
      strona('https://a.test/duza', okno(0, 1000, 5), okno(0, 1000, 5)),
      strona('https://a.test/mala', okno(0, 1, 90), okno(0, 1, 90)),
    ]
    const wynik = differenceInDifferences(treatment, kontrola(10, 0), {
      ...OPCJE, metric: 'position',
    })
    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    // Srednia arytmetyczna dalaby 47,5. Wazona daje ~5,08.
    expect(wynik.levels.treatmentBefore).toBeCloseTo((5 * 1000 + 90) / 1001, 6)
  })

  it('spadek pozycji to POPRAWA, bo nizej znaczy lepiej', () => {
    const treatment = Array.from({ length: 8 }, (_, i) =>
      strona(
        `https://a.test/t${i}`,
        okno(10, 1000, 20 + (i % 4)),
        okno(10, 1000, 20 + (i % 4) - 12 + (ROZRZUT_ZMIENIONYCH[i % 4] as number) / 4),
      ))
    const control = Array.from({ length: 20 }, (_, i) =>
      strona(
        `https://a.test/k${i}`,
        okno(10, 1000, 20 + (i % 4)),
        okno(10, 1000, 20 + (i % 4) + (ROZRZUT_KONTROLI[i % 4] as number) / 4),
      ))
    const wynik = differenceInDifferences(treatment, control, { ...OPCJE, metric: 'position' })

    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.effect).toBeCloseTo(-12, 6)
    expect(wynik.significant).toBe(true)
    expect(wynik.direction).toBe('poprawa')
  })

  it('metryka na wyswietleniach przy zerowych wyswietleniach jest odmawiana', () => {
    const puste = Array.from({ length: 20 }, (_, i) =>
      strona(`https://a.test/${i}`, okno(0, 0), okno(0, 0)))
    const wynik = differenceInDifferences(puste.slice(0, 5), puste, { ...OPCJE, metric: 'ctr' })
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('brak-wyswietlen')
  })

  it('to samo ziarno daje identyczny przedzial', () => {
    const treatment = Array.from({ length: 8 }, (_, i) =>
      strona(`https://a.test/t${i}`, okno(100 + i, 1000), okno(150 + i * 2, 1000)))
    const control = kontrola(20, 40)
    const a = differenceInDifferences(treatment, control, OPCJE)
    const b = differenceInDifferences(treatment, control, OPCJE)
    expect(b).toEqual(a)
  })

  it('inne ziarno daje inny przedzial, ale ten sam efekt', () => {
    const treatment = Array.from({ length: 8 }, (_, i) =>
      strona(`https://a.test/t${i}`, okno(100 + i * 7, 1000), okno(150 + i * 3, 1000)))
    const control = kontrola(20, 40)
    const a = differenceInDifferences(treatment, control, OPCJE)
    const b = differenceInDifferences(treatment, control, { ...OPCJE, seed: 99 })
    if (a.kind !== 'werdykt' || b.kind !== 'werdykt') throw new Error('werdykty')
    expect(b.effect).toBe(a.effect)
    expect(b.interval).not.toEqual(a.interval)
  })

  it('D51: przedzial obejmujacy zero nie dostaje kierunku', () => {
    // Rozrzut miedzy stronami duzy, srednia lekko dodatnia.
    const treatment = [
      strona('https://a.test/t0', okno(100, 1000), okno(200, 1000)),
      strona('https://a.test/t1', okno(100, 1000), okno(20, 1000)),
      strona('https://a.test/t2', okno(100, 1000), okno(180, 1000)),
      strona('https://a.test/t3', okno(100, 1000), okno(40, 1000)),
      strona('https://a.test/t4', okno(100, 1000), okno(160, 1000)),
      strona('https://a.test/t5', okno(100, 1000), okno(60, 1000)),
    ]
    const wynik = differenceInDifferences(treatment, kontrola(20, 0), OPCJE)
    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.interval.low).toBeLessThan(0)
    expect(wynik.interval.high).toBeGreaterThan(0)
    expect(wynik.significant).toBe(false)
    expect(wynik.direction).toBeNull()
  })

  it('zerowy rozrzut nie udaje pewnosci — takze gdy jest tylko szumem bitowym', () => {
    // Wszystkie zmiany identyczne: bootstrap nie widzi zadnej zmiennosci,
    // wiec przedzial punktowy nie jest dowodem.
    const treatment = Array.from({ length: 8 }, (_, i) =>
      strona(`https://a.test/t${i}`, okno(100, 1000), okno(140, 1000)))
    const control = Array.from({ length: 20 }, (_, i) =>
      strona(`https://a.test/k${i}`, okno(100, 1000), okno(100, 1000)))
    const wynik = differenceInDifferences(treatment, control, OPCJE)
    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.interval.low).toBe(wynik.interval.high)
    expect(wynik.significant).toBe(false)
  })

  it('szum zmiennoprzecinkowy nie przechodzi za zmiennosc', () => {
    // Kazda strona rosnie o dokladnie 90, ale poziomy sa rozne — wiec srednie
    // licza sie w innej kolejnosci przy kazdym losowaniu i wychodza rozne na
    // ostatnich bitach. Przedzial [39.999999999999986, 40.000000000000014]
    // wygladal jak zmiennosc i przepuszczal werdykt „istotny" tam, gdzie
    // bootstrap nie zobaczyl niczego. To jest ten blad w oryginale.
    const treatment = Array.from({ length: 8 }, (_, i) =>
      strona(
        `https://a.test/t${i}`,
        okno(100 + jitter(i, 2), 1000),
        okno(100 + jitter(i, 2) + 90, 1000),
      ))
    const control = Array.from({ length: 20 }, (_, i) =>
      strona(
        `https://a.test/k${i}`,
        okno(100 + jitter(i, 1), 1000),
        okno(100 + jitter(i, 1) + 50, 1000),
      ))

    const wynik = differenceInDifferences(treatment, control, OPCJE)
    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')

    expect(wynik.effect).toBeCloseTo(40, 10)
    // Przedzial jest niezerowy tylko o szum rzedu 1e-14 — to nie jest zmiennosc.
    expect(wynik.interval.high - wynik.interval.low).toBeLessThan(1e-9)
    expect(wynik.significant).toBe(false)
    expect(wynik.direction).toBeNull()
  })

  it('zapisuje ziarno i liczbe losowan razem z werdyktem', () => {
    const wynik = differenceInDifferences(
      [strona('https://a.test/t', okno(1, 10), okno(2, 10))], kontrola(10, 0), OPCJE,
    )
    if (wynik.kind !== 'werdykt') throw new Error('spodziewano sie werdyktu')
    expect(wynik.seed).toBe(7)
    expect(wynik.resamples).toBe(2000)
    expect(wynik.controlPages).toBe(10)
    expect(wynik.treatmentPages).toBe(1)
  })
})

describe('verdictSentence', () => {
  const treatment = zmienione(8, 90)

  it('istotna poprawa mowi ile, w jakim przedziale i wobec ilu stron', () => {
    const zdanie = verdictSentence(differenceInDifferences(treatment, kontrola(20, 50), OPCJE))
    expect(zdanie).toContain('Po 30 dniach')
    expect(zdanie).toContain('+40,00')
    expect(zdanie).toContain('poprawa')
    expect(zdanie).toContain('20 stron kontrolnych')
  })

  it('nieistotna zmiana mowi wprost, ze za wczesnie na wniosek', () => {
    const zdanie = verdictSentence(differenceInDifferences(treatment, kontrola(20, 90), OPCJE))
    expect(zdanie).toContain('jeszcze nieistotne')
    expect(zdanie).not.toContain('poprawa')
  })

  it('odmowa mowi, czego zabraklo', () => {
    const zdanie = verdictSentence(differenceInDifferences(treatment, kontrola(2, 0), OPCJE))
    expect(zdanie).toContain('nie da sie zmierzyc')
    expect(zdanie).toContain('grupa kontrolna ma 2 stron')
  })

  it('CTR podaje sie w punktach procentowych', () => {
    const zdanie = verdictSentence(differenceInDifferences(treatment, kontrola(20, 50), {
      ...OPCJE, metric: 'ctr',
    }))
    expect(zdanie).toContain('pp')
    expect(zdanie).toContain('CTR')
  })
})
