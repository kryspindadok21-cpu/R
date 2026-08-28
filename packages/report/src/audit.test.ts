import { describe, expect, it } from 'vitest'
import { renderAuditReport } from './audit.js'
import type { AuditReportData } from './audit-types.js'

const DANE: AuditReportData = {
  siteUri: 'https://przyklad.test/',
  generatedAt: '2026-08-28 10:15',
  crawlStartedAt: '2026-08-28 10:12',
  userAgent: 'mentiometry-crawler/0.1',
  robotsState: 'ok',
  pagesCrawled: 42,
  pagesFailed: 1,
  truncated: false,
  truncationReason: null,
  countsBySeverity: { blocker: 1, high: 2, medium: 5, low: 9, info: 3 },
  findings: [
    {
      ruleId: 'http.status-5xx', severity: 'blocker', category: 'indexation',
      url: 'https://przyklad.test/awaria', title: 'Strona odpowiada błędem serwera',
      evidence: { 'status': 503 },
    },
    {
      ruleId: 'title.too-long', severity: 'low', category: 'content',
      url: 'https://przyklad.test/oferta', title: 'Tytuł prawdopodobnie ucięty w wynikach',
      evidence: { 'długość': 91, 'próg': 60, 'tytuł': 'Bardzo długi tytuł' },
    },
    {
      ruleId: 'title.duplicate', severity: 'medium', category: 'content',
      url: null, title: 'Ten sam tytuł na wielu stronach',
      evidence: { 'liczba stron': 3 },
    },
  ],
  topRules: [
    { ruleId: 'http.status-5xx', title: 'Strona odpowiada błędem serwera', severity: 'blocker', count: 1 },
    { ruleId: 'title.too-long', title: 'Tytuł prawdopodobnie ucięty w wynikach', severity: 'low', count: 9 },
  ],
  statusCounts: [
    { status: '200', count: 39 },
    { status: '404', count: 2 },
    { status: 'brak odpowiedzi', count: 1 },
  ],
  orphans: ['https://przyklad.test/ukryta'],
  deepestPages: [{ url: 'https://przyklad.test/gleboko/bardzo/daleko', clickDepth: 6 }],
  redirects: [{ from: 'https://przyklad.test/stara', to: 'https://przyklad.test/nowa', hops: 2 }],
  skipped: [{ ruleId: 'ai.js-required-for-content', missing: ['render-diff'] }],
}

describe('renderAuditReport', () => {
  it('nie odwołuje się do niczego z sieci (AC10)', () => {
    const html = renderAuditReport(DANE)
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('@import')
  })

  it('eskejpuje treść pochodzącą z danych', () => {
    const html = renderAuditReport({
      ...DANE,
      findings: [{
        ruleId: 'title.too-long', severity: 'low', category: 'content',
        url: 'https://przyklad.test/x', title: 'Tytuł',
        evidence: { 'tytuł': '<img src=x onerror=alert(1)>' },
      }],
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('nie zawiera żadnej oceny zbiorczej 0-100 (D18)', () => {
    const html = renderAuditReport(DANE)
    expect(html.toLowerCase()).not.toContain('site health')
    expect(html).not.toMatch(/\b\d{1,3}\s*\/\s*100\b/)
    expect(html).toContain('nie podaje oceny w skali 0–100')
  })

  it('pokazuje każde ustalenie z adresem i dowodem', () => {
    const html = renderAuditReport(DANE)
    expect(html).toContain('https://przyklad.test/awaria')
    expect(html).toContain('status: 503')
    expect(html).toContain('długość: 91')
  })

  it('ustalenie serwisowe podpisuje jako cały serwis, nie pustym adresem', () => {
    const html = renderAuditReport(DANE)
    expect(html).toContain('cały serwis')
  })

  it('grupuje ustalenia od najcięższych', () => {
    const html = renderAuditReport(DANE)
    const blokujace = html.indexOf('blokujące — strona nie może')
    const niskie = html.indexOf('niskie — drobiazg')
    expect(blokujace).toBeGreaterThan(-1)
    expect(niskie).toBeGreaterThan(blokujace)
  })

  it('tłumaczy, co znaczy każda waga', () => {
    const html = renderAuditReport(DANE)
    expect(html).toContain('realnie kosztuje widoczność')
    expect(html).toContain('obserwacja, nie usterka')
  })

  it('pokazuje reguły pominięte razem z powodem', () => {
    const html = renderAuditReport(DANE)
    expect(html).toContain('ai.js-required-for-content')
    expect(html).toContain('render-diff')
    expect(html).toContain('Reguły pominięte')
  })

  it('pokazuje łańcuchy przekierowań z liczbą przeskoków', () => {
    const html = renderAuditReport(DANE)
    expect(html).toContain('https://przyklad.test/stara')
    expect(html).toContain('https://przyklad.test/nowa')
    expect(html).toContain('Przekierowania')
  })

  it('pokazuje strony osierocone i najgłębsze', () => {
    const html = renderAuditReport(DANE)
    expect(html).toContain('https://przyklad.test/ukryta')
    expect(html).toContain('https://przyklad.test/gleboko/bardzo/daleko')
  })

  it('ucięty crawl jest powiedziany wprost, razem z konsekwencją', () => {
    const html = renderAuditReport({ ...DANE, truncated: true, truncationReason: 'max-pages' })
    expect(html).toContain('Crawl został ucięty')
    expect(html).toContain('max-pages')
    expect(html).toContain('zamilkły')
  })

  it('kompletny crawl nie straszy ostrzeżeniem o ucięciu', () => {
    expect(renderAuditReport(DANE)).not.toContain('Crawl został ucięty')
  })

  it('nieosiągalny robots.txt jest widoczny na pierwszym ekranie', () => {
    const html = renderAuditReport({ ...DANE, robotsState: 'unreachable' })
    expect(html).toContain('nieosiągalny — crawl wstrzymany')
  })

  it('audyt bez ustaleń mówi to wprost, zamiast pokazywać pustą tabelę', () => {
    const html = renderAuditReport({
      ...DANE,
      findings: [],
      countsBySeverity: { blocker: 0, high: 0, medium: 0, low: 0, info: 0 },
    })
    expect(html).toContain('Żadna reguła nie zgłosiła ustalenia')
  })

  it('jest poprawnym dokumentem HTML po polsku', () => {
    const html = renderAuditReport(DANE)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="pl">')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })
})
