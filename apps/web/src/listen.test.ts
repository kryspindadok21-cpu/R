import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { listenOnLoopback } from './listen.js'
import { LOOPBACK_HOSTS } from './server.js'

/**
 * Regresja na blad, przez ktory panel „nie ladowal sie".
 *
 * Nasluch tylko na `127.0.0.1` znaczy, ze `http://localhost:PORT` dziala albo
 * nie, zaleznie od tego, co system rozwiaze pierwsze. Windows preferuje IPv6,
 * wiec `localhost` szedl na `::1` i przegladarka dostawala odmowe polaczenia,
 * choc serwer stal i odpowiadal na IPv4.
 */

const pusty = () => createServer((_req, res) => { res.writeHead(200); res.end('ok') })

describe('listenOnLoopback', () => {
  it('proboje obu adresow petli zwrotnej', () => {
    expect([...LOOPBACK_HOSTS]).toEqual(['127.0.0.1', '::1'])
  })

  it('wstaje i podaje adresy, ktore naprawde odpowiadaja', async () => {
    const { servers, result } = await listenOnLoopback(pusty, 0)
    try {
      expect(servers.length).toBeGreaterThan(0)
      expect(result.urls.length).toBe(servers.length)
      for (const url of result.urls) {
        expect((await fetch(url)).status).toBe(200)
      }
    } finally {
      for (const s of servers) s.close()
    }
  })

  it('brak IPv6 nie blokuje panelu, tylko melduje sie jako pominiety adres', async () => {
    const { servers, result } = await listenOnLoopback(pusty, 0)
    try {
      // W kontenerach IPv6 bywa wylaczone. Panel ma wtedy dzialac na IPv4,
      // a nie odmawiac startu.
      expect(result.urls.some((u) => u.includes('127.0.0.1'))).toBe(true)
      expect(result.urls.length + result.failures.length).toBe(LOOPBACK_HOSTS.length)
    } finally {
      for (const s of servers) s.close()
    }
  })

  it('zajety port konczy sie bledem mowiacym, co zrobic', async () => {
    const { servers } = await listenOnLoopback(pusty, 0)
    const port = (servers[0]?.address() as { port: number }).port
    try {
      await expect(listenOnLoopback(pusty, port)).rejects.toThrow(/SEO_PANEL_PORT/)
    } finally {
      for (const s of servers) s.close()
    }
  })
})
