import type { TenantScope } from '@seo/core'
import {
  approveDraft, articleSchemaScript, briefToMarkdown, buildArticleSchema, buildBrief,
  verifyAuthor,
  type CorpusDocument, type DraftInput, type GateFailure, type GeoSignal, type LinkCandidate,
  type UniqueAsset,
} from '@seo/content'
import { buildLinkGraph, statsFor } from '@seo/crawler'
import {
  type Db, contentRepos, crawlRepos, geoRepos, repos, type RateLimitStatus,
} from '@seo/db'
import {
  clusterByLexicalOverlap, clusterBySerpOverlap, clusterSet, decideCoverage,
  type Cluster, type ExistingPage, type Keyword, type SerpSnapshot,
} from '@seo/keywords'
import type { ContentProvider, GitPrProvider } from '@seo/providers'
import { NoCrawlError } from './audit.js'
import { crawlStartUrl } from './crawl.js'

/**
 * Komendy Fazy 3 — sklejenie warstw.
 *
 * Ta warstwa nie decyduje o niczym sama. Klastrowanie, bramki i limit tempa
 * mieszkaja w silnikach i w bazie; tutaj tylko podajemy im dane i przekazujemy
 * wynik dalej. Kazda decyzja podjeta tutaj bylaby decyzja, ktorej nie da sie
 * przetestowac bez bazy.
 */

export class UnknownSiteError extends Error {
  constructor(siteUrl: string) {
    super(`Nieznana strona ${siteUrl}. Uruchom najpierw: seo crawl --site ${siteUrl}`)
    this.name = 'UnknownSiteError'
  }
}

export class NoClusterError extends Error {
  constructor(siteUrl: string) {
    super(
      `Brak klastrow dla ${siteUrl}. Uruchom najpierw: seo keywords cluster --site ${siteUrl}`,
    )
    this.name = 'NoClusterError'
  }
}

export class NoBriefError extends Error {
  constructor(briefId: string) {
    super(`Nie znaleziono briefu ${briefId}.`)
    this.name = 'NoBriefError'
  }
}

export class UnverifiedAuthorError extends Error {
  constructor(reason: string) {
    super(`Draft ma autora, ktory nie przechodzi bramki D39: ${reason}`)
    this.name = 'UnverifiedAuthorError'
  }
}

export class RateLimitedError extends Error {
  constructor(readonly status: RateLimitStatus) {
    super(`Limit tempa publikacji: ${status.reason}`)
    this.name = 'RateLimitedError'
  }
}

function siteOf(db: Db, scope: TenantScope, siteUrl: string) {
  const site = repos(db, scope).read.findSiteByUri(siteUrl)
  if (!site) throw new UnknownSiteError(siteUrl)
  return site
}

// --- seo keywords cluster -------------------------------------------------------

export interface ClusterCommandOptions {
  readonly siteUrl: string
  readonly from: string
  readonly to: string
  readonly limit?: number | undefined
  /** Migawki SERP wlaczaja metode podstawowa. Bez nich idzie metoda zapasowa (D33). */
  readonly serpSnapshots?: readonly SerpSnapshot[] | undefined
}

export interface ClusterCommandResult {
  readonly clusterSetId: string
  readonly method: Cluster['method']
  readonly clusters: number
  readonly keywords: number
  /** Niepuste, gdy zadzialala metoda zapasowa — raport ma to powiedziec wprost. */
  readonly methodWarning: string | null
}

export const DEFAULT_KEYWORD_LIMIT = 500

export function runKeywordsCluster(
  db: Db,
  scope: TenantScope,
  options: ClusterCommandOptions,
): ClusterCommandResult {
  const site = siteOf(db, scope, options.siteUrl)

  const keywords: Keyword[] = repos(db, scope).read
    .queriesWithPosition(site.id, options.from, options.to, options.limit ?? DEFAULT_KEYWORD_LIMIT)
    .map((row) => ({
      query: row.query,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
    }))

  const maSerp = options.serpSnapshots !== undefined && options.serpSnapshots.length > 0
  const clusters = maSerp
    ? clusterBySerpOverlap(keywords, options.serpSnapshots as readonly SerpSnapshot[])
    : clusterByLexicalOverlap(keywords)

  const zestaw = clusterSet(clusters)
  if (zestaw.kind === 'odmowa') {
    // Odmowa przy jednej metodzie moze znaczyc tylko „pusty zestaw" — brak fraz
    // z Search Console. To nie jest awaria, tylko stan do zaraportowania.
    return {
      clusterSetId: '',
      method: maSerp ? 'serp-overlap' : 'lexical-overlap',
      clusters: 0,
      keywords: 0,
      methodWarning: zestaw.detail,
    }
  }

  const c = contentRepos(db, scope)
  const clusterSetId = c.write.createClusterSet(site.id, {
    method: zestaw.method, fromDate: options.from, toDate: options.to,
  })
  c.write.insertClusters(clusterSetId, zestaw.clusters)

  return {
    clusterSetId,
    method: zestaw.method,
    clusters: zestaw.clusters.length,
    keywords: keywords.length,
    methodWarning: zestaw.method === 'lexical-overlap'
      ? 'Klastry powstaly z podobienstwa slow, a nie z pomiaru SERP. Nie mamy '
        + 'darmowego zrodla top10, wiec to jest hipoteza, nie pomiar opinii '
        + 'wyszukiwarki. Traktuj wyniki ostroznie (D33).'
      : null,
  }
}

