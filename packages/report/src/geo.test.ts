import { describe, expect, it } from 'vitest'
import { renderGeoReport } from './geo.js'
import type { GeoReportData } from './geo-types.js'

const DANE: GeoReportData = {
  siteUri: 'https://przyklad.test/',
  generatedAt: '2026-08-31 12:00',
  runStartedAt: '2026-08-31 11:00',
  ownBrand: 'Mentiometry',
  promptSetName: 'domyslny',
  promptSetVersion: 1,
  prompts: 50,
  runsPerPrompt: 3,
  entityVersion: 1,
  detectableDifference: 0.1132,
  engines: [{
    engine: 'gemini', modelVersion: 'gemini-2.5-flash', accessMode: 'api_grounded',
    answersOk: 150, answersFailed: 0, refusals: 2,
    visibility: { rate: 0.34, low: 0.27, high: 0.42 },
  }],
  skipped: [{ id: 'groq', reason: 'brak klucza — ustaw SEO_GROQ_KEY' }],
  voice: [
    {
      name: 'Mentiometry', isOwn: true, answersWithMention: 51,
      share: { rate: 0.34, low: 0.27, high: 0.42 }, medianFirstPosition: 0.42,
    },
    {
      name: 'Semrush', isOwn: false, answersWithMention: 99,
      share: { rate: 0.66, low: 0.58, high: 0.73 }, medianFirstPosition: null,
    },
  ],
  citations: [
    {
      source: 'grounding', ourRate: { rate: 0.2, low: 0.14, high: 0.27 },
      topHosts: [{ host: 'przyklad.test', count: 30 }],
    },
    { source: 'inline', ourRate: { rate: 0.05, low: 0.02, high: 0.1 }, topHosts: [] },
  ],
  comparisons: [{
    kind: 'porownanie', engine: 'gemini',
    meanDifference: 0.02, low: -0.04, high: 0.08, significant: false,
  }],
}

describe('renderGeoReport', () => {
  it('nie odwoluje sie do niczego z sieci', () => {
    const html = renderGeoReport(DANE)
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    expect(html).not.toContain('<script src')
    expect(html).not.toContain('@import')
  })

  it('D18: nie podaje oceny zbiorczej ani jednej liczby widocznosci', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('nie podaje oceny w skali 0–100')
    expect(html).not.toMatch(/wynik[^<]{0,20}\/\s*100/i)
  })

  it('D24: kazdy odsetek ma przy sobie przedzial', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('34,0% (27,0% – 42,0%)')
  })

  it('D26: zmiana obejmujaca zero jest szara i bez kierunku', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('jeszcze nieistotne')
    expect(html).toContain('class="nieistotne"')
    expect(html).not.toContain('class="istotne')
    // Liczba zostaje widoczna — ukrywanie jej byloby rownie mylace.
    expect(html).toContain('+2,0%')
  })

  it('D26: zmiana z przedzialem po jednej stronie zera dostaje kierunek', () => {
    const html = renderGeoReport({
      ...DANE,
      comparisons: [{
        kind: 'porownanie', engine: 'gemini',
        meanDifference: 0.12, low: 0.04, high: 0.2, significant: true,
      }],
    })
    expect(html).toContain('class="istotne w-gore"')
    expect(html).toContain('wzrost')
    expect(html).not.toContain('jeszcze nieistotne')
  })

  it('spadek istotny dostaje wlasny kierunek, a nie ten sam co wzrost', () => {
    const html = renderGeoReport({
      ...DANE,
      comparisons: [{
        kind: 'porownanie', engine: 'gemini',
        meanDifference: -0.15, low: -0.22, high: -0.07, significant: true,
      }],
    })
    expect(html).toContain('class="istotne w-dol"')
    expect(html).toContain('spadek')
    expect(html).toContain('−15,0%')
  })

  it('odmowa porownania jest wynikiem z powodem, a nie pusta komorka', () => {
    const html = renderGeoReport({
      ...DANE,
      comparisons: [{
        kind: 'odmowa', engine: 'gemini',
        reason: 'rozny zestaw promptow',
        detail: 'przybylo: p51',
      }],
    })
    expect(html).toContain('nie porównano — rozny zestaw promptow')
    expect(html).toContain('class="odmowa"')
  })

  it('pierwszy pomiar mowi wprost, ze nie ma z czym porownywac', () => {
    const html = renderGeoReport({ ...DANE, comparisons: [] })
    expect(html).toContain('To pierwszy pomiar')
  })

  it('AC7: pominiete silniki sa widoczne w raporcie', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('Silniki pominięte')
    expect(html).toContain('SEO_GROQ_KEY')
  })

  it('brak pominietych silnikow nie zostawia pustej sekcji', () => {
    expect(renderGeoReport({ ...DANE, skipped: [] })).not.toContain('Silniki pominięte')
  })

  it('D32: cytowania sa rozdzielone na zrodla i nie ma lacznej liczby', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('grounding (pobrane)')
    expect(html).toContain('treść (napisane)')
    expect(html).toContain('nie ma tu jednej „liczby cytowań"')
  })

  it('D30: brak wzmianek daje kreske zamiast zmyslonej pozycji', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('Semrush')
    expect(html).toContain('<td class="l">—</td>')
  })

  it('podaje rozdzielczosc pomiaru wprost', () => {
    const html = renderGeoReport(DANE)
    expect(html).toContain('11,3%')
    expect(html).toContain('większy zestaw promptów')
  })

  it('eskejpuje tresc pochodzaca z danych', () => {
    const html = renderGeoReport({
      ...DANE,
      voice: [{
        name: '<img src=x onerror=alert(1)>', isOwn: false, answersWithMention: 1,
        share: { rate: 0.1, low: 0, high: 0.2 }, medianFirstPosition: null,
      }],
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('brak danych w sekcji nie udaje danych', () => {
    const html = renderGeoReport({ ...DANE, voice: [], citations: [], engines: [] })
    expect(html).toContain('Brak danych')
  })
})
