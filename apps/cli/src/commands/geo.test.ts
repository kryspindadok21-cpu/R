import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, closeDatabase, geoRepos, repos } from '@seo/db'
import type { EngineAnswer, EnginePrompt, LlmEngineProvider } from '@seo/providers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  NoEntityError, NoPromptSetError, UnknownSiteError,
  activePromptSet, latestEntityVersions, runGeoEntity, runGeoPrompts, runGeoRun,
} from './geo.js'
import { openInitialized } from './init.js'

const BASE = 'https://przyklad.test/'
const scope = tenantScope('local')

let dir: string
let db: Db

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-geo-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db
  repos(db, scope).write.upsertSite('url_prefix', BASE)
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

/** Atrapa silnika: oddaje z gory ustalone odpowiedzi, bez sieci (AC9). */
function atrapaSilnika(
  id: 'gemini' | 'groq',
  odpowiedzi: readonly Partial<EngineAnswer>[],
): LlmEngineProvider & { readonly zapytania: readonly string[] } {
  const zapytania: string[] = []
  let i = 0
  return {
    id,
    modelVersion: `${id}-test`,
    accessMode: 'api',
    zapytania,
    async ask(prompt: EnginePrompt, runIndex: number): Promise<EngineAnswer> {
      zapytania.push(`${prompt.promptId}|${runIndex}`)
      const wzorzec = odpowiedzi[i % Math.max(1, odpowiedzi.length)] ?? {}
      i += 1
      return {
        promptId: prompt.promptId, runIndex,
        text: '', refusalReason: null, fetchError: null,
        latencyMs: 10, groundingUris: [],
        ...wzorzec,
      }
    },
  }
}

function przygotujMarke(): void {
  runGeoEntity(db, scope, {
    siteUrl: BASE, name: 'Mentiometry', variants: ['Mentiometrym'],
    exclusions: [], isOwn: true,
  })
}

describe('activePromptSet', () => {
  it('wybiera najwyzsza wersje o danej nazwie', () => {
    const zestawy = [
      { id: 'a', name: 'domyslny', version: 1 },
      { id: 'b', name: 'domyslny', version: 3 },
      { id: 'c', name: 'inny', version: 9 },
    ]
    expect(activePromptSet(zestawy, 'domyslny')?.id).toBe('b')
    expect(activePromptSet(zestawy, 'inny')?.id).toBe('c')
    expect(activePromptSet([], 'domyslny')).toBeUndefined()
  })
})

describe('latestEntityVersions', () => {
  it('zostawia najnowsza wersje kazdej nazwy', () => {
    const encje = [
      { id: '1', name: 'A', variants: [], exclusions: [], version: 1 },
      { id: '2', name: 'A', variants: ['x'], exclusions: [], version: 2 },
      { id: '3', name: 'B', variants: [], exclusions: [], version: 1 },
    ]
    const wynik = latestEntityVersions(encje)
    expect(wynik.map((e) => e.id).sort()).toEqual(['2', '3'])
  })
})

describe('seo geo prompts', () => {
  it('pierwsze wywolanie zaklada zestaw', () => {
    const wynik = runGeoPrompts(db, scope, { siteUrl: BASE, add: ['Pytanie pierwsze'] })
    expect(wynik.version).toBe(1)
    expect(wynik.total).toBe(1)
    expect(wynik.frozen).toBe(false)
  })

  it('kolejne wywolanie dokłada do tego samego zestawu', () => {
    runGeoPrompts(db, scope, { siteUrl: BASE, add: ['A'] })
    const wynik = runGeoPrompts(db, scope, { siteUrl: BASE, add: ['B', 'C'] })
    expect(wynik.version).toBe(1)
    expect(wynik.total).toBe(3)
  })

  it('D25: dopisanie do zamrozonego zestawu zaklada nowa wersje, a nie edytuje', async () => {
    runGeoPrompts(db, scope, { siteUrl: BASE, add: ['A'] })
    przygotujMarke()
    await runGeoRun(db, scope, [atrapaSilnika('groq', [{ text: 'nic' }])], [], {
      siteUrl: BASE, runsPerPrompt: 1,
    })

    const wynik = runGeoPrompts(db, scope, { siteUrl: BASE, add: ['B'] })
    expect(wynik.version).toBe(2)
    // Nowa wersja przenosi stary sklad i dokłada nowy prompt.
    expect(wynik.total).toBe(2)

    // Stary zestaw zostaje nietkniety — pomiar sprzed zmiany nadal da sie odtworzyc.
    const zestawy = geoRepos(db, scope).read.listPromptSets(
      repos(db, scope).read.findSiteByUri(BASE)!.id,
    )
    const stary = zestawy.find((z) => z.version === 1)
    expect(geoRepos(db, scope).read.listPrompts(stary!.id)).toHaveLength(1)
    expect(zestawy.find((z) => z.version === 2)?.supersedesId).toBe(stary!.id)
  })

  it('nieznana strona mowi, co zrobic', () => {
    expect(() => runGeoPrompts(db, scope, { siteUrl: 'https://obca.test/', add: ['A'] }))
      .toThrow(UnknownSiteError)
  })
})