// --- seo brief ------------------------------------------------------------------

export interface BriefCommandOptions {
  readonly siteUrl: string
  /** Slug klastra; bez niego bierzemy klaster o najwiekszym ruchu. */
  readonly clusterSlug?: string | undefined
  readonly createReason?: string | undefined
}

export interface BriefCommandResult {
  readonly briefId: string
  readonly clusterHead: string
  readonly decision: 'refresh' | 'create'
  readonly targetUrl: string | null
  readonly gaps: number
  readonly internalLinks: number
  readonly markdown: string
}

/** Odtwarza klaster z bazy — ten sam ksztalt, ktory widzialy silniki. */
function clusterFromRow(row: {
  slug: string; head: string; totalImpressions: number; totalClicks: number
  sharedUrls: number | null; keywords: string
}, method: Cluster['method']): Cluster {
  return {
    id: row.slug,
    method,
    head: row.head,
    keywords: JSON.parse(row.keywords) as Keyword[],
    totalImpressions: row.totalImpressions,
    totalClicks: row.totalClicks,
    sharedUrls: row.sharedUrls,
  }
}

export function runBrief(
  db: Db,
  scope: TenantScope,
  options: BriefCommandOptions,
): BriefCommandResult {
  const site = siteOf(db, scope, options.siteUrl)
  const c = contentRepos(db, scope)

  const zestaw = c.read.latestClusterSet(site.id)
  if (zestaw === undefined) throw new NoClusterError(options.siteUrl)

  const wiersze = c.read.listClusters(zestaw.id)
  const wiersz = options.clusterSlug === undefined
    ? wiersze[0]
    : wiersze.find((row) => row.slug === options.clusterSlug)
  if (wiersz === undefined) throw new NoClusterError(options.siteUrl)

  const cluster = clusterFromRow(wiersz, zestaw.method)

  // Strony i graf z ostatniego crawla — brief ma znac serwis takim, jaki jest.
  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)
  if (run === undefined) throw new NoCrawlError(options.siteUrl)

  const strony = crawlRepo.read.listCrawlPages(run.id)
  const linki = crawlRepo.read.listPageLinks(run.id)
  const graph = buildLinkGraph({
    pageUrls: strony.map((p) => p.url),
    edges: linki.map((l) => ({
      fromUrl: l.fromUrl, toUrl: l.toUrl, rel: l.rel,
      anchorText: l.anchorText, isInternal: l.isInternal === 1,
    })),
    rootUrl: crawlStartUrl(site.propertyUri),
  })

  const dostepne = strony.filter((p) => p.httpStatus === 200 && p.indexable === 1)

  const existing: ExistingPage[] = dostepne.map((p) => ({
    url: p.url,
    title: p.title,
    text: `${p.title ?? ''} ${p.metaDescription ?? ''}`,
  }))

  const linkCandidates: LinkCandidate[] = dostepne.map((p) => ({
    url: p.url,
    title: p.title,
    text: `${p.title ?? ''} ${p.metaDescription ?? ''}`,
    inDegree: statsFor(graph, p.url)?.inDegree ?? 0,
    clickDepth: statsFor(graph, p.url)?.clickDepth ?? null,
  }))

  const coverage = decideCoverage(cluster, existing, {
    ...(options.createReason === undefined ? {} : { createReason: options.createReason }),
  })

  const brief = buildBrief({
    cluster, coverage, linkCandidates, geoSignals: geoSignalsFor(db, scope, site.id, cluster),
  })
  const markdown = briefToMarkdown(brief)

  const briefId = c.write.insertBrief(site.id, {
    clusterId: wiersz.id, brief, markdown,
  })

  return {
    briefId,
    clusterHead: brief.head,
    decision: brief.decision,
    targetUrl: brief.targetUrl,
    gaps: brief.gaps.length,
    internalLinks: brief.internalLinks.length,
    markdown,
  }
}

