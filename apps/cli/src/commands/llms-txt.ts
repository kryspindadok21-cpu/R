import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { TenantScope } from '@seo/core'
import { type Db, crawlRepos, repos } from '@seo/db'
import { buildLlmsTxt } from '@seo/geo'
import { NoCrawlError } from './audit.js'

/**
 * `seo llms-txt` — generator pliku `llms.txt` z zapisanego crawla (D31).
 *
 * Zrodlem jest crawl, nie osobne pobranie: strony, ktore juz znamy, maja tytul,
 * opis i informacje o indeksowalnosci. Drugie przejscie po stronie tylko po to,
 * zeby zlozyc plik, byloby ruchem sieciowym bez nowej informacji.
 */

export interface LlmsTxtOptions {
  readonly siteUrl: string
  readonly outPath: string
  readonly siteName?: string | undefined
  readonly description?: string | undefined
}

export interface LlmsTxtResult {
  readonly outPath: string
  readonly pages: number
  readonly skippedPages: number
}

export interface LlmsTxtContent {
  readonly content: string
  readonly pages: number
  readonly skippedPages: number
}

/**
 * Sama tresc pliku, bez dotykania dysku.
 *
 * Panel pokazuje `llms.txt` w przegladarce i oddaje go do pobrania — zapis do
 * pliku po stronie serwera bylby tam smieciem na dysku uzytkownika. Rozdzielenie
 * budowania od zapisu znaczy, ze panel i linia polecen skladaja **ten sam** plik;
 * dwie sciezki dawalyby dwie prawdy o tym, co narzedzie wystawia modelom.
 */
export function buildLlmsTxtContent(
  db: Db,
  scope: TenantScope,
  options: Omit<LlmsTxtOptions, 'outPath'>,
): LlmsTxtContent {
  const site = repos(db, scope).read.findSiteByUri(options.siteUrl)
  if (!site) throw new NoCrawlError(options.siteUrl)

  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)
  if (!run) throw new NoCrawlError(options.siteUrl)

  const pages = crawlRepo.read.listCrawlPages(run.id).map((page) => ({
    url: page.url,
    title: page.title,
    description: page.metaDescription,
    depth: page.depth,
    httpStatus: page.httpStatus,
    indexable: page.indexable === 1,
  }))

  const siteUrl = site.propertyUri.replace(/^sc-domain:/, 'https://')
  const tresc = buildLlmsTxt({
    siteName: options.siteName ?? new URL(siteUrl).host,
    siteUrl,
    description: options.description ?? null,
    pages,
  })

  const uzyte = pages.filter((p) => p.httpStatus === 200 && p.indexable).length
  return { content: tresc, pages: uzyte, skippedPages: pages.length - uzyte }
}

export function runLlmsTxt(
  db: Db,
  scope: TenantScope,
  options: LlmsTxtOptions,
): LlmsTxtResult {
  const zbudowane = buildLlmsTxtContent(db, scope, options)

  mkdirSync(dirname(options.outPath), { recursive: true })
  writeFileSync(options.outPath, zbudowane.content, 'utf8')

  return {
    outPath: options.outPath,
    pages: zbudowane.pages,
    skippedPages: zbudowane.skippedPages,
  }
}
