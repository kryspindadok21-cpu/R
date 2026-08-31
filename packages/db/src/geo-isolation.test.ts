import { tenantScope } from '@seo/core'
import { collectCitations, detectMentions } from '@seo/geo'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './connection.js'
import { FrozenPromptSetError, geoRepos } from './geo-repo.js'
import { migrate } from './migrate.js'
import { GEO_READ_METHOD_ARGS } from './read-fixtures.js'
import { repos } from './repo.js'

const A = tenantScope('tenant-a')
const B = tenantScope('tenant-b')
const OBCY = 'obcy-marker-geo'

interface Seeded { siteId: string; promptSetId: string; runId: string; entityId: string }

/** Zaklada pelny przebieg GEO dla obu tenantow, kazdy ze swoim markerem. */
function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  const seeds = new Map<string, Seeded>()

  for (const [scope, marker, host] of [[A, 'marker-a', 'a'], [B, OBCY, 'b']] as const) {
    const base = repos(db, scope)
    base.write.ensureTenant(scope.tenantId)
    const site = base.write.upsertSite('url_prefix', `https://${host}.example/`)

    const g = geoRepos(db, scope)
    const promptSetId = g.write.createPromptSet(site.id, { name: `zestaw-${marker}` })
    const [promptId] = g.write.addPrompts(promptSetId, [
      { text: `Jakie narzedzie do ${marker}?`, locale: 'pl' },
    ])
    const entityId = g.write.upsertEntity(site.id, {
      name: marker, variants: [], exclusions: [], isOwn: true,
    })

    const runId = g.write.startGeoRun(site.id, {
      promptSetId, engine: `silnik-${marker}`, modelVersion: `wersja-${marker}`,
      accessMode: 'api_grounded', entityVersion: 1, runsPerPrompt: 3,
    })

    const tekst = `Polecam ${marker}, zobacz https://${marker}.example/blog po wiecej.`
    const answerId = g.write.insertAnswer(runId, {
      promptId: promptId as string, runIndex: 0, text: tekst,
      refusalReason: null, fetchError: null, latencyMs: 120,
    })

    const entity = { id: entityId, name: marker, variants: [], exclusions: [], version: 1 }
    g.write.insertMentions(runId, answerId, detectMentions(tekst, [entity]).mentions)
    const cytowania = collectCitations(
      { text: tekst, groundingUris: [`https://${marker}.example/zrodlo`] },
      [`${marker}.example`],
    )
    g.write.insertCitations(runId, answerId, [...cytowania.grounding, ...cytowania.inline])
    g.write.finishGeoRun(runId, { ok: true, answersOk: 1, answersFailed: 0 })

    seeds.set(scope.tenantId, { siteId: site.id, promptSetId, runId, entityId })
  }

  return { db, seeds }
}

describe('izolacja tenantow w repozytoriach GEO', () => {
  let db: ReturnType<typeof openDatabase>
  let seeds: Map<string, Seeded>

  beforeEach(() => { ({ db, seeds } = seeded()) })

  it('kazda metoda odczytu ma wpis w rejestrze argumentow', () => {
    const declared = Object.keys(geoRepos(db, A).read).sort()
    expect(declared).toEqual(Object.keys(GEO_READ_METHOD_ARGS).sort())
  })

  it.each(Object.keys(GEO_READ_METHOD_ARGS))('%s nie zwraca danych obcego tenanta', (name) => {
    const foreign = seeds.get('tenant-b')
    if (!foreign) throw new Error('brak danych tenanta B')
    const read = geoRepos(db, A).read as Record<string, (...a: unknown[]) => unknown>
    const args = GEO_READ_METHOD_ARGS[name]!({
      marker: OBCY, date: '2026-03-01',
      siteId: foreign.siteId, runId: foreign.runId, promptSetId: foreign.promptSetId,
    })
    const json = JSON.stringify(read[name]!(...args) ?? null)

    expect(json).not.toContain('tenant-b')
    expect(json).not.toContain(OBCY)
    expect(json).not.toContain(foreign.siteId)
    expect(json).not.toContain(foreign.runId)
  })

  it('cytowania groundingowe tez nie przeciekaja', () => {
    const foreign = seeds.get('tenant-b')
    if (!foreign) throw new Error('brak danych tenanta B')
    const rows = geoRepos(db, A).read.listCitations(foreign.runId, 'grounding')
    expect(JSON.stringify(rows)).not.toContain(OBCY)
  })
})

