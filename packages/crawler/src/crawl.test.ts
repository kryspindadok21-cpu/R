import { describe, expect, it } from 'vitest'
import { effectiveDelayMs, runCrawl, type CrawlResult } from './crawl.js'
import { DEFAULT_LIMITS, USER_AGENT, clampLimits } from './limits.js'
import { EMPTY_ROBOTS, parseRobotsTxt } from './robots.js'
import { fakeClock, fakePageSource, htmlWithLinks } from './site.test-helper.js'

const ROOT = 'https://przyklad.test/'

/** Fixturowa witryna: korzeń → oferta, blog; blog → wpis; wpis → korzeń. */
const WITRYNA = {
  'https://przyklad.test/': htmlWithLinks('Start', ['/oferta', '/blog', 'https://obca.test/x']),
  'https://przyklad.test/oferta': htmlWithLinks('Oferta', ['/']),
  'https://przyklad.test/blog': htmlWithLinks('Blog', ['/blog/wpis', '/oferta']),
  'https://przyklad.test/blog/wpis': htmlWithLinks('Wpis', ['/']),
}

async function crawl(
  spec: Record<string, Parameters<typeof fakePageSource>[0][string]> = WITRYNA,
  overrides: Partial<Parameters<typeof runCrawl>[0]> = {},
): Promise<CrawlResult> {
  const clock = fakeClock()
  return runCrawl({
    siteUrl: ROOT,
    pageSource: fakePageSource(spec, clock),
    clock,
    limits: DEFAULT_LIMITS,
    robots: EMPTY_ROBOTS,
    robotsState: 'ok',
    ...overrides,
  })
}

describe('runCrawl — przebieg podstawowy', () => {
  it('odwiedza wszystkie strony osiągalne z korzenia', async () => {
    const result = await crawl()
    expect(result.pages.map((p) => p.url).sort()).toEqual([
      'https://przyklad.test/',
      'https://przyklad.test/blog',
      'https://przyklad.test/blog/wpis',
      'https://przyklad.test/oferta',
    ])
  })

  it('daje ten sam wynik przy powtórzeniu', async () => {
    const a = await crawl()
    const b = await crawl()
    expect(a.pages.map((p) => p.url)).toEqual(b.pages.map((p) => p.url))
  })

  it('idzie wszerz — korzeń, potem jego sąsiedzi', async () => {
    const result = await crawl()
    expect(result.pages.map((p) => p.depth)).toEqual([0, 1, 1, 2])
  })

  it('nie pobiera tej samej strony dwa razy mimo linków zwrotnych', async () => {
    const result = await crawl()
    expect(result.requests).toBe(4)
  })

  it('nie wychodzi poza własny host', async () => {
    const result = await crawl()
    expect(result.pages.map((p) => p.url)).not.toContain('https://obca.test/x')
  })

  it('zapisuje krawędź do strony zewnętrznej, ale jej nie odwiedza', async () => {
    const result = await crawl()
    const external = result.links.filter((l) => !l.isInternal)
    expect(external.map((l) => l.toUrl)).toEqual(['https://obca.test/x'])
  })

  it('parsuje treść odwiedzonych stron', async () => {
    const result = await crawl()
    expect(result.pages[0]?.facts?.title).toBe('Start')
  })

  it('crawl domknięty nie melduje ucięcia', async () => {
    const result = await crawl()
    expect(result.truncated).toBe(false)
    expect(result.truncationReason).toBeNull()
  })

  it('przedstawia się jawnym agentem, nie podszywa się pod przeglądarkę', async () => {
    const result = await crawl()
    expect(result.userAgent).toBe(USER_AGENT)
    expect(result.userAgent.toLowerCase()).not.toContain('mozilla')
  })
})

describe('runCrawl — robots.txt', () => {
  it('nie pobiera adresu zabronionego przez Disallow', async () => {
    const clock = fakeClock()
    const source = fakePageSource(WITRYNA, clock)
    const result = await runCrawl({
      siteUrl: ROOT,
      pageSource: source,
      clock,
      limits: DEFAULT_LIMITS,
      robots: parseRobotsTxt('User-agent: *\nDisallow: /blog'),
      robotsState: 'ok',
    })

    expect(source.requested).not.toContain('https://przyklad.test/blog')
    expect(result.blockedByRobots).toEqual(['https://przyklad.test/blog'])
    expect(result.pages.map((p) => p.url)).not.toContain('https://przyklad.test/blog')
  })

  it('nieosiągalny robots.txt zatrzymuje crawl bez ani jednego żądania', async () => {
    const clock = fakeClock()
    const source = fakePageSource(WITRYNA, clock)
    const result = await runCrawl({
      siteUrl: ROOT,
      pageSource: source,
      clock,
      limits: DEFAULT_LIMITS,
      robots: EMPTY_ROBOTS,
      robotsState: 'unreachable',
    })

    expect(source.requested).toEqual([])
    expect(result.pages).toEqual([])
    expect(result.robotsState).toBe('unreachable')
  })

  it('brak robots.txt (404) nie blokuje crawla', async () => {
    const result = await crawl(WITRYNA, { robotsState: 'missing' })
    expect(result.pages.length).toBe(4)
  })
})

