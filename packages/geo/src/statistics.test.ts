import { describe, expect, it } from 'vitest'
import {
  compareMeasurements,
  detectableDifference,
  pairedComparison,
  proportion,
  seededRandom,
  wilsonInterval,
  type MeasurementContext,
  type MeasurementSet,
  type PairedSample,
} from './statistics.js'

describe('wilsonInterval', () => {
  it('AC1: przy k=1 n=3 miesci sie w [0, 1] i jest szerszy niz przedzial normalny', () => {
    const wilson = wilsonInterval(1, 3)
    // Przedzial normalny: 1/3 ± 1,96·sqrt(p(1-p)/n) = 0,3333 ± 0,5335.
    const p = 1 / 3
    const normalHalfWidth = 1.959963984540054 * Math.sqrt((p * (1 - p)) / 3)
    const normalLow = p - normalHalfWidth

    expect(normalLow).toBeLessThan(0) // wlasnie dlatego go nie uzywamy
    expect(wilson.low).toBeGreaterThanOrEqual(0)
    expect(wilson.high).toBeLessThanOrEqual(1)
    // Wartosci wyliczone recznie: srodek 0,973576, polowa szerokosci 0,833346,
    // mianownik 1 + z^2/n = 2,280486.
    expect(wilson.low).toBeCloseTo(0.06149, 4)
    expect(wilson.high).toBeCloseTo(0.79234, 4)
    expect(wilson.high - wilson.low).toBeGreaterThan(0.7)
  })

  it('nie wychodzi poza [0, 1] przy zerze i przy komplecie trafien', () => {
    for (const [hits, trials] of [[0, 3], [3, 3], [0, 1], [1, 1]] as const) {
      const interval = wilsonInterval(hits, trials)
      expect(interval.low).toBeGreaterThanOrEqual(0)
      expect(interval.high).toBeLessThanOrEqual(1)
      expect(interval.low).toBeLessThanOrEqual(interval.high)
    }
  })

  it('zwezaja sie wraz z liczba prob przy tym samym odsetku', () => {
    const maly = wilsonInterval(3, 10)
    const duzy = wilsonInterval(300, 1000)
    expect(duzy.high - duzy.low).toBeLessThan(maly.high - maly.low)
  })

  it('brak prob to pelna niewiedza, a nie zero', () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 })
    expect(proportion(0, 0).rate).toBe(0)
  })
})