/**
 * Sygnaly z trackera GEO dla tematu klastra.
 *
 * Dopasowanie idzie po slowach frazy glownej w tresci promptu — celowo proste,
 * bo to jest kontekst dla piszacego, a nie pomiar. Gdyby ktos chcial na tym
 * cos policzyc, musialby to zrobic porzadnie i wtedy nalezy to do Fazy 2.
 */
function geoSignalsFor(
  db: Db, scope: TenantScope, siteId: string, cluster: Cluster,
): GeoSignal[] {
  const g = geoRepos(db, scope)
  const run = g.read.latestGeoRun(siteId)
  if (run === undefined) return []

  const encje = g.read.listEntities(siteId).filter((e) => e.isOwn).map((e) => e.id)
  if (encje.length === 0) return []

  const odpowiedzi = g.read.listAnswers(run.id).filter((a) => a.fetchError === null)
  const zeWzmianka = new Set(
    g.read.listMentions(run.id)
      .filter((m) => encje.includes(m.entityId))
      .map((m) => m.geoAnswerId),
  )

  const slowa = cluster.head.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const byPrompt = new Map<string, { trafienia: number; przebiegi: number }>()

  for (const answer of odpowiedzi) {
    const tekst = answer.promptText.toLowerCase()
    if (!slowa.some((slowo) => tekst.includes(slowo))) continue
    const bucket = byPrompt.get(answer.promptText) ?? { trafienia: 0, przebiegi: 0 }
    bucket.przebiegi += 1
    if (zeWzmianka.has(answer.id)) bucket.trafienia += 1
    byPrompt.set(answer.promptText, bucket)
  }

  return [...byPrompt.entries()].map(([prompt, b]) => ({
    prompt,
    mentionRate: b.przebiegi === 0 ? 0 : b.trafienia / b.przebiegi,
    runs: b.przebiegi,
  }))
}

// --- seo draft ------------------------------------------------------------------

export interface DraftCommandOptions {
  readonly siteUrl: string
  readonly briefId: string
  readonly author: { readonly name: string; readonly sameAs: string }
  /** Wymagane przez D37 — bez tego draft nie przejdzie bramki i tak ma byc. */
  readonly uniqueAssets: readonly UniqueAsset[]
}

export interface DraftCommandResult {
  readonly draftId: string
  readonly approved: boolean
  readonly title: string
  readonly failures: readonly GateFailure[]
  readonly engine: string
  readonly modelVersion: string
  readonly closestMatch: string | null
}

export async function runDraft(
  db: Db,
  scope: TenantScope,
  provider: ContentProvider,
  options: DraftCommandOptions,
): Promise<DraftCommandResult> {
  const site = siteOf(db, scope, options.siteUrl)
  const c = contentRepos(db, scope)

  const brief = c.read.getBrief(options.briefId)
  if (brief === undefined) throw new NoBriefError(options.briefId)

  const generated = await provider.generate(brief.markdown, options.briefId)

  // Zestaw porownawczy: wlasne strony z crawla. Bez top10 nie mamy cudzych
  // tekstow, wiec bramka lapie na razie tylko duplikaty wewnetrzne — i to jest
  // powiedziane wprost, a nie ukryte za slowem „oryginalnosc".
  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)
  const corpus: CorpusDocument[] = run === undefined ? [] : crawlRepo.read
    .listCrawlPages(run.id)
    .filter((p) => p.httpStatus === 200)
    .map((p) => ({
      id: p.url,
      text: `${p.title ?? ''} ${p.metaDescription ?? ''}`,
    }))

  const wejscie: DraftInput = {
    title: generated.title,
    markdown: generated.markdown,
    author: options.author,
    uniqueAssets: options.uniqueAssets,
    engine: generated.engine,
    modelVersion: generated.modelVersion,
    promptId: generated.promptId,
  }

  const wynik = approveDraft(wejscie, { corpus })
  const approved = wynik.kind === 'approved'

  const failures: GateFailure[] = approved ? [] : [...wynik.failures]
  if (generated.error !== null) {
    failures.push({ gate: 'originality', reason: `wywolanie silnika nie udalo sie: ${generated.error}` })
  }
  if (generated.refusalReason !== null) {
    failures.push({ gate: 'originality', reason: `model odmowil: ${generated.refusalReason}` })
  }

  const originality = approved ? wynik.draft.originality : null

  const draftId = c.write.insertDraft(site.id, {
    briefId: options.briefId,
    title: generated.title,
    markdown: generated.markdown,
    authorName: options.author.name,
    authorSameAs: options.author.sameAs,
    uniqueAssets: options.uniqueAssets,
    engine: generated.engine,
    modelVersion: generated.modelVersion,
    promptId: generated.promptId,
    // Blad wywolania albo odmowa unicwaja zatwierdzenie, nawet gdy bramki
    // czystej tresci przeszly — pusty draft nie jest artykulem.
    approved: approved && failures.length === 0,
    gateFailures: failures,
    originality: originality ?? {},
  })

  return {
    draftId,
    approved: approved && failures.length === 0,
    title: generated.title,
    failures,
    engine: generated.engine,
    modelVersion: generated.modelVersion,
    closestMatch: originality?.closest?.documentId ?? null,
  }
}

