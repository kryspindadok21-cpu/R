import {
  actionTable, differenceInDifferences, gateFor, opportunityFromFinding,
  rankOpportunities, verdictSentence,
} from '@seo/agent'
import { tenantScope } from '@seo/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { IllegalTransitionError, agentRepos } from './agent-repo.js'
import { openDatabase } from './connection.js'
import { migrate } from './migrate.js'
import { AGENT_READ_METHOD_ARGS } from './read-fixtures.js'
import { repos } from './repo.js'

const A = tenantScope('tenant-a')
const B = tenantScope('tenant-b')
const OBCY = 'obcy-marker-agent'

interface Seeded {
  siteId: string; opportunityId: string; taskId: string; experimentId: string
}

const SPOKOJNIE = {
  clicksThisWeek: 100, clicksLastWeek: 100,
  indexedPages: 1000, affectedPages: 1,
  publicationRateAllowed: true, publicationRateReason: 'dzis 0/3',
}

function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  const seeds = new Map<string, Seeded>()

  for (const [scope, marker, host] of [[A, 'marker-a', 'a'], [B, OBCY, 'b']] as const) {
    const base = repos(db, scope)
    base.write.ensureTenant(scope.tenantId)
    const site = base.write.upsertSite('url_prefix', `https://${host}.example/`)

    const r = agentRepos(db, scope)
    const [okazja] = rankOpportunities([opportunityFromFinding({
      ruleId: `title.${marker}`, severity: 'high', url: `https://${host}.example/x`,
      title: `Ustalenie ${marker}`, affectedPages: 3, hasAutofix: false,
    })])

    const [opportunityId] = r.write.insertOpportunities(site.id, [{
      slug: okazja!.id, kind: okazja!.kind, title: okazja!.title,
      targetUrl: okazja!.targetUrl, score: okazja!.score,
      factors: { impact: okazja!.impact, marker },
      measuredFactors: okazja!.measuredFactors,
    }])

    const taskId = r.write.proposeTask(site.id, {
      opportunityId: opportunityId as string,
      actionKind: 'rewrite-meta',
      gate: gateFor(actionTable(), 'rewrite-meta', SPOKOJNIE),
    })

    const experimentId = r.write.recordExperiment(site.id, {
      taskId,
      treatmentUrls: [`https://${host}.example/x`],
      controlUrls: [`https://${host}.example/k1`, `https://${host}.example/${marker}`],
      shortfall: null,
      changedOn: '2026-08-01',
      selectedAt: 1000,
    })

    seeds.set(scope.tenantId, {
      siteId: site.id, opportunityId: opportunityId as string, taskId, experimentId,
    })
  }

  return { db, seeds }
}

describe('izolacja tenantow w repozytoriach agenta', () => {
  let db: ReturnType<typeof openDatabase>
  let seeds: Map<string, Seeded>

  beforeEach(() => { ({ db, seeds } = seeded()) })

  it('kazda metoda odczytu ma wpis w rejestrze argumentow', () => {
    expect(Object.keys(agentRepos(db, A).read).sort())
      .toEqual(Object.keys(AGENT_READ_METHOD_ARGS).sort())
  })

  it.each(Object.keys(AGENT_READ_METHOD_ARGS))('%s nie zwraca danych obcego tenanta', (name) => {
    const foreign = seeds.get('tenant-b')
    if (!foreign) throw new Error('brak danych tenanta B')
    const read = agentRepos(db, A).read as Record<string, (...a: unknown[]) => unknown>
    const args = AGENT_READ_METHOD_ARGS[name]!({
      marker: OBCY, date: '2026-03-01',
      siteId: foreign.siteId, taskId: foreign.taskId, experimentId: foreign.experimentId,
    })
    const json = JSON.stringify(read[name]!(...args) ?? null)

    expect(json).not.toContain('tenant-b')
    expect(json).not.toContain(OBCY)
    expect(json).not.toContain(foreign.siteId)
    expect(json).not.toContain(foreign.taskId)
  })
})

