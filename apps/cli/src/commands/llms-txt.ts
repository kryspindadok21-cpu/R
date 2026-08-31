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

export function runLlmsTxt(
  db: Db,
  scope: TenantScope,
  options: LlmsTxtOptions,
): LlmsTxtResult {
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

  mkdirSync(dirname(options.outPath), { recursive: true })
  writeFileSync(options.outPath, tresc, 'utf8')

  const uzyte = pages.filter((p) => p.httpStatus === 200 && p.indexable).length
  return { outPath: options.outPath, pages: uzyte, skippedPages: pages.length - uzyte }
}
