import { tenantScope } from '@seo/core'
import { approveDraft, buildBrief, type DraftInput as CzystyDraft } from '@seo/content'
import { clusterByLexicalOverlap, clusterBySerpOverlap, decideCoverage } from '@seo/keywords'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './connection.js'
import {
  DAILY_PUBLICATION_FLOOR, MixedClusterMethodError, UnapprovedDraftError, contentRepos,
} from './content-repo.js'
import { migrate } from './migrate.js'
import { CONTENT_READ_METHOD_ARGS } from './read-fixtures.js'
import { repos } from './repo.js'

const A = tenantScope('tenant-a')
const B = tenantScope('tenant-b')
const OBCY = 'obcy-marker-tresc'

interface Seeded {
  siteId: string; clusterSetId: string; clusterId: string; briefId: string; draftId: string
}

const TRESC = (marker: string) => `
Zmierzyliśmy widoczność ${marker} w odpowiedziach trzech modeli językowych przez
sześć tygodni. Model z dostępem do wyszukiwarki wymieniał nas o jedenaście
punktów procentowych częściej niż ten sam model odpowiadający z pamięci.
Różnica utrzymała się w każdym tygodniu pomiaru i nie dało się jej wytłumaczyć.
`

const OBCA_TRESC = 'Kwas foliowy w diecie kobiet w ciąży jest przedmiotem badań '
  + 'od lat siedemdziesiątych, a zalecana dawka wynosi czterysta mikrogramów.'

function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  const seeds = new Map<string, Seeded>()

  for (const [scope, marker, host] of [[A, 'marker-a', 'a'], [B, OBCY, 'b']] as const) {
    const base = repos(db, scope)
    base.write.ensureTenant(scope.tenantId)
    const site = base.write.upsertSite('url_prefix', `https://${host}.example/`)

    const c = contentRepos(db, scope)
    const clusterSetId = c.write.createClusterSet(site.id, {
      method: 'lexical-overlap', fromDate: '2026-08-01', toDate: '2026-08-31',
    })

    const cluster = clusterByLexicalOverlap([
      { query: `audyt ${marker}`, impressions: 500, clicks: 10, position: 11.2 },
    ])[0]!
    const [clusterId] = c.write.insertClusters(clusterSetId, [cluster])

    const coverage = decideCoverage(cluster, [])
    const brief = buildBrief({ cluster, coverage, linkCandidates: [] })
    const briefId = c.write.insertBrief(site.id, {
      clusterId: clusterId as string, brief, markdown: `# Brief ${marker}`,
    })

    const wejscie: CzystyDraft = {
      title: `Artykul ${marker}`,
      markdown: TRESC(marker),
      author: { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' },
      uniqueAssets: [{ kind: 'own-data', description: 'sześć tygodni pomiaru', source: 'tracker' }],
      engine: 'groq', modelVersion: 'llama-test', promptId: `prompt-${marker}`,
    }
    const zatwierdzenie = approveDraft(wejscie, { corpus: [{ id: 'obcy', text: OBCA_TRESC }] })
    if (zatwierdzenie.kind !== 'approved') throw new Error('fikstura miala przejsc bramki')

    const draftId = c.write.insertDraft(site.id, {
      briefId, title: wejscie.title, markdown: wejscie.markdown,
      authorName: wejscie.author.name, authorSameAs: wejscie.author.sameAs,
      uniqueAssets: wejscie.uniqueAssets,
      engine: wejscie.engine, modelVersion: wejscie.modelVersion, promptId: wejscie.promptId,
      approved: true, gateFailures: [], originality: zatwierdzenie.draft.originality,
    })

    const publicationId = c.write.createPublication(site.id, {
      draftId, branch: `tresc/${marker}`, filePath: `content/${marker}.md`,
    })
    c.write.markPublicationOpened(publicationId, `https://github.test/${marker}/pull/1`)

    seeds.set(scope.tenantId, {
      siteId: site.id, clusterSetId, clusterId: clusterId as string, briefId, draftId,
    })
  }

  return { db, seeds }
}