describe('zapis i odczyt agenta', () => {
  let db: ReturnType<typeof openDatabase>
  let own: Seeded

  beforeEach(() => {
    const seed = seeded()
    db = seed.db
    own = seed.seeds.get('tenant-a')!
  })

  it('D46: zadanie powstaje zawsze jako proposed', () => {
    expect(agentRepos(db, A).read.getTask(own.taskId)?.state).toBe('proposed')
  })

  it('bramka i jej powod sa zapisane razem z zadaniem', () => {
    const r = agentRepos(db, A)
    const zablokowane = r.write.proposeTask(own.siteId, {
      opportunityId: own.opportunityId,
      actionKind: 'link-exchange',
      gate: gateFor(actionTable(), 'link-exchange', SPOKOJNIE),
    })
    const zadanie = r.read.getTask(zablokowane)
    expect(zadanie?.gate).toBe('blocked')
    expect(zadanie?.gateReason).toContain('link scheme')
  })

  it('D53: done bez werdyktu jest odrzucane takze przez baze', () => {
    const r = agentRepos(db, A)
    r.write.transition(own.taskId, 'in-flight')
    r.write.transition(own.taskId, 'measuring')
    expect(() => r.write.transition(own.taskId, 'done')).toThrow(IllegalTransitionError)
    expect(r.read.getTask(own.taskId)?.state).toBe('measuring')
  })

  it('D53: werdykt podany przy przejsciu odblokowuje done', () => {
    const r = agentRepos(db, A)
    r.write.transition(own.taskId, 'in-flight')
    r.write.transition(own.taskId, 'measuring')
    r.write.transition(own.taskId, 'done', 'Po 30 dniach nie da sie zmierzyc: za mala kontrola.')
    const zadanie = r.read.getTask(own.taskId)
    expect(zadanie?.state).toBe('done')
    expect(zadanie?.verdict).toContain('nie da sie zmierzyc')
  })

  it('niedozwolone przejscie jest bledem z wyjasnieniem', () => {
    const r = agentRepos(db, A)
    expect(() => r.write.transition(own.taskId, 'measuring')).toThrow(IllegalTransitionError)
  })

  it('D49: eksperyment zapisuje obie grupy i date zmiany doslownie', () => {
    const eksperyment = agentRepos(db, A).read.getExperiment(own.taskId)
    expect(JSON.parse(eksperyment?.treatmentUrls ?? '[]')).toHaveLength(1)
    expect(JSON.parse(eksperyment?.controlUrls ?? '[]')).toHaveLength(2)
    expect(eksperyment?.changedOn).toBe('2026-08-01')
  })

  it('D49: drugi eksperyment dla tego samego zadania jest odrzucany przez baze', () => {
    // Grupy zapisuje sie RAZ, w chwili planowania. Nadpisanie ich pozniej
    // byloby doborem kontroli po zobaczeniu wynikow.
    expect(() => agentRepos(db, A).write.recordExperiment(own.siteId, {
      taskId: own.taskId, treatmentUrls: [], controlUrls: [],
      shortfall: null, changedOn: '2026-09-01', selectedAt: 2000,
    })).toThrow()
  })

  it('D50: trzy okna daja trzy osobne wiersze werdyktu', () => {
    const r = agentRepos(db, A)
    const treatment = Array.from({ length: 8 }, (_, i) => ({
      url: `t${i}`,
      before: { clicks: 100, impressions: 1000, position: 10 },
      after: { clicks: 140 + (i % 4) * 2, impressions: 1000, position: 10 },
    }))
    const control = Array.from({ length: 20 }, (_, i) => ({
      url: `k${i}`,
      before: { clicks: 100, impressions: 1000, position: 10 },
      after: { clicks: 100 + (i % 3), impressions: 1000, position: 10 },
    }))

    for (const okno of [14, 30, 60] as const) {
      const wynik = differenceInDifferences(treatment, control, {
        metric: 'clicks', windowDays: okno, seed: 7, resamples: 500,
      })
      r.write.recordVerdict(own.experimentId, wynik, verdictSentence(wynik))
    }

    const werdykty = r.read.listVerdicts(own.experimentId)
    expect(werdykty.map((w) => w.windowDays)).toEqual([14, 30, 60])
    expect(werdykty.every((w) => w.outcome === 'werdykt')).toBe(true)
    expect(werdykty[0]?.sentence).toContain('Po 14 dniach')
  })

  it('odmowa pomiaru TEZ jest zapisywana', () => {
    const r = agentRepos(db, A)
    const wynik = differenceInDifferences(
      [{ url: 't', before: { clicks: 1, impressions: 10, position: 5 }, after: { clicks: 2, impressions: 10, position: 5 } }],
      [],
      { metric: 'clicks', windowDays: 30, seed: 1 },
    )
    r.write.recordVerdict(own.experimentId, wynik, verdictSentence(wynik))

    const [werdykt] = r.read.listVerdicts(own.experimentId)
    expect(werdykt?.outcome).toBe('odmowa')
    expect(werdykt?.effect).toBeNull()
    expect(werdykt?.refusalReason).toContain('za-mala-kontrola')
    expect(werdykt?.significant).toBe(0)
  })

  it('okazja niesie liczbe zmierzonych czynnikow', () => {
    const [okazja] = agentRepos(db, A).read.listOpportunities(own.siteId, 10)
    expect(okazja?.measuredFactors).toBeGreaterThanOrEqual(1)
    expect(okazja?.score).toBeGreaterThan(0)
  })
})
