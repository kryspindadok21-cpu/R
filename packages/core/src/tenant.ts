export type TenantId = string & { readonly __brand: 'TenantId' }

export const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/

export const LOCAL_TENANT = 'local' as TenantId

/**
 * Jedyny sposob uzyskania TenantId. Kazda funkcja w packages/db przyjmuje
 * TenantScope pierwszym argumentem — to jest linia obrony przed wyciekiem
 * danych miedzy klientami (D5).
 */
export interface TenantScope {
  readonly tenantId: TenantId
}

export function tenantScope(id: string): TenantScope {
  if (!TENANT_ID_PATTERN.test(id)) {
    throw new Error(`Nieprawidlowy identyfikator tenanta: ${JSON.stringify(id)}`)
  }
  return { tenantId: id as TenantId }
}
