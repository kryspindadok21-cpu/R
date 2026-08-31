import { describe, expect, it } from 'vitest'
import {
  clickUpside, expectedCtr, opportunityFromCluster, opportunityFromFinding,
  opportunityFromGeoGap, rankOpportunities, scoreOf,
  type ClusterInput, type FindingInput, type Opportunity,
} from './opportunity.js'

const czynnik = (value: number) => ({ value, source: 'declared' as const, basis: 'test' })

const okazja = (id: string, nadpisz: Partial<Opportunity> = {}): Opportunity => ({
  id, kind: 'fix-finding', title: id, targetUrl: null,
  impact: czynnik(10), confidence: czynnik(1), fit: czynnik(1),
  effort: czynnik(1), risk: czynnik(1),
  ...nadpisz,
})

describe('scoreOf', () => {
  it('liczy (impact × confidence × fit) / (effort × risk)', () => {
    expect(scoreOf(okazja('a', {
      impact: czynnik(100), confidence: czynnik(0.5), fit: czynnik(0.8),
      effort: czynnik(4), risk: czynnik(2),
    }))).toBeCloseTo((100 * 0.5 * 0.8) / (4 * 2), 10)
  })

  it('zerowy naklad nie dzieli przez zero', () => {
    const wynik = scoreOf(okazja('a', { effort: czynnik(0), risk: czynnik(0) }))
    expect(Number.isFinite(wynik)).toBe(true)
    expect(wynik).toBeGreaterThan(0)
  })

  it('ujemny naklad tez nie wywraca rankingu', () => {
    expect(scoreOf(okazja('a', { effort: czynnik(-5) }))).toBeGreaterThan(0)
  })
})

describe('rankOpportunities', () => {
  it('AC1: ten sam zestaw daje identyczny ranking przy kazdym wywolaniu', () => {
    const zestaw = [okazja('c', { impact: czynnik(5) }), okazja('a'), okazja('b')]
    const pierwszy = rankOpportunities(zestaw)
    const drugi = rankOpportunities([...zestaw].reverse())
    expect(drugi.map((o) => o.id)).toEqual(pierwszy.map((o) => o.id))
  })

  it('przy remisie decyduje identyfikator, nie kolejnosc wejscia', () => {
    const ranking = rankOpportunities([okazja('z'), okazja('a'), okazja('m')])
    expect(ranking.map((o) => o.id)).toEqual(['a', 'm', 'z'])
  })

  it('AC2: liczy, ile czynnikow jest zmierzonych, a ile zadeklarowanych', () => {
    const [wynik] = rankOpportunities([okazja('a', {
      impact: { value: 10, source: 'measured', basis: 'GSC' },
      confidence: { value: 1, source: 'measured', basis: 'GSC' },
    })])
    expect(wynik?.measuredFactors).toBe(2)
  })

  it('pusty zestaw nie wybucha', () => {
    expect(rankOpportunities([])).toEqual([])
  })
})

describe('expectedCtr i clickUpside', () => {
  it('CTR spada wraz z pozycja i ma podloge', () => {
    expect(expectedCtr(1)).toBeGreaterThan(expectedCtr(3))
    expect(expectedCtr(3)).toBeGreaterThan(expectedCtr(10))
    expect(expectedCtr(50)).toBe(expectedCtr(10))
  })

  it('pozycja ponizej jedynki nie wychodzi poza krzywa', () => {
    expect(expectedCtr(0)).toBe(expectedCtr(1))
  })

  it('strona juz w trojce nie ma potencjalu awansu', () => {
    expect(clickUpside(1000, 2)).toBe(0)
    expect(clickUpside(1000, 3)).toBe(0)
  })

  it('potencjal rosnie z wyswietleniami i z odlegloscia od trojki', () => {
    expect(clickUpside(1000, 11)).toBeGreaterThan(clickUpside(1000, 5))
    expect(clickUpside(10_000, 11)).toBeGreaterThan(clickUpside(1000, 11))
  })
})

