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

  it('bez klucza i bez pliku zwraca undefined, nie rzuca', () => {
    expect(loadConfig({}, '/h', () => false).gscKeyFile).toBeUndefined()
  })

  /**
   * Klucz w udokumentowanym miejscu ma dzialac **bez eksportowania czegokolwiek**.
   * Inaczej instrukcja „zapisz w ~/.seo/gsc.sa.json" jest nieprawdziwa.
   */
  it('znajduje klucz w ~/.seo/gsc.sa.json bez zmiennej srodowiskowej', () => {
    const widziane: string[] = []
    const config = loadConfig({}, '/home/kto', (p) => {
      widziane.push(p)
      return p === '/home/kto/.seo/gsc.sa.json'
    })
    expect(config.gscKeyFile).toBe('/home/kto/.seo/gsc.sa.json')
    expect(widziane).toContain('/home/kto/.seo/gsc.sa.json')
  })

  it('jawna zmienna wygrywa z domyslna sciezka', () => {
    expect(loadConfig({ SEO_GSC_KEY_FILE: '/inny.json' }, '/h', () => true).gscKeyFile)
      .toBe('/inny.json')
  })

  it('pusta zmienna to brak zmiennej, nie sciezka do niczego', () => {
    expect(loadConfig({ SEO_GSC_KEY_FILE: '' }, '/h', () => false).gscKeyFile).toBeUndefined()
  })

  /**
   * Tylda w cudzyslowie nie jest rozwijana przez powloke i trafia do nas doslownie.
   * Bez tego konczy sie bledem „nie ma pliku ~/.seo/gsc.sa.json", ktory brzmi
   * jak brak pliku, a jest bledem cytowania.
   */
  it('rozwija wiodaca tylde w sciezce klucza i bazy', () => {
    const config = loadConfig(
      { SEO_GSC_KEY_FILE: '~/.seo/gsc.sa.json', SEO_DB_PATH: '~/dane/seo.db' },
      '/home/kto', () => true,
    )
    expect(config.gscKeyFile).toBe('/home/kto/.seo/gsc.sa.json')
    expect(config.dbPath).toBe('/home/kto/dane/seo.db')
  })

  it('domyslnym tenantem jest local', () => {
    expect(loadConfig({}, '/h').tenantId).toBe('local')
  })

  it('odrzuca nieprawidlowy SEO_TENANT', () => {
    expect(() => loadConfig({ SEO_TENANT: 'ZLE' }, '/h')).toThrow()
  })
})
