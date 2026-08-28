import { describe, expect, it } from 'vitest'
import { auditSite } from '../audit.js'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, http, pageFromHtml, site } from '../support.test-helper.js'
import { CONTENT_PAGE_RULES, CONTENT_SITE_RULES } from './content.js'

function idsFor(html: string, overrides = {}): string[] {
  return runRules(CONTENT_PAGE_RULES, pageFromHtml(html, 'https://przyklad.test/strona', overrides), ctx())
    .findings.map((f) => f.ruleId)
}

const SITE_ONLY = { page: [], site: CONTENT_SITE_RULES }

describe('reguły treści — strona poprawna', () => {
  it('nie zgłasza niczego dla zdrowej strony', () => {
    expect(idsFor(HEALTHY_HTML)).toEqual([])
  })
})

describe('title', () => {
  it('zgłasza brak tytułu', () => {
    const html = HEALTHY_HTML.replace(/<title>.*?<\/title>/, '')
    expect(idsFor(html)).toContain('title.missing')
  })

  it('nie zgłasza braku tytułu na stronie z błędem serwera', () => {
    const html = HEALTHY_HTML.replace(/<title>.*?<\/title>/, '')
    expect(idsFor(html, { http: http({ status: 500 }) })).not.toContain('title.missing')
  })

  it('zgłasza tytuł ponad progiem długości i pokazuje go w dowodzie', () => {
    const long = 'A'.repeat(80)
    const html = HEALTHY_HTML.replace(/<title>.*?<\/title>/, `<title>${long}</title>`)
    const findings = runRules(CONTENT_PAGE_RULES, pageFromHtml(html), ctx()).findings
    const found = findings.find((f) => f.ruleId === 'title.too-long')
    expect(found?.evidence['długość']).toBe(80)
    expect(found?.evidence['tytuł']).toBe(long)
  })

  it('nie zgłasza tytułu mieszczącego się w progu', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('title.too-long')
  })

  it('zgłasza tytuł zbyt krótki', () => {
    const html = HEALTHY_HTML.replace(/<title>.*?<\/title>/, '<title>Sklep</title>')
    expect(idsFor(html)).toContain('title.too-short')
  })

  it('brak tytułu nie jest zgłaszany jako tytuł zbyt krótki', () => {
    const html = HEALTHY_HTML.replace(/<title>.*?<\/title>/, '')
    expect(idsFor(html)).not.toContain('title.too-short')
  })
})

describe('description', () => {
  it('zgłasza brak opisu', () => {
    const html = HEALTHY_HTML.replace(/<meta name="description"[^>]*>/, '')
    expect(idsFor(html)).toContain('description.missing')
  })

  it('zgłasza opis dłuższy niż próg', () => {
    const html = HEALTHY_HTML.replace(/content="Opis[^"]*"/, `content="${'x'.repeat(200)}"`)
    expect(idsFor(html)).toContain('description.too-long')
  })

  it('zgłasza opis krótszy niż próg', () => {
    const html = HEALTHY_HTML.replace(/content="Opis[^"]*"/, 'content="Za krótki"')
    expect(idsFor(html)).toContain('description.too-short')
  })

  it('nie zgłasza opisu w progach', () => {
    const ids = idsFor(HEALTHY_HTML)
    expect(ids).not.toContain('description.too-long')
    expect(ids).not.toContain('description.too-short')
  })
})

describe('nagłówki', () => {
  it('zgłasza brak H1', () => {
    const html = HEALTHY_HTML.replace('<h1>Poprawna strona testowa</h1>', '')
    expect(idsFor(html)).toContain('h1.missing')
  })

  it('zgłasza dwa H1 i pokazuje ich treść', () => {
    const html = HEALTHY_HTML.replace('<h1>Poprawna strona testowa</h1>', '<h1>Pierwszy</h1><h1>Drugi</h1>')
    const findings = runRules(CONTENT_PAGE_RULES, pageFromHtml(html), ctx()).findings
    const found = findings.find((f) => f.ruleId === 'h1.multiple')
    expect(found?.evidence['liczba H1']).toBe(2)
    expect(found?.evidence['treści']).toBe('Pierwszy | Drugi')
  })

  it('nie zgłasza pojedynczego H1', () => {
    const ids = idsFor(HEALTHY_HTML)
    expect(ids).not.toContain('h1.missing')
    expect(ids).not.toContain('h1.multiple')
  })

  it('zgłasza przeskok poziomów', () => {
    const html = HEALTHY_HTML.replace('<h2>Sekcja o kolejności sprawdzeń w audycie technicznym</h2>', '<h4>Przeskok</h4>')
    expect(idsFor(html)).toContain('heading.order-jump')
  })

  it('nie zgłasza poprawnej kolejności', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('heading.order-jump')
  })
})

describe('content.thin i lang.missing', () => {
  it('zgłasza stronę o ubogiej treści', () => {
    const html = '<html lang="pl"><head><title>Krótka strona testowa</title></head><body><h1>X</h1><p>Mało.</p></body></html>'
    expect(idsFor(html)).toContain('content.thin')
  })

  it('nie zgłasza strony z wystarczającą treścią', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('content.thin')
  })

  it('zgłasza brak deklaracji języka', () => {
    expect(idsFor(HEALTHY_HTML.replace('<html lang="pl">', '<html>'))).toContain('lang.missing')
  })

  it('nie zgłasza obecnej deklaracji języka', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('lang.missing')
  })
})

describe('duplikaty w skali serwisu', () => {
  const a = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/a')
  const b = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/b')
  const c = pageFromHtml(
    HEALTHY_HTML
      .replace(/<title>.*?<\/title>/, '<title>Inny tytuł tej strony testowej</title>')
      .replace(/content="Opis[^"]*"/, 'content="Zupełnie inny opis, wystarczająco długi, żeby nie wpaść w regułę zbyt krótkiego opisu."'),
    'https://przyklad.test/c',
  )

  it('zgłasza powtórzony tytuł z liczbą stron', () => {
    const result = auditSite(site([a, b, c]), ctx(), SITE_ONLY)
    const found = result.findings.find((f) => f.ruleId === 'title.duplicate')
    expect(found?.evidence['liczba stron']).toBe(2)
    expect(found?.evidence['przykłady']).toBe('https://przyklad.test/a, https://przyklad.test/b')
  })

  it('zgłasza powtórzony opis', () => {
    const result = auditSite(site([a, b, c]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).toContain('description.duplicate')
  })

  it('nie zgłasza duplikatów, gdy każda strona jest inna', () => {
    const result = auditSite(site([a, c]), ctx(), SITE_ONLY)
    expect(result.findings).toEqual([])
  })

  it('milczy przy crawlu uciętym limitem — brak dowodu, że to wszystkie strony', () => {
    const partial = ctx({ capabilities: new Set(['page-facts']) })
    const result = auditSite(site([a, b]), partial, SITE_ONLY)
    expect(result.findings).toEqual([])
    expect(result.skipped.map((s) => s.ruleId)).toEqual(['description.duplicate', 'title.duplicate'])
  })
})
