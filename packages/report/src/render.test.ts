import { describe, expect, it } from 'vitest'
import { type ReportData, renderReport } from './render.js'

const DATA: ReportData = {
  siteUri: 'sc-domain:example.pl',
  generatedAt: '2026-03-14 09:00',
  daily: [
    { date: '2026-03-10', clicks: 100, impressions: 1000 },
    { date: '2026-03-11', clicks: 150, impressions: 1200 },
  ],
  topQueries: [{ query: 'buty <trekkingowe>', clicks: 90, impressions: 900 }],
  reconciliation: [
    { date: '2026-03-10', totalClicks: 100, querySumClicks: 90, anonymizedDeltaClicks: 10,
      totalImpressions: 1000, querySumImpressions: 900, anonymizedDeltaImpressions: 100 },
  ],
  providerCalls: [
    { providerId: 'gsc', capability: 'performance.byDate', calls: 4, quotaUnits: 4, costMicros: 0, failures: 0 },
  ],
}

describe('renderReport', () => {
  it('nie odwoluje sie do niczego z sieci (AC11)', () => {
    const html = renderReport(DATA)
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    expect(html).not.toContain('<script src')
    expect(html).not.toContain('@import')
  })

  it('eskejpuje tresc pochodzaca z danych', () => {
    const html = renderReport({
      ...DATA,
      topQueries: [{ query: '<img src=x onerror=alert(1)>', clicks: 1, impressions: 1 }],
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('odpowiada na wszystkie piec pytan z D10', () => {
    const html = renderReport(DATA)
    expect(html).toContain('Kliknięcia dziennie')
    expect(html).toContain('Hasła dające kliknięcia')
    expect(html).toContain('Ukryte przez Google')
    expect(html).toContain('Uzgodnienie z Search Console')
    expect(html).toContain('Zużycie darmowych limitów')
  })

  it('pokazuje ukryte dane jako liczbe i procent', () => {
    const html = renderReport(DATA)
    expect(html).toContain('10')
    expect(html).toMatch(/10[,.]0\s*%/)
  })

  it('radzi sobie z pustymi danymi', () => {
    const html = renderReport({
      siteUri: 'sc-domain:x.pl', generatedAt: '2026-03-14 09:00',
      daily: [], topQueries: [], reconciliation: [], providerCalls: [],
    })
    expect(html).toContain('Brak danych')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })

  it('jest kompletnym dokumentem HTML', () => {
    const html = renderReport(DATA)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="pl">')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('eskejpuje takze tytul i etykiety wykresu', () => {
    const html = renderReport({
      ...DATA,
      siteUri: 'sc-domain:<zle>.pl',
      daily: [{ date: '<data>', clicks: 1, impressions: 1 }],
    })
    expect(html).not.toContain('<zle>')
    expect(html).not.toContain('<title><data>')
  })
})