describe('runCrawl — odstęp między żądaniami', () => {
  it('czeka między kolejnymi żądaniami do tego samego hosta', async () => {
    const clock = fakeClock()
    await runCrawl({
      siteUrl: ROOT,
      pageSource: fakePageSource(WITRYNA, clock),
      clock,
      limits: DEFAULT_LIMITS,
      robots: EMPTY_ROBOTS,
      robotsState: 'ok',
    })

    // Trzy przerwy przy czterech żądaniach; każda dopełnia sekundę po 50 ms pobrania.
    expect(clock.sleeps).toEqual([950, 950, 950])
  })

  it('respektuje Crawl-delay dłuższy niż nasz własny', () => {
    const robots = parseRobotsTxt('User-agent: *\nCrawl-delay: 5')
    expect(effectiveDelayMs(DEFAULT_LIMITS, robots, USER_AGENT)).toBe(5000)
  })

  it('nie przyspiesza, gdy Crawl-delay jest krótszy niż nasz odstęp', () => {
    const robots = parseRobotsTxt('User-agent: *\nCrawl-delay: 0.1')
    expect(effectiveDelayMs(DEFAULT_LIMITS, robots, USER_AGENT)).toBe(DEFAULT_LIMITS.delayMs)
  })
})

describe('runCrawl — bezpieczniki', () => {
  it('zatrzymuje się na limicie stron i melduje ucięcie', async () => {
    const { limits } = clampLimits({ maxPages: 2 })
    const result = await crawl(WITRYNA, { limits })
    expect(result.pages).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('max-pages')
  })

  it('zatrzymuje się na limicie głębokości', async () => {
    const { limits } = clampLimits({ maxDepth: 1 })
    const result = await crawl(WITRYNA, { limits })
    expect(result.pages.map((p) => p.url)).not.toContain('https://przyklad.test/blog/wpis')
  })

  it('zatrzymuje się po wyczerpaniu budżetu czasu', async () => {
    const { limits } = clampLimits({ totalBudgetMs: 1500 })
    const result = await crawl(WITRYNA, { limits })
    expect(result.truncationReason).toBe('time-budget')
  })
})

describe('runCrawl — odpowiedzi nietypowe', () => {
  it('zapisuje przekierowanie razem z łańcuchem', async () => {
    const spec = {
      ...WITRYNA,
      'https://przyklad.test/oferta': { redirectTo: 'https://przyklad.test/oferta-nowa' },
      'https://przyklad.test/oferta-nowa': { html: htmlWithLinks('Oferta nowa', ['/']) },
    }
    const result = await crawl(spec)
    const page = result.pages.find((p) => p.url === 'https://przyklad.test/oferta-nowa')
    expect(page?.requestedUrl).toBe('https://przyklad.test/oferta')
    expect(page?.redirectChain).toEqual(['https://przyklad.test/oferta'])
  })

  it('zapisuje błąd pobrania jako stronę bez statusu i bez faktów', async () => {
    const spec = { ...WITRYNA, 'https://przyklad.test/oferta': { error: 'przekroczony czas' } }
    const result = await crawl(spec)
    const page = result.pages.find((p) => p.requestedUrl === 'https://przyklad.test/oferta')
    expect(page?.status).toBeNull()
    expect(page?.facts).toBeNull()
    expect(page?.error).toBe('przekroczony czas')
  })

  it('zapisuje odpowiedź inną niż HTML, ale jej nie parsuje', async () => {
    const spec = {
      ...WITRYNA,
      'https://przyklad.test/oferta': { html: '%PDF-1.7', contentType: 'application/pdf' },
    }
    const result = await crawl(spec)
    const page = result.pages.find((p) => p.url === 'https://przyklad.test/oferta')
    expect(page?.facts).toBeNull()
    expect(page?.contentType).toBe('application/pdf')
  })

  it('nie idzie za linkiem nofollow, ale zapisuje krawędź', async () => {
    const result = await crawl({
      'https://przyklad.test/':
        '<!DOCTYPE html><html lang="pl"><head><title>Start</title></head>'
        + '<body><h1>Start</h1><a href="/tajne" rel="nofollow">Tajne</a></body></html>',
      'https://przyklad.test/tajne': htmlWithLinks('Tajne', []),
    })
    expect(result.pages.map((p) => p.url)).toEqual(['https://przyklad.test/'])
    expect(result.links.map((l) => l.rel)).toEqual(['nofollow'])
  })
})

describe('runCrawl — mapa witryny', () => {
  it('bierze adresy z mapy do kolejki', async () => {
    const spec = {
      'https://przyklad.test/': htmlWithLinks('Start', []),
      'https://przyklad.test/osierocona': htmlWithLinks('Osierocona', []),
    }
    const result = await crawl(spec, { sitemapUrls: ['https://przyklad.test/osierocona'] })
    expect(result.pages.map((p) => p.url)).toContain('https://przyklad.test/osierocona')
    expect(result.pages.find((p) => p.url === 'https://przyklad.test/osierocona')?.inSitemap).toBe(true)
  })

  it('pomija adresy z mapy wskazujące na obcy host', async () => {
    const result = await crawl(
      { 'https://przyklad.test/': htmlWithLinks('Start', []) },
      { sitemapUrls: ['https://obca.test/cokolwiek'] },
    )
    expect(result.pages).toHaveLength(1)
  })
})