describe('opportunityFromFinding', () => {
  const ustalenie = (o: Partial<FindingInput> = {}): FindingInput => ({
    ruleId: 'title.too-long', severity: 'medium', url: 'https://a.test/x',
    title: 'Tytul uciety', affectedPages: 1, hasAutofix: false, ...o,
  })

  it('waga ustalenia napedza wplyw', () => {
    const blokujace = opportunityFromFinding(ustalenie({ severity: 'blocker' }))
    const drobne = opportunityFromFinding(ustalenie({ severity: 'low' }))
    expect(scoreOf(blokujace)).toBeGreaterThan(scoreOf(drobne))
  })

  it('AC2: wagi sa oznaczone jako zadeklarowane, bo nie sa pomiarem wplywu na ruch', () => {
    const okazja = opportunityFromFinding(ustalenie())
    expect(okazja.impact.source).toBe('declared')
    expect(okazja.impact.basis).toContain('nie z pomiaru')
  })

  it('gotowa poprawka podnosi wynik, bo obniza naklad i ryzyko', () => {
    const zPoprawka = opportunityFromFinding(ustalenie({ hasAutofix: true }))
    const bez = opportunityFromFinding(ustalenie({ hasAutofix: false }))
    expect(scoreOf(zPoprawka)).toBeGreaterThan(scoreOf(bez))
  })

  it('nieznana waga nie wywraca rachunku', () => {
    const okazja = opportunityFromFinding(ustalenie({ severity: 'cos-nowego' }))
    expect(Number.isFinite(scoreOf(okazja))).toBe(true)
  })

  it('identyfikator jest stabilny miedzy przebiegami', () => {
    expect(opportunityFromFinding(ustalenie()).id)
      .toBe(opportunityFromFinding(ustalenie()).id)
  })
})

describe('opportunityFromCluster', () => {
  const klaster = (o: Partial<ClusterInput> = {}): ClusterInput => ({
    slug: 'audyt-seo', head: 'audyt seo', totalImpressions: 1000,
    bestPosition: 11, decision: 'refresh', targetUrl: 'https://a.test/audyt',
    method: 'serp-overlap', ...o,
  })

  it('D38: odswiezenie wygrywa z tworzeniem przy tych samych danych', () => {
    const odswiez = opportunityFromCluster(klaster({ decision: 'refresh' }))
    const nowa = opportunityFromCluster(klaster({ decision: 'create', targetUrl: null }))
    expect(scoreOf(odswiez)).toBeGreaterThan(scoreOf(nowa))
    expect(nowa.risk.basis).toContain('kanibalizowac')
  })

  it('D33: metoda leksykalna obniza pewnosc, bo to hipoteza', () => {
    const serp = opportunityFromCluster(klaster({ method: 'serp-overlap' }))
    const leks = opportunityFromCluster(klaster({ method: 'lexical-overlap' }))
    expect(leks.confidence.value).toBeLessThan(serp.confidence.value)
    expect(leks.confidence.basis).toContain('lexical-overlap')
  })

  it('wplyw jest zmierzony, ale mowi, ze krzywa CTR jest branzowa', () => {
    const okazja = opportunityFromCluster(klaster())
    expect(okazja.impact.source).toBe('measured')
    expect(okazja.impact.basis).toContain('nie wlasna')
  })

  it('klaster bez pozycji nie zmysla jej, tylko zaklada daleka', () => {
    const okazja = opportunityFromCluster(klaster({ bestPosition: null }))
    expect(okazja.impact.basis).toContain('50.0')
  })

  it('strona juz w trojce ma minimalny, ale niezerowy wplyw', () => {
    const okazja = opportunityFromCluster(klaster({ bestPosition: 2 }))
    expect(okazja.impact.value).toBeGreaterThan(0)
    expect(scoreOf(okazja)).toBeGreaterThan(0)
  })
})

describe('opportunityFromGeoGap', () => {
  it('luka wobec konkurencji napedza wplyw', () => {
    const duza = opportunityFromGeoGap({
      prompt: 'p', mentionRate: 0.1, competitorRate: 0.9, runs: 30,
    })
    const mala = opportunityFromGeoGap({
      prompt: 'p', mentionRate: 0.8, competitorRate: 0.9, runs: 30,
    })
    expect(scoreOf(duza)).toBeGreaterThan(scoreOf(mala))
  })

  it('D24: pewnosc rosnie z liczba przebiegow i nigdy nie siega jedynki', () => {
    const malo = opportunityFromGeoGap({
      prompt: 'p', mentionRate: 0, competitorRate: 1, runs: 3,
    })
    const duzo = opportunityFromGeoGap({
      prompt: 'p', mentionRate: 0, competitorRate: 1, runs: 300,
    })
    expect(malo.confidence.value).toBeLessThan(duzo.confidence.value)
    expect(duzo.confidence.value).toBeLessThanOrEqual(0.8)
  })

  it('gdy jestesmy wymieniani czesciej niz konkurencja, wplyw nie schodzi ponizej zera', () => {
    const okazja = opportunityFromGeoGap({
      prompt: 'p', mentionRate: 0.9, competitorRate: 0.1, runs: 30,
    })
    expect(okazja.impact.value).toBeGreaterThan(0)
  })
})