describe('izolacja tenantow w repozytoriach tresci', () => {
  let db: ReturnType<typeof openDatabase>
  let seeds: Map<string, Seeded>

  beforeEach(() => { ({ db, seeds } = seeded()) })

  it('kazda metoda odczytu ma wpis w rejestrze argumentow', () => {
    const declared = Object.keys(contentRepos(db, A).read).sort()
    expect(declared).toEqual(Object.keys(CONTENT_READ_METHOD_ARGS).sort())
  })

  it.each(Object.keys(CONTENT_READ_METHOD_ARGS))('%s nie zwraca danych obcego tenanta', (name) => {
    const foreign = seeds.get('tenant-b')
    if (!foreign) throw new Error('brak danych tenanta B')
    const read = contentRepos(db, A).read as Record<string, (...a: unknown[]) => unknown>
    const args = CONTENT_READ_METHOD_ARGS[name]!({
      marker: OBCY, date: '2026-03-01',
      siteId: foreign.siteId, clusterSetId: foreign.clusterSetId,
      briefId: foreign.briefId, draftId: foreign.draftId,
    })
    const json = JSON.stringify(read[name]!(...args) ?? null)

    expect(json).not.toContain('tenant-b')
    expect(json).not.toContain(OBCY)
    expect(json).not.toContain(foreign.siteId)
    expect(json).not.toContain(foreign.briefId)
  })
})

describe('zapis i odczyt tresci', () => {
  let db: ReturnType<typeof openDatabase>
  let own: Seeded

  beforeEach(() => {
    const seed = seeded()
    db = seed.db
    const mine = seed.seeds.get('tenant-a')
    if (!mine) throw new Error('brak danych tenanta A')
    own = mine
  })

  it('D33: klaster o innej metodzie niz zestaw jest bledem, nie ostrzezeniem', () => {
    const c = contentRepos(db, A)
    const serpowy = clusterBySerpOverlap(
      [{ query: 'inna fraza', impressions: 10, clicks: 0, position: 5 }],
      [{ query: 'inna fraza', urls: ['https://x.test/1'] }],
    )
    expect(() => c.write.insertClusters(own.clusterSetId, serpowy))
      .toThrow(MixedClusterMethodError)
  })

  it('klaster zachowuje rozroznienie miedzy „zero wspolnych" a „nie wiemy"', () => {
    const c = contentRepos(db, A)
    const [klaster] = c.read.listClusters(own.clusterSetId)
    // Metoda leksykalna nie widzi zadnych adresow, wiec null, nie zero.
    expect(klaster?.sharedUrls).toBeNull()
  })

  it('D38: brief zawsze niesie niepusty powod decyzji', () => {
    const brief = contentRepos(db, A).read.getBrief(own.briefId)
    expect(brief?.decision).toBe('create')
    expect(brief?.decisionReason.length).toBeGreaterThan(0)
    expect(brief?.targetUrl).toBeNull()
  })

  it('D40: draft niesie silnik, wersje modelu i prompt', () => {
    const draft = contentRepos(db, A).read.getDraft(own.draftId)
    expect(draft?.engine).toBe('groq')
    expect(draft?.modelVersion).toBe('llama-test')
    expect(draft?.promptId).toBe('prompt-marker-a')
  })

  it('odrzucony draft tez jest zapisywany, razem z powodami', () => {
    const c = contentRepos(db, A)
    const id = c.write.insertDraft(own.siteId, {
      briefId: own.briefId, title: 'Odpad', markdown: 'krotko',
      authorName: '', authorSameAs: 'nie-adres', uniqueAssets: [],
      engine: 'groq', modelVersion: 'llama-test', promptId: 'p',
      approved: false,
      gateFailures: [{ gate: 'unique-asset', reason: 'brak zasobu' }],
      originality: {},
    })
    const draft = c.read.getDraft(id)
    expect(draft?.approved).toBe(0)
    expect(JSON.parse(draft?.gateFailures ?? '[]')).toHaveLength(1)
  })

  it('AC4: publikacja niezatwierdzonego draftu jest niemozliwa takze przez baze', () => {
    const c = contentRepos(db, A)
    const odrzucony = c.write.insertDraft(own.siteId, {
      briefId: own.briefId, title: 'Odpad', markdown: 'krotko',
      authorName: 'X', authorSameAs: 'https://a.test/', uniqueAssets: [],
      engine: 'groq', modelVersion: 'llama-test', promptId: 'p',
      approved: false, gateFailures: [{ gate: 'unique-asset', reason: 'brak' }], originality: {},
    })
    expect(() => c.write.createPublication(own.siteId, {
      draftId: odrzucony, branch: 'tresc/odpad', filePath: 'content/odpad.md',
    })).toThrow(UnapprovedDraftError)
  })

  it('D35: publikacja zaczyna sie jako prepared, a merged ustawia czlowiek', () => {
    const c = contentRepos(db, A)
    const publikacja = c.read.getPublication(own.draftId)
    expect(publikacja?.state).toBe('opened')
    expect(publikacja?.prUrl).toContain('/pull/1')
    // Galaz nigdy nie jest domyslna.
    expect(publikacja?.branch).toBe('tresc/marker-a')

    c.write.setPublicationState(publikacja!.id, 'merged')
    expect(c.read.getPublication(own.draftId)?.state).toBe('merged')
  })
})

