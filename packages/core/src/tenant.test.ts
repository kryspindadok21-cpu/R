import { describe, expect, it } from 'vitest'
import { LOCAL_TENANT, tenantScope } from './tenant.js'

describe('tenantScope', () => {
  it('przyjmuje poprawny slug', () => {
    expect(tenantScope('acme-sp-z-oo').tenantId).toBe('acme-sp-z-oo')
  })

  it('LOCAL_TENANT jest poprawny', () => {
    expect(tenantScope(LOCAL_TENANT).tenantId).toBe('local')
  })

  it.each(['', 'A', '-zaczyna-myslnikiem', 'ze spacja', 'Wielkie', 'x', 'a'.repeat(64), 'kropka.w.srodku'])(
    'odrzuca %s',
    (bad) => {
      expect(() => tenantScope(bad)).toThrow()
    },
  )
})
