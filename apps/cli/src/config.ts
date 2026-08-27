import { join } from 'node:path'
import { LOCAL_TENANT, tenantScope } from '@seo/core'

export interface Config {
  readonly dbPath: string
  readonly gscKeyFile: string | undefined
  readonly tenantId: string
}

export function loadConfig(env: NodeJS.ProcessEnv, homeDir: string): Config {
  const tenantId = env.SEO_TENANT ?? LOCAL_TENANT
  tenantScope(tenantId) // waliduje ksztalt slug-a, rzuca przy bledzie
  return {
    dbPath: env.SEO_DB_PATH ?? join(homeDir, '.seo', 'seo.db'),
    gscKeyFile: env.SEO_GSC_KEY_FILE,
    tenantId,
  }
}
