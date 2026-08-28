import { describe, expect, it } from 'vitest'
import type { LinkEdge } from './crawl.js'
import { buildLinkGraph, redirectProblems, statsFor } from './graph.js'

const ROOT = 'https://przyklad.test/'
const OFERTA = 'https://przyklad.test/oferta'
const BLOG = 'https://przyklad.test/blog'
const UKRYTA = 'https://przyklad.test/ukryta'

function edge(from: string, to: string, isInternal = true): LinkEdge {
  return { fromUrl: from, toUrl: to, rel: 'follow', anchorText: 'x', isInternal }
}

const PAGES = [ROOT, OFERTA, BLOG, UKRYTA]
const EDGES = [edge(ROOT, OFERTA), edge(ROOT, BLOG), edge(BLOG, OFERTA)]

describe('buildLinkGraph', () => {
  const graph = buildLinkGraph({ pageUrls: PAGES, edges: EDGES, rootUrl: ROOT })

  it('liczy stopień wejściowy i wyjściowy', () => {
    expect(statsFor(graph, OFERTA)).toMatchObject({ inDegree: 2, outDegree: 0 })
    expect(statsFor(graph, ROOT)).toMatchObject({ inDegree: 0, outDegree: 2 })
  })

  it('wykrywa stronę osieroconą', () => {
    expect(graph.orphans).toEqual([UKRYTA])
  })

  it('nie uznaje strony głównej za osieroconą', () => {
    expect(graph.orphans).not.toContain(ROOT)
  })

  it('wykrywa strony bez linków wychodzących', () => {
    expect(graph.deadEnds).toEqual([OFERTA, UKRYTA])
  })

  it('liczy odległość kliknięciową od strony głównej', () => {
    expect(statsFor(graph, ROOT)?.clickDepth).toBe(0)
    expect(statsFor(graph, BLOG)?.clickDepth).toBe(1)
    expect(statsFor(graph, UKRYTA)?.clickDepth).toBeNull()
  })

  it('wskazuje strony nieosiągalne z korzenia', () => {
    expect(graph.unreachable).toEqual([UKRYTA])
  })

  it('pomija krawędzie zewnętrzne', () => {
    const withExternal = buildLinkGraph({
      pageUrls: PAGES,
      edges: [...EDGES, edge(ROOT, 'https://obca.test/x', false)],
      rootUrl: ROOT,
    })
    expect(statsFor(withExternal, ROOT)?.outDegree).toBe(2)
  })

  it('link do samego siebie nie ratuje strony przed osieroceniem', () => {
    const withSelf = buildLinkGraph({
      pageUrls: PAGES,
      edges: [...EDGES, edge(UKRYTA, UKRYTA)],
      rootUrl: ROOT,
    })
    expect(withSelf.orphans).toEqual([UKRYTA])
  })

  it('powtórzony link liczy się raz', () => {
    const twice = buildLinkGraph({
      pageUrls: PAGES,
      edges: [...EDGES, edge(ROOT, OFERTA)],
      rootUrl: ROOT,
    })
    expect(statsFor(twice, OFERTA)?.inDegree).toBe(2)
  })

  it('cykl nie zapętla obliczania głębokości', () => {
    const cyclic = buildLinkGraph({
      pageUrls: [ROOT, OFERTA],
      edges: [edge(ROOT, OFERTA), edge(OFERTA, ROOT)],
      rootUrl: ROOT,
    })
    expect(statsFor(cyclic, OFERTA)?.clickDepth).toBe(1)
  })

  it('pomija krawędź do strony spoza crawla', () => {
    const graph2 = buildLinkGraph({
      pageUrls: [ROOT],
      edges: [edge(ROOT, 'https://przyklad.test/nieodwiedzona')],
      rootUrl: ROOT,
    })
    expect(statsFor(graph2, ROOT)?.outDegree).toBe(0)
  })
})

describe('redirectProblems', () => {
  it('wykrywa pętlę przekierowań', () => {
    const problems = redirectProblems(
      [{ url: 'https://przyklad.test/a', redirectChain: ['https://przyklad.test/a', 'https://przyklad.test/b'] }],
      5,
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]?.kind).toBe('loop')
  })

  it('wykrywa zbyt długi łańcuch', () => {
    const chain = ['a', 'b', 'c', 'd'].map((s) => `https://przyklad.test/${s}`)
    const problems = redirectProblems([{ url: 'https://przyklad.test/koniec', redirectChain: chain }], 2)
    expect(problems[0]?.kind).toBe('too-long')
    expect(problems[0]?.startUrl).toBe('https://przyklad.test/a')
  })

  it('nie zgłasza łańcucha mieszczącego się w limicie', () => {
    const problems = redirectProblems(
      [{ url: 'https://przyklad.test/b', redirectChain: ['https://przyklad.test/a'] }],
      2,
    )
    expect(problems).toEqual([])
  })

  it('strona bez przekierowania nie generuje zgłoszenia', () => {
    expect(redirectProblems([{ url: ROOT, redirectChain: [] }], 2)).toEqual([])
  })
})
