import { describe, expect, it } from 'vitest'
import {
  BLAST_RADIUS_MAX, DEFAULT_ACTIONS, REGRESSION_THRESHOLD,
  actionTable, checkBreakers, gateFor, policyFor, type BreakerInput,
} from './policy.js'

const TABELA = actionTable()

const spokojnie = (o: Partial<BreakerInput> = {}): BreakerInput => ({
  clicksThisWeek: 100, clicksLastWeek: 100,
  indexedPages: 1000, affectedPages: 1,
  publicationRateAllowed: true, publicationRateReason: 'dzis 0/3',
  ...o,
})

describe('policyFor', () => {
  it('zna polityki z tabeli bezpiecznikow', () => {
    expect(policyFor(TABELA, 'crawl')).toBe('auto')
    expect(policyFor(TABELA, 'publish-article')).toBe('approve')
    expect(policyFor(TABELA, 'redirects')).toBe('approve')
  })

  it('AC4: typ akcji bez wpisu jest traktowany jako never', () => {
    expect(policyFor(TABELA, 'cos-czego-jeszcze-nie-ma')).toBe('never')
  })

  it('wymiana linkow jest never, nie approve', () => {
    // Tabela w analizie mowi „zatwierdzenie", ale ta sama analiza dwie strony
    // dalej nazywa to link scheme z ryzykiem kary manualnej. Akcja, ktorej nie
    // wolno wykonac nigdy, nie powinna dac sie zatwierdzic jednym klikni eciem.
    expect(policyFor(TABELA, 'link-exchange')).toBe('never')
    // Outreach zostaje — to ta sama robota bez ekspozycji na kare.
    expect(policyFor(TABELA, 'outreach-draft')).toBe('approve')
  })

  it('kazda akcja ma niepuste uzasadnienie', () => {
    for (const akcja of DEFAULT_ACTIONS) {
      expect(akcja.note.length).toBeGreaterThan(0)
    }
  })

  it('zadna akcja zmieniajaca strone nieodwracalnie nie jest auto', () => {
    const ryzykowne = ['redirects', 'canonical', 'robots-noindex', 'publish-article']
    for (const kind of ryzykowne) {
      expect(policyFor(TABELA, kind)).not.toBe('auto')
    }
  })
})

describe('checkBreakers', () => {
  it('akcje tylko do odczytu nie podlegaja wylacznikom', () => {
    // Crawl i audyt maja chodzic takze wtedy, gdy ruch leci w dol — to wtedy
    // sa najbardziej potrzebne.
    const katastrofa = spokojnie({
      clicksThisWeek: 10, clicksLastWeek: 100,
      affectedPages: 900, publicationRateAllowed: false,
    })
    expect(checkBreakers(katastrofa, false)).toEqual([])
  })

  it('D52: spadek klikniec ponad prog wstrzymuje zapisy', () => {
    const tripped = checkBreakers(spokojnie({ clicksThisWeek: 70, clicksLastWeek: 100 }), true)
    expect(tripped.map((t) => t.id)).toContain('regression')
    expect(tripped[0]?.reason).toContain('30%')
    expect(tripped[0]?.reason).toContain('kopac szybciej')
  })

  it('spadek dokladnie na progu jeszcze nie wstrzymuje', () => {
    const naProgu = 100 * (1 - REGRESSION_THRESHOLD)
    expect(checkBreakers(spokojnie({ clicksThisWeek: naProgu, clicksLastWeek: 100 }), true))
      .toEqual([])
  })

  it('brak ruchu w zeszlym tygodniu nie liczy sie jako spadek o 100%', () => {
    // Dzielenie przez zero dalo by nieskonczonosc i zablokowaloby nowy serwis
    // na zawsze.
    expect(checkBreakers(spokojnie({ clicksThisWeek: 0, clicksLastWeek: 0 }), true)).toEqual([])
  })

  it('D52: zasieg razenia ponad limit wstrzymuje', () => {
    const tripped = checkBreakers(spokojnie({ indexedPages: 100, affectedPages: 10 }), true)
    expect(tripped.map((t) => t.id)).toContain('blast-radius')
    expect(tripped[0]?.reason).toContain('10 z 100')
  })

  it('zasieg dokladnie na limicie przechodzi', () => {
    const naLimicie = 1000 * BLAST_RADIUS_MAX
    expect(checkBreakers(spokojnie({ indexedPages: 1000, affectedPages: naLimicie }), true))
      .toEqual([])
  })

  it('wyczerpany limit tempa jest wylacznikiem, a nie ostrzezeniem', () => {
    const tripped = checkBreakers(spokojnie({
      publicationRateAllowed: false, publicationRateReason: 'limit dzienny wyczerpany (3/3)',
    }), true)
    expect(tripped.map((t) => t.id)).toEqual(['publication-rate'])
    expect(tripped[0]?.reason).toContain('3/3')
  })

  it('kilka wylacznikow naraz melduje sie wszystkie', () => {
    const tripped = checkBreakers(spokojnie({
      clicksThisWeek: 10, clicksLastWeek: 100,
      indexedPages: 100, affectedPages: 50,
      publicationRateAllowed: false, publicationRateReason: 'limit',
    }), true)
    expect(tripped.map((t) => t.id).sort())
      .toEqual(['blast-radius', 'publication-rate', 'regression'])
  })

  it('serwis bez zaindeksowanych stron nie wywraca rachunku zasiegu', () => {
    expect(checkBreakers(spokojnie({ indexedPages: 0, affectedPages: 5 }), true)).toEqual([])
  })
})