// --- seo publish ----------------------------------------------------------------

export interface PublishCommandOptions {
  readonly siteUrl: string
  readonly draftId: string
  readonly repoDir: string
  /** Katalog na tresc wewnatrz repozytorium. */
  readonly contentDir?: string | undefined
  readonly canonicalUrl?: string | undefined
  readonly publishedAt?: string | undefined
}

export interface PublishCommandResult {
  readonly publicationId: string
  readonly branch: string
  readonly filePath: string
  readonly commit: string
  readonly pushed: boolean
  readonly nextStep: string
  readonly rate: RateLimitStatus
}

/** Front matter + JSON-LD + tresc. Markdown, bo PR z HTML-em sie nie czyta (D44). */
export function draftToMarkdownFile(input: {
  readonly title: string
  readonly markdown: string
  readonly authorName: string
  readonly publishedAt: string
  readonly schemaScript: string | null
}): string {
  const escape = (value: string) => value.replace(/"/g, '\\"')
  const naglowek = [
    '---',
    `title: "${escape(input.title)}"`,
    `author: "${escape(input.authorName)}"`,
    `date: ${input.publishedAt}`,
    '---',
    '',
  ]
  const ogon = input.schemaScript === null ? [] : ['', input.schemaScript]
  return [...naglowek, input.markdown.trim(), ...ogon, ''].join('\n')
}

export async function runPublish(
  db: Db,
  scope: TenantScope,
  gitPr: GitPrProvider,
  options: PublishCommandOptions,
): Promise<PublishCommandResult> {
  const site = siteOf(db, scope, options.siteUrl)
  const c = contentRepos(db, scope)

  const draft = c.read.getDraft(options.draftId)
  if (draft === undefined) throw new NoBriefError(options.draftId)

  // Limit tempa sprawdzany PRZED jakimkolwiek zapisem do repozytorium.
  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)
  const indexedPages = run === undefined
    ? 0
    : crawlRepo.read.listCrawlPages(run.id).filter((p) => p.indexable === 1).length

  const rate = c.read.publicationRate(site.id, indexedPages, Date.now())
  if (!rate.allowed) throw new RateLimitedError(rate)

  const publishedAt = options.publishedAt ?? new Date().toISOString().slice(0, 10)
  const slug = draft.title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'artykul'

  const filePath = `${options.contentDir ?? 'content'}/${slug}.md`

  // Autor jest sprawdzany **ponownie**, na wartosciach z bazy. Draft mogl zostac
  // zatwierdzony dawno; JSON-LD ma wyjsc z danych, ktore naprawde ida do repo.
  const autor = verifyAuthor({ name: draft.authorName, sameAs: draft.authorSameAs })
  if (autor.kind === 'rejected') throw new UnverifiedAuthorError(autor.failure.reason)

  const schemaScript = options.canonicalUrl === undefined ? null : articleSchemaScript(
    buildArticleSchema({
      title: draft.title,
      author: autor.author,
      url: options.canonicalUrl,
      datePublished: publishedAt,
    }),
  )

  const contents = draftToMarkdownFile({
    title: draft.title,
    markdown: draft.markdown,
    authorName: draft.authorName,
    publishedAt,
    schemaScript,
  })

  const branch = `tresc/${slug}`
  const publicationId = c.write.createPublication(site.id, { draftId: options.draftId, branch, filePath })

  const wynik = await gitPr.publish({
    branch, filePath, contents,
    commitMessage: `tresc: ${draft.title}`,
  })

  if (wynik.pushed) c.write.markPublicationOpened(publicationId, '')

  return {
    publicationId,
    branch: wynik.branch,
    filePath: wynik.filePath,
    commit: wynik.commit,
    pushed: wynik.pushed,
    nextStep: wynik.nextStep,
    rate,
  }
}