describe('seo geo entity', () => {
  it('pierwsza definicja to wersja 1', () => {
    const wynik = runGeoEntity(db, scope, {
      siteUrl: BASE, name: 'Mentiometry', variants: [], exclusions: [], isOwn: true,
    })
    expect(wynik.version).toBe(1)
    expect(wynik.supersededVersion).toBeNull()
  })

  it('D29: zmiana wariantow podnosi wersje i zostawia stara definicje', () => {
    runGeoEntity(db, scope, {
      siteUrl: BASE, name: 'Mentiometry', variants: [], exclusions: [], isOwn: true,
    })
    const wynik = runGeoEntity(db, scope, {
      siteUrl: BASE, name: 'Mentiometry', variants: ['Mentiometrym'], exclusions: [], isOwn: true,
    })
    expect(wynik.version).toBe(2)
    expect(wynik.supersededVersion).toBe(1)

    const siteId = repos(db, scope).read.findSiteByUri(BASE)!.id
    expect(geoRepos(db, scope).read.listEntities(siteId)).toHaveLength(2)
  })
})

describe('seo geo run', () => {
  beforeEach(() => {
    runGeoPrompts(db, scope, { siteUrl: BASE, add: ['Jakie narzedzie do GEO?'] })
    przygotujMarke()
  })

  it('pyta kazdy prompt tyle razy, ile ustawiono', async () => {
    const silnik = atrapaSilnika('groq', [{ text: 'nic' }])
    await runGeoRun(db, scope, [silnik], [], { siteUrl: BASE, runsPerPrompt: 3 })
    expect(silnik.zapytania).toHaveLength(3)
    expect(silnik.zapytania.map((z) => z.split('|')[1])).toEqual(['0', '1', '2'])
  })

  it('liczy widocznosc z przedzialem, a nie sama liczba', async () => {
    const silnik = atrapaSilnika('groq', [
      { text: 'Polecam Mentiometry.' }, { text: 'Nie znam.' }, { text: 'Nie znam.' },
    ])
    const wynik = await runGeoRun(db, scope, [silnik], [], { siteUrl: BASE, runsPerPrompt: 3 })
    const [outcome] = wynik.outcomes
    expect(outcome?.visibility.rate).toBeCloseTo(1 / 3, 10)
    expect(outcome?.visibility.interval.high).toBeGreaterThan(outcome?.visibility.rate ?? 0)
  })

  it('zapisuje wzmianki i cytowania w rozdziale na zrodla', async () => {
    const silnik = atrapaSilnika('gemini', [{
      text: 'Polecam Mentiometry, zobacz https://inny.test/a',
      groundingUris: ['https://przyklad.test/blog'],
    }])
    const wynik = await runGeoRun(db, scope, [silnik], [], { siteUrl: BASE, runsPerPrompt: 1 })
    const runId = wynik.outcomes[0]!.runId
    const g = geoRepos(db, scope)

    expect(g.read.listMentions(runId)).toHaveLength(1)
    const grounding = g.read.listCitations(runId, 'grounding')
    const inline = g.read.listCitations(runId, 'inline')
    expect(grounding).toHaveLength(1)
    expect(grounding[0]?.ours).toBe(1)
    expect(inline).toHaveLength(1)
    expect(inline[0]?.ours).toBe(0)
  })

  it('odmowa modelu liczy sie jako odpowiedz bez wzmianki, nie jako awaria', async () => {
    const silnik = atrapaSilnika('groq', [{ text: '', refusalReason: 'filtr bezpieczenstwa' }])
    const wynik = await runGeoRun(db, scope, [silnik], [], { siteUrl: BASE, runsPerPrompt: 1 })
    const [outcome] = wynik.outcomes
    expect(outcome?.answersOk).toBe(1)
    expect(outcome?.answersFailed).toBe(0)
    expect(outcome?.refusals).toBe(1)
    expect(outcome?.visibility.hits).toBe(0)
    expect(outcome?.visibility.trials).toBe(1)
  })

  it('nieudane wywolanie nie liczy sie jako proba i podaje powod', async () => {
    const silnik = atrapaSilnika('groq', [{ fetchError: 'ECONNRESET' }])
    const wynik = await runGeoRun(db, scope, [silnik], [], { siteUrl: BASE, runsPerPrompt: 1 })
    const [outcome] = wynik.outcomes
    expect(outcome?.answersFailed).toBe(1)
    expect(outcome?.lastError).toBe('ECONNRESET')
    // Nieudane wywolanie to brak pomiaru, a nie pomiar zerowy — inaczej awaria
    // sieci wygladalaby jak spadek widocznosci.
    expect(outcome?.visibility.trials).toBe(0)
  })

  it('AC7: pominiete silniki wracaja w wyniku, a nie znikaja', async () => {
    const pominiete = [{ id: 'gemini' as const, reason: 'brak klucza — ustaw SEO_GEMINI_KEY' }]
    const wynik = await runGeoRun(db, scope, [atrapaSilnika('groq', [{ text: 'x' }])], pominiete, {
      siteUrl: BASE, runsPerPrompt: 1,
    })
    expect(wynik.skipped).toEqual(pominiete)
    expect(wynik.outcomes.map((o) => o.engine)).toEqual(['groq'])
  })

  it('brak silnikow nie wybucha — zwraca pusty wynik z lista pominietych', async () => {
    const pominiete = [
      { id: 'gemini' as const, reason: 'brak klucza' },
      { id: 'groq' as const, reason: 'brak klucza' },
    ]
    const wynik = await runGeoRun(db, scope, [], pominiete, { siteUrl: BASE })
    expect(wynik.outcomes).toEqual([])
    expect(wynik.skipped).toHaveLength(2)
  })

  it('D27: przebieg zapisuje trojke silnik/wersja/tryb', async () => {
    const wynik = await runGeoRun(db, scope, [atrapaSilnika('groq', [{ text: 'x' }])], [], {
      siteUrl: BASE, runsPerPrompt: 1,
    })
    const run = geoRepos(db, scope).read.getGeoRun(wynik.outcomes[0]!.runId)
    expect(run?.engine).toBe('groq')
    expect(run?.modelVersion).toBe('groq-test')
    expect(run?.accessMode).toBe('api')
    expect(run?.entityVersion).toBe(wynik.entityVersion)
  })
})

describe('seo geo run bez przygotowania', () => {
  it('brak promptow mowi, jak je dodac', async () => {
    przygotujMarke()
    await expect(runGeoRun(db, scope, [], [], { siteUrl: BASE })).rejects.toThrow(NoPromptSetError)
  })

  it('brak wlasnej marki mowi, jak ja zdefiniowac', async () => {
    runGeoPrompts(db, scope, { siteUrl: BASE, add: ['A'] })
    runGeoEntity(db, scope, {
      siteUrl: BASE, name: 'Konkurent', variants: [], exclusions: [], isOwn: false,
    })
    await expect(runGeoRun(db, scope, [], [], { siteUrl: BASE })).rejects.toThrow(NoEntityError)
  })
})