describe('gateFor', () => {
  it('akcja auto przy spokojnych wskaznikach idzie sama', () => {
    expect(gateFor(TABELA, 'internal-links', spokojnie())).toEqual({ kind: 'auto' })
  })

  it('akcja approve czeka na czlowieka i mowi dlaczego', () => {
    const bramka = gateFor(TABELA, 'publish-article', spokojnie())
    expect(bramka.kind).toBe('needs-approval')
    if (bramka.kind !== 'needs-approval') return
    expect(bramka.reason).toContain('pull request')
  })

  it('AC9: wylacznik BIJE polityke auto — nie schodzi do approve', () => {
    const bramka = gateFor(TABELA, 'internal-links', spokojnie({
      clicksThisWeek: 50, clicksLastWeek: 100,
    }))
    expect(bramka.kind).toBe('blocked')
    if (bramka.kind !== 'blocked') return
    expect(bramka.breaker).toBe('regression')
  })

  it('wylacznik blokuje takze akcje wymagajaca zatwierdzenia', () => {
    // Inaczej wystarczyloby kliknac „zatwierdz", zeby ominac hamulec.
    const bramka = gateFor(TABELA, 'publish-article', spokojnie({
      clicksThisWeek: 50, clicksLastWeek: 100,
    }))
    expect(bramka.kind).toBe('blocked')
  })

  it('AC4: nieznany typ akcji jest blokowany z wyjasnieniem', () => {
    const bramka = gateFor(TABELA, 'nowa-akcja', spokojnie())
    expect(bramka.kind).toBe('blocked')
    if (bramka.kind !== 'blocked') return
    expect(bramka.breaker).toBeNull()
    expect(bramka.reason).toContain('nie ma wpisu w tabeli polityk')
    expect(bramka.reason).toContain('D47')
  })

  it('akcja never jest blokowana z powodem z tabeli', () => {
    const bramka = gateFor(TABELA, 'link-exchange', spokojnie())
    expect(bramka.kind).toBe('blocked')
    if (bramka.kind !== 'blocked') return
    expect(bramka.reason).toContain('link scheme')
  })

  it('akcja tylko do odczytu idzie sama nawet przy wylacznikach', () => {
    expect(gateFor(TABELA, 'crawl', spokojnie({
      clicksThisWeek: 1, clicksLastWeek: 100, publicationRateAllowed: false,
    }))).toEqual({ kind: 'auto' })
  })

  it('kilka wylacznikow naraz podaje wszystkie powody', () => {
    const bramka = gateFor(TABELA, 'internal-links', spokojnie({
      clicksThisWeek: 10, clicksLastWeek: 100, indexedPages: 100, affectedPages: 50,
    }))
    if (bramka.kind !== 'blocked') throw new Error('spodziewano sie blokady')
    expect(bramka.reason).toContain('spadly')
    expect(bramka.reason).toContain('50 z 100')
  })

  it('wlasna tabela akcji zastepuje domyslna', () => {
    const wlasna = actionTable([
      { kind: 'moja-akcja', policy: 'auto', writesSite: false, note: 'test' },
    ])
    expect(gateFor(wlasna, 'moja-akcja', spokojnie())).toEqual({ kind: 'auto' })
    // Akcje z domyslnej tabeli w niej nie istnieja, wiec sa never.
    expect(gateFor(wlasna, 'crawl', spokojnie()).kind).toBe('blocked')
  })
})