describe('seededRandom', () => {
  it('to samo ziarno daje ten sam ciag, inne ziarno inny', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const c = seededRandom(43)
    const ciagA = Array.from({ length: 5 }, () => a())
    const ciagB = Array.from({ length: 5 }, () => b())
    const ciagC = Array.from({ length: 5 }, () => c())
    expect(ciagA).toEqual(ciagB)
    expect(ciagA).not.toEqual(ciagC)
    for (const v of ciagA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

const proba = (promptId: string, before: number, after: number): PairedSample => ({
  promptId, before, after,
})

describe('pairedComparison', () => {
  it('AC2: to samo ziarno daje identyczny przedzial przy dwoch uruchomieniach', () => {
    const samples = [
      proba('p1', 0.2, 0.4), proba('p2', 0.0, 0.2), proba('p3', 0.6, 0.6),
      proba('p4', 0.4, 0.8), proba('p5', 0.2, 0.4),
    ]
    const pierwsze = pairedComparison(samples, { seed: 7, resamples: 2000 })
    const drugie = pairedComparison(samples, { seed: 7, resamples: 2000 })
    expect(drugie.interval).toEqual(pierwsze.interval)
    expect(drugie.meanDifference).toBe(pierwsze.meanDifference)
  })

  it('inne ziarno daje inny przedzial — bo to losowanie, nie wzor', () => {
    const samples = [
      proba('p1', 0.2, 0.4), proba('p2', 0.0, 0.2), proba('p3', 0.6, 0.6),
      proba('p4', 0.4, 0.8), proba('p5', 0.2, 0.4),
    ]
    const a = pairedComparison(samples, { seed: 1, resamples: 2000 })
    const b = pairedComparison(samples, { seed: 2, resamples: 2000 })
    expect(a.interval).not.toEqual(b.interval)
    expect(a.meanDifference).toBe(b.meanDifference) // srednia nie zalezy od losowania
  })

  it('AC4: zmiana obejmujaca zero jest nieistotna i nie dostaje kierunku', () => {
    // Roznice raz w gore, raz w dol — srednia lekko dodatnia, ale przedzial
    // przechodzi przez zero. Zielona strzalka tutaj byloby uczeniem szumu.
    const samples = [
      proba('p1', 0.4, 0.6), proba('p2', 0.6, 0.4), proba('p3', 0.2, 0.4),
      proba('p4', 0.8, 0.6), proba('p5', 0.4, 0.6), proba('p6', 0.6, 0.6),
    ]
    const wynik = pairedComparison(samples, { seed: 11 })
    expect(wynik.interval.low).toBeLessThanOrEqual(0)
    expect(wynik.interval.high).toBeGreaterThanOrEqual(0)
    expect(wynik.significant).toBe(false)
  })

  it('konsekwentna poprawa na kazdym prompcie jest istotna', () => {
    const samples = Array.from({ length: 12 }, (_, i) => proba(`p${i}`, 0.2, 0.6))
    const wynik = pairedComparison(samples, { seed: 3 })
    expect(wynik.meanDifference).toBeCloseTo(0.4, 10)
    expect(wynik.interval.low).toBeGreaterThan(0)
    expect(wynik.significant).toBe(true)
  })

  it('jeden prompt nie udaje precyzji', () => {
    const wynik = pairedComparison([proba('p1', 0.0, 1.0)], { seed: 5 })
    expect(wynik.pairs).toBe(1)
    expect(wynik.meanDifference).toBe(1)
    expect(wynik.interval).toEqual({ low: 1, high: 1 })
    expect(wynik.significant).toBe(false)
  })

  it('pusty zestaw nie wybucha i nie jest istotny', () => {
    const wynik = pairedComparison([], { seed: 5 })
    expect(wynik.pairs).toBe(0)
    expect(wynik.significant).toBe(false)
  })

  it('zapisuje ziarno i liczbe losowan razem z wynikiem', () => {
    const wynik = pairedComparison([proba('p1', 0.2, 0.4), proba('p2', 0.2, 0.6)], {
      seed: 99, resamples: 500,
    })
    expect(wynik.seed).toBe(99)
    expect(wynik.resamples).toBe(500)
  })
})

const zestaw = (
  promptSetId: string,
  measurements: readonly { promptId: string; hits: number; trials: number }[],
  context: MeasurementContext = { engine: 'gemini', modelVersion: '2.5-flash', accessMode: 'api' },
): MeasurementSet => ({ context, promptSetId, measurements })

describe('compareMeasurements', () => {
  const przed = zestaw('zestaw-a', [
    { promptId: 'p1', hits: 1, trials: 5 },
    { promptId: 'p2', hits: 0, trials: 5 },
    { promptId: 'p3', hits: 2, trials: 5 },
  ])

  it('liczy roznice sparowane na tym samym zestawie', () => {
    const po = zestaw('zestaw-a', [
      { promptId: 'p1', hits: 3, trials: 5 },
      { promptId: 'p2', hits: 2, trials: 5 },
      { promptId: 'p3', hits: 4, trials: 5 },
    ])
    const wynik = compareMeasurements(przed, po, { seed: 13 })
    expect(wynik.kind).toBe('porownanie')
    if (wynik.kind !== 'porownanie') return
    expect(wynik.comparison.pairs).toBe(3)
    expect(wynik.comparison.meanDifference).toBeCloseTo(0.4, 10)
  })

  it('AC3: odmawia, gdy zestaw promptow sie zmienil, i mowi co doszlo', () => {
    const po = zestaw('zestaw-b', [
      { promptId: 'p1', hits: 3, trials: 5 },
      { promptId: 'p2', hits: 2, trials: 5 },
      { promptId: 'p3', hits: 4, trials: 5 },
      { promptId: 'p4', hits: 5, trials: 5 },
    ])
    const wynik = compareMeasurements(przed, po, { seed: 13 })
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('rozny-zestaw-promptow')
    expect(wynik.detail).toContain('p4')
  })

  it('AC5: odmawia przy innej wersji modelu', () => {
    const po = zestaw(
      'zestaw-a',
      [
        { promptId: 'p1', hits: 3, trials: 5 },
        { promptId: 'p2', hits: 2, trials: 5 },
        { promptId: 'p3', hits: 4, trials: 5 },
      ],
      { engine: 'gemini', modelVersion: '3.0-flash', accessMode: 'api' },
    )
    const wynik = compareMeasurements(przed, po, { seed: 13 })
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('rozny-silnik-lub-wersja')
    expect(wynik.detail).toContain('2.5-flash')
    expect(wynik.detail).toContain('3.0-flash')
  })

  it('AC5: odmawia przy innym trybie dostepu — grounding to inny proces', () => {
    const po = zestaw(
      'zestaw-a',
      [
        { promptId: 'p1', hits: 3, trials: 5 },
        { promptId: 'p2', hits: 2, trials: 5 },
        { promptId: 'p3', hits: 4, trials: 5 },
      ],
      { engine: 'gemini', modelVersion: '2.5-flash', accessMode: 'api_grounded' },
    )
    const wynik = compareMeasurements(przed, po, { seed: 13 })
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('rozny-silnik-lub-wersja')
  })

  it('odmawia, gdy jeden z pomiarow jest pusty', () => {
    const wynik = compareMeasurements(przed, zestaw('zestaw-a', []), { seed: 13 })
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('brak-wspolnych-promptow')
  })

  it('kolejnosc promptow w zestawie nie ma znaczenia', () => {
    const po = zestaw('zestaw-a', [
      { promptId: 'p3', hits: 2, trials: 5 },
      { promptId: 'p1', hits: 1, trials: 5 },
      { promptId: 'p2', hits: 0, trials: 5 },
    ])
    const wynik = compareMeasurements(przed, po, { seed: 13 })
    expect(wynik.kind).toBe('porownanie')
    if (wynik.kind !== 'porownanie') return
    expect(wynik.comparison.meanDifference).toBe(0)
  })
})

describe('detectableDifference', () => {
  it('przy 50 promptach i 3 przebiegach to okolo 11 punktow procentowych', () => {
    // Liczba wyliczona, nie oszacowana przy biurku. Pierwsza wersja specyfikacji
    // mowila 8-10 pp — arytmetyka poprawila specyfikacje, nie odwrotnie.
    const rozdzielczosc = detectableDifference(50, 3)
    expect(rozdzielczosc).toBeCloseTo(0.1132, 4)
  })

  it('sam szum probkowania zalezy tylko od iloczynu promptow i przebiegow', () => {
    const baza = detectableDifference(50, 3)
    const wiecejPromptow = detectableDifference(100, 3)
    const wiecejPrzebiegow = detectableDifference(50, 6)
    expect(wiecejPromptow).toBeLessThan(baza)
    expect(wiecejPrzebiegow).toBeLessThan(baza)
    // Ten sam iloczyn to ta sama liczba — i wlasnie dlatego ta funkcja jest
    // **dolnym** oszacowaniem: nie zawiera rozrzutu efektu miedzy promptami,
    // ktory zbija tylko wiekszy zestaw promptow.
    expect(wiecejPromptow).toBeCloseTo(wiecejPrzebiegow, 10)
  })

  it('zerowy zestaw nie mierzy niczego', () => {
    expect(detectableDifference(0, 3)).toBe(1)
    expect(detectableDifference(50, 0)).toBe(1)
  })
})
