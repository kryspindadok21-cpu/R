import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('domyslnie umieszcza baze w katalogu domowym', () => {
    expect(loadConfig({}, '/home/kto').dbPath).toBe('/home/kto/.seo/seo.db')
  })

  it('SEO_DB_PATH nadpisuje domyslna sciezke', () => {
    expect(loadConfig({ SEO_DB_PATH: '/tmp/x.db' }, '/home/kto').dbPath).toBe('/tmp/x.db')
  })

  it('czyta sciezke klucza serwisowego ze zmiennej srodowiskowej', () => {
    expect(loadConfig({ SEO_GSC_KEY_FILE: '/k.json' }, '/h').gscKeyFile).toBe('/k.json')
  })

  it('bez klucza zwraca undefined, nie rzuca', () => {
    expect(loadConfig({}, '/h').gscKeyFile).toBeUndefined()
  })

  it('domyslnym tenantem jest local', () => {
    expect(loadConfig({}, '/h').tenantId).toBe('local')
  })

  it('odrzuca nieprawidlowy SEO_TENANT', () => {
    expect(() => loadConfig({ SEO_TENANT: 'ZLE' }, '/h')).toThrow()
  })
})
