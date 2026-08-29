import { describe, expect, it } from 'vitest'
import { proxyFromEnv } from './playwright.js'

/**
 * Chromium nie dziedziczy proxy ze zmiennych srodowiskowych tak, jak robi to
 * Node. Bez jawnego przekazania przegladarka w kontenerze albo w sieci firmowej
 * konczy na ERR_CONNECTION_RESET, podczas gdy zwykly crawl dziala — objaw
 * mylacy, bo wyglada na awarie strony.
 */
describe('proxyFromEnv', () => {
  it('czyta HTTPS_PROXY i NO_PROXY', () => {
    expect(proxyFromEnv({ HTTPS_PROXY: 'http://p:8080', NO_PROXY: 'localhost' }))
      .toEqual({ server: 'http://p:8080', bypass: 'localhost' })
  })

  it('przyjmuje warianty pisane malymi literami', () => {
    expect(proxyFromEnv({ https_proxy: 'http://p:8080', no_proxy: 'a.test' }))
      .toEqual({ server: 'http://p:8080', bypass: 'a.test' })
  })

  it('HTTPS_PROXY ma pierwszenstwo nad HTTP_PROXY', () => {
    expect(proxyFromEnv({ HTTPS_PROXY: 'http://s:1', HTTP_PROXY: 'http://n:2' }).server)
      .toBe('http://s:1')
  })

  it('spada na HTTP_PROXY, gdy nie ma HTTPS_PROXY', () => {
    expect(proxyFromEnv({ HTTP_PROXY: 'http://n:2' }).server).toBe('http://n:2')
  })

  it('brak proxy to undefined, nie pusty tekst', () => {
    expect(proxyFromEnv({})).toEqual({ server: undefined, bypass: undefined })
  })
})