describe('D43: limit tempa publikacji', () => {
  let db: ReturnType<typeof openDatabase>
  let own: Seeded

  beforeEach(() => {
    const seed = seeded()
    db = seed.db
    own = seed.seeds.get('tenant-a')!
  })

  it('liczy publikacje z tabeli, a nie z osobnego licznika', () => {
    const status = contentRepos(db, A).read.publicationRate(own.siteId, 100, Date.now())
    expect(status.publishedToday).toBe(1)
    expect(status.publishedThisMonth).toBe(1)
    expect(status.allowed).toBe(true)
  })

  it('wyczerpany limit dzienny wstrzymuje i mowi, kiedy wrocic', () => {
    const c = contentRepos(db, A)
    for (let i = 1; i < DAILY_PUBLICATION_FLOOR; i += 1) {
      const draftId = c.write.insertDraft(own.siteId, {
        briefId: own.briefId, title: `T${i}`, markdown: 'x',
        authorName: 'A', authorSameAs: 'https://a.test/', uniqueAssets: [],
        engine: 'groq', modelVersion: 'm', promptId: 'p',
        approved: true, gateFailures: [], originality: {},
      })
      c.write.createPublication(own.siteId, {
        draftId, branch: `tresc/${i}`, filePath: `content/${i}.md`,
      })
    }
    const status = c.read.publicationRate(own.siteId, 100, Date.now())
    expect(status.publishedToday).toBe(DAILY_PUBLICATION_FLOOR)
    expect(status.allowed).toBe(false)
    expect(status.reason).toContain('limit dzienny')
    expect(status.reason).toContain('24 godzinach')
  })

  it('publikacje sprzed miesiaca nie licza sie do zadnego okna', () => {
    const zaMiesiac = Date.now() + 40 * 24 * 60 * 60 * 1000
    const status = contentRepos(db, A).read.publicationRate(own.siteId, 100, zaMiesiac)
    expect(status.publishedToday).toBe(0)
    expect(status.publishedThisMonth).toBe(0)
    expect(status.allowed).toBe(true)
  })

  it('limit miesieczny rosnie z rozmiarem serwisu, ale ma podloge', () => {
    const c = contentRepos(db, A)
    const maly = c.read.publicationRate(own.siteId, 4, Date.now())
    const duzy = c.read.publicationRate(own.siteId, 10_000, Date.now())
    expect(maly.monthlyLimit).toBe(90)
    expect(duzy.monthlyLimit).toBe(1000)
  })
})
