import { describe, expect, it } from 'vitest'
import { readRobotsFixture } from './fixtures.test-helper.js'
import { crawlDelayFor, groupFor, isAllowed, parseRobotsTxt, pathWithQuery, productToken } from './robots.js'

const NASZ_AGENT = 'mentiometry-crawler/0.1 (+kontakt)'

describe('parseRobotsTxt', () => {
  const rules = parseRobotsTxt(readRobotsFixture('typowy.txt'))

  it('zbiera mapy witryny', () => {
    expect(rules.sitemaps).toEqual([
      'https://przyklad.test/sitemap.xml',
      'https://przyklad.test/sitemap-blog.xml',
    ])
  })

  it('scala sąsiadujące grupy User-agent w jedną', () => {
    const googlebot = groupFor(rules, 'Googlebot/2.1')
    expect(googlebot?.agents).toEqual(['googlebot', 'bingbot'])
    expect(googlebot?.disallow).toEqual(['/szukaj'])
  })

  it('czyta Crawl-delay', () => {
    expect(crawlDelayFor(rules, NASZ_AGENT)).toBe(2)
  })

  it('nie zwraca Crawl-delay, którego nie ma w grupie agenta', () => {
    expect(crawlDelayFor(rules, 'Googlebot/2.1')).toBeNull()
  })

  it('pomija komentarze i puste linie', () => {
    const parsed = parseRobotsTxt('# tylko komentarz\n\n   \n')
    expect(parsed.groups).toEqual([])
  })

  it('ignoruje dyrektywę przed jakimkolwiek User-agent', () => {
    expect(parseRobotsTxt('Disallow: /wszystko').groups).toEqual([])
  })
})

describe('isAllowed', () => {
  const rules = parseRobotsTxt(readRobotsFixture('typowy.txt'))

  it('blokuje ścieżkę objętą Disallow', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/koszyk')).toBe(false)
  })

  it('blokuje ścieżkę pod zablokowanym katalogiem', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/panel/ustawienia')).toBe(false)
  })

  it('najdłuższa pasująca reguła wygrywa — Allow odblokowuje podścieżkę', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/panel/pomoc')).toBe(true)
  })

  it('przepuszcza ścieżkę spoza reguł', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/blog/artykul')).toBe(true)
  })

  it('używa grupy własnego agenta, nie cudzej', () => {
    expect(isAllowed(rules, 'Googlebot/2.1', '/koszyk')).toBe(true)
    expect(isAllowed(rules, 'Googlebot/2.1', '/szukaj')).toBe(false)
  })

  it('przy równej długości reguł wygrywa Allow', () => {
    const rules2 = parseRobotsTxt('User-agent: *\nDisallow: /x\nAllow: /x')
    expect(isAllowed(rules2, NASZ_AGENT, '/x')).toBe(true)
  })

  it('brak grupy dla agenta i brak gwiazdki znaczy wolno', () => {
    const rules2 = parseRobotsTxt('User-agent: Bingbot\nDisallow: /')
    expect(isAllowed(rules2, NASZ_AGENT, '/cokolwiek')).toBe(true)
  })

  it('pusty Disallow nie blokuje niczego', () => {
    const rules2 = parseRobotsTxt('User-agent: *\nDisallow:')
    expect(isAllowed(rules2, NASZ_AGENT, '/cokolwiek')).toBe(true)
  })

  it('Disallow: / blokuje wszystko łącznie z korzeniem', () => {
    const rules2 = parseRobotsTxt(readRobotsFixture('zakaz-wszystkiego.txt'))
    expect(isAllowed(rules2, NASZ_AGENT, '/')).toBe(false)
    expect(isAllowed(rules2, NASZ_AGENT, '/glebiej/jeszcze')).toBe(false)
  })
})

describe('isAllowed — wzorce * i $', () => {
  const rules = parseRobotsTxt(readRobotsFixture('wzorce.txt'))

  it('kotwica $ dopasowuje tylko koniec ścieżki', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/dokumenty/cennik.pdf')).toBe(false)
    expect(isAllowed(rules, NASZ_AGENT, '/dokumenty/cennik.pdf.html')).toBe(true)
  })

  it('gwiazdka dopasowuje dowolny ciąg w środku', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/lista?sesja=abc')).toBe(false)
    expect(isAllowed(rules, NASZ_AGENT, '/lista?strona=2')).toBe(true)
  })

  it('dłuższy Allow wygrywa z krótszym Disallow', () => {
    expect(isAllowed(rules, NASZ_AGENT, '/prywatne/dokument')).toBe(false)
    expect(isAllowed(rules, NASZ_AGENT, '/prywatne/publiczne/x')).toBe(true)
  })

  it('znaki specjalne wyrażeń regularnych nie wysadzają parsera', () => {
    const rules2 = parseRobotsTxt('User-agent: *\nDisallow: /a+b(c)[d]')
    expect(isAllowed(rules2, NASZ_AGENT, '/a+b(c)[d]/x')).toBe(false)
    expect(isAllowed(rules2, NASZ_AGENT, '/aab')).toBe(true)
  })
})

describe('dopasowanie agenta', () => {
  it('token produktu odcina wersję i komentarz', () => {
    expect(productToken(NASZ_AGENT)).toBe('mentiometry-crawler')
  })

  it('wygrywa najdłuższy pasujący prefiks', () => {
    const rules = parseRobotsTxt(
      'User-agent: mentiometry\nDisallow: /a\n\nUser-agent: mentiometry-crawler\nDisallow: /b',
    )
    expect(isAllowed(rules, NASZ_AGENT, '/a')).toBe(true)
    expect(isAllowed(rules, NASZ_AGENT, '/b')).toBe(false)
  })

  it('dopasowanie nie zależy od wielkości liter', () => {
    const rules = parseRobotsTxt('User-agent: MENTIOMETRY-CRAWLER\nDisallow: /x')
    expect(isAllowed(rules, NASZ_AGENT, '/x')).toBe(false)
  })
})

describe('pathWithQuery', () => {
  it('zwraca ścieżkę razem z zapytaniem', () => {
    expect(pathWithQuery('https://przyklad.test/a/b?c=1')).toBe('/a/b?c=1')
  })

  it('adres bez ścieżki daje ukośnik', () => {
    expect(pathWithQuery('https://przyklad.test')).toBe('/')
  })
})