describe('zapis i odczyt GEO', () => {
  let db: ReturnType<typeof openDatabase>
  let own: Seeded

  beforeEach(() => {
    const seed = seeded()
    db = seed.db
    const mine = seed.seeds.get('tenant-a')
    if (!mine) throw new Error('brak danych tenanta A')
    own = mine
  })

  it('D25: przebieg zamraza zestaw promptow', () => {
    const g = geoRepos(db, A)
    expect(g.read.getPromptSet(own.promptSetId)?.frozenAt).not.toBeNull()
  })

  it('D25: dopisanie promptu do zamrozonego zestawu jest bledem, nie wygoda', () => {
    const g = geoRepos(db, A)
    expect(() => g.write.addPrompts(own.promptSetId, [{ text: 'nowy', locale: 'pl' }]))
      .toThrow(FrozenPromptSetError)
    expect(g.read.listPrompts(own.promptSetId)).toHaveLength(1)
  })

  it('nowa wersja zestawu przyjmuje prompty i wskazuje poprzednika', () => {
    const g = geoRepos(db, A)
    const nowy = g.write.createPromptSet(own.siteId, {
      name: 'zestaw-marker-a', version: 2, supersedesId: own.promptSetId,
    })
    g.write.addPrompts(nowy, [{ text: 'a', locale: 'pl' }, { text: 'b', locale: 'pl' }])
    expect(g.read.listPrompts(nowy)).toHaveLength(2)
    expect(g.read.getPromptSet(nowy)?.supersedesId).toBe(own.promptSetId)
  })

  it('D27: przebieg niesie trojke silnik/wersja/tryb i wersje encji', () => {
    const run = geoRepos(db, A).read.getGeoRun(own.runId)
    expect(run?.engine).toBe('silnik-marker-a')
    expect(run?.modelVersion).toBe('wersja-marker-a')
    expect(run?.accessMode).toBe('api_grounded')
    expect(run?.entityVersion).toBe(1)
  })

  it('D32: cytowania czyta sie zrodlo po zrodle', () => {
    const g = geoRepos(db, A)
    const grounding = g.read.listCitations(own.runId, 'grounding')
    const inline = g.read.listCitations(own.runId, 'inline')
    expect(grounding).toHaveLength(1)
    expect(inline).toHaveLength(1)
    expect(grounding[0]?.rawUrl).toBe('https://marker-a.example/zrodlo')
    expect(grounding[0]?.ours).toBe(1)
    expect(grounding[0]?.positionShare).toBeNull()
    expect(inline[0]?.positionShare).not.toBeNull()
  })

  it('wzmianka zapisuje pozycje i akapit (D30)', () => {
    const [wzmianka] = geoRepos(db, A).read.listMentions(own.runId)
    expect(wzmianka?.matched).toBe('marker-a')
    expect(wzmianka?.paragraph).toBe(0)
    expect(wzmianka?.positionShare).toBeGreaterThanOrEqual(0)
  })

  it('odmowa modelu zapisuje sie jako dane, nie jako blad', () => {
    const g = geoRepos(db, A)
    const promptId = g.read.listPrompts(own.promptSetId)[0]?.id
    if (promptId === undefined) throw new Error('brak promptu')
    g.write.insertAnswer(own.runId, {
      promptId, runIndex: 1, text: '',
      refusalReason: 'model odmowil odpowiedzi na pytanie komercyjne',
      fetchError: null, latencyMs: 80,
    })
    const odmowa = g.read.listAnswers(own.runId).find((a) => a.runIndex === 1)
    expect(odmowa?.refusalReason).toContain('odmowil')
    expect(odmowa?.fetchError).toBeNull()
    expect(odmowa?.text).toBe('')
  })

  it('encje wracaja jako definicje gotowe dla silnika wzmianek', () => {
    const [encja] = geoRepos(db, A).read.listEntities(own.siteId)
    expect(encja?.name).toBe('marker-a')
    expect(encja?.variants).toEqual([])
    expect(encja?.version).toBe(1)
  })
})
