import type { TenantScope } from '@seo/core'
import { type Db, repos } from '@seo/db'
import type { CallLedger } from '@seo/providers'

/** Spina rejestr wywolan z tabela provider_call (D7). */
export function dbLedger(db: Db, scope: TenantScope): CallLedger {
  const write = repos(db, scope).write
  return { record: (entry) => write.recordProviderCall(entry) }
}
