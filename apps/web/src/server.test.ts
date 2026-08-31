import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPanel, PANEL_MAX_PAGES } from './server.js'

/**
 * Panel testowany przez **prawdziwe zadania HTTP**, a analizowana strona stoi
 * na drugim serwerze na petli zwrotnej. Atrapa dowiodlaby tylko, ze funkcje
 * skladaja sie w typach — a nie, ze formularz, przekierowanie i crawl
 * naprawde przechodza od poczatku do konca.
 */

let strona: Server
let stronaUrl: string
let panel: Server
let panelUrl: string
let dir: string

function html(tytul: string, linki: readonly string[] = []): string {
  return '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">'
    + `<title>${tytul}</title><meta name="description" content="Opis ${tytul}">`
    + `</head><body><h1>${tytul}</h1><p>Tresc strony ${tytul}.</p>`
    + linki.map((l) => `<a href="${l}">link</a>`).join('')
    + '</body></html>'
}

beforeAll(async () => {
  strona = createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('User-agent: *\nAllow: /\n')
      return
    }
    if (req.url === '/' ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html('Strona glowna', ['/oferta', '/kontakt']))
      return
    }
    if (req.url === '/oferta' || req.url === '/kontakt') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html(req.url.slice(1)))
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('nie ma')
  })
  await new Promise<void>((r) => strona.listen(0, '127.0.0.1', r))
  stronaUrl = `http://127.0.0.1:${(strona.address() as AddressInfo).port}/`
})

afterAll(async () => { await new Promise((r) => strona.close(r)) })

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'panel-'))
  panel = createPanel({
    dbPath: join(dir, 'seo.db'), tenantId: 'local', gscKeyFile: undefined,
  })
  await new Promise<void>((r) => panel.listen(0, '127.0.0.1', r))
  panelUrl = `http://127.0.0.1:${(panel.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise((r) => panel.close(r))
  rmSync(dir, { recursive: true, force: true })
})

async function analizuj(url: string, maxPages = 5): Promise<string> {
  const odpowiedz = await fetch(`${panelUrl}/analizuj`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url, maxPages: String(maxPages) }),
    redirect: 'manual',
  })
  expect(odpowiedz.status).toBe(303)
  return odpowiedz.headers.get('location') as string
}

async function poczekajNaKoniec(sciezka: string): Promise<string> {
  for (let i = 0; i < 60; i += 1) {
    const tresc = await (await fetch(`${panelUrl}${sciezka}`)).text()
    if (tresc.includes('<h1>Gotowe</h1>') || tresc.includes('Nie udało się')) return tresc
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('zadanie nie skonczylo sie w czasie')
}

describe('panel', () => {
  it('strona glowna dziala i mowi, ze nie ma jeszcze witryn', async () => {
    const tresc = await (await fetch(`${panelUrl}/`)).text()
    expect(tresc).toContain('Panel SEO/GEO')
    expect(tresc).toContain('Nie masz jeszcze żadnej strony')
  })

  it('nie odwoluje sie do niczego z sieci', async () => {
    const tresc = await (await fetch(`${panelUrl}/`)).text()
    expect(tresc).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    expect(tresc).not.toContain('<script src')
  })

  it('przechodzi cala sciezke: formularz, crawl, audyt, raport', async () => {
    const sciezka = await analizuj(stronaUrl)
    expect(sciezka.startsWith('/zadanie/')).toBe(true)

    const gotowe = await poczekajNaKoniec(sciezka)
    expect(gotowe).toContain('<h1>Gotowe</h1>')

    const idRaportu = /href="\/raport\/([^"]+)"/.exec(gotowe)?.[1]
    expect(idRaportu).toBeDefined()

    const raport = await (await fetch(`${panelUrl}/raport/${idRaportu}`)).text()
    expect(raport).toContain('Audyt techniczny')
    expect(raport).toContain('Ustalenia według wagi')
    // Raport z panelu ma to samo ograniczenie, co raport z pliku.
    expect(raport).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    // D18 obowiazuje takze w przegladarce.
    expect(raport).toContain('nie podaje oceny w skali 0–100')
  })

  it('po analizie witryna pojawia sie na liscie z liczbami', async () => {
    await poczekajNaKoniec(await analizuj(stronaUrl))
    const glowna = await (await fetch(`${panelUrl}/`)).text()
    expect(glowna).toContain('Twoje strony')
    expect(glowna).toMatch(/\d+ stron ·/)
  })

  it('tablica agenta pokazuje wnioski po uruchomieniu planu', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const przed = await (await fetch(`${panelUrl}/agent/${siteId}`)).text()
    expect(przed).toContain('Agent nie ma jeszcze żadnych wniosków')

    const plan = await fetch(`${panelUrl}/agent/${siteId}/plan`, {
      method: 'POST', redirect: 'manual',
    })
    expect(plan.status).toBe(303)

    const po = await (await fetch(`${panelUrl}/agent/${siteId}`)).text()
    expect(po).toContain('Tablica agenta')
    // Agent proponuje i nie wykonuje — to musi byc widoczne na stronie.
    expect(po).toContain('proponuje')
  })

  it('zly adres nie wywraca panelu, tylko mowi o co chodzi', async () => {
    const odpowiedz = await fetch(`${panelUrl}/analizuj`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: 'to nie jest adres' }),
      redirect: 'manual',
    })
    expect(odpowiedz.status).toBe(400)
    expect(await odpowiedz.text()).toContain('nie jest adresem')
  })

  it('inny schemat niz http i https jest odrzucany', async () => {
    const odpowiedz = await fetch(`${panelUrl}/analizuj`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: 'file:///etc/passwd' }),
      redirect: 'manual',
    })
    expect(odpowiedz.status).toBe(400)
    expect(await odpowiedz.text()).toContain('http i https')
  })

  it('nieosiagalna strona konczy sie bledem zadania, a nie padem serwera', async () => {
    const sciezka = await analizuj('http://127.0.0.1:1/')
    const wynik = await poczekajNaKoniec(sciezka)
    expect(wynik).toContain('Nie udało się')
    // Panel dalej odpowiada.
    expect((await fetch(`${panelUrl}/`)).status).toBe(200)
  })

  it('nieznane zadanie i nieznana strona daja 404 z linkiem powrotnym', async () => {
    for (const sciezka of ['/zadanie/nie-ma', '/raport/nie-ma', '/agent/nie-ma', '/cos']) {
      const odpowiedz = await fetch(`${panelUrl}${sciezka}`)
      expect(odpowiedz.status).toBe(404)
      expect(await odpowiedz.text()).toContain('wróć do panelu')
    }
  })

  it('liczba stron jest przycinana do sufitu panelu', async () => {
    // Wartosc ponad sufit nie moze przejsc do crawlera, nawet gdy ktos poda ja
    // recznie w zadaniu POST.
    const sciezka = await analizuj(stronaUrl, PANEL_MAX_PAGES * 10)
    const wynik = await poczekajNaKoniec(sciezka)
    expect(wynik).toContain('<h1>Gotowe</h1>')
  })

  it('bezsensowna liczba stron nie wywraca zadania', async () => {
    const odpowiedz = await fetch(`${panelUrl}/analizuj`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: stronaUrl, maxPages: 'duzo' }),
      redirect: 'manual',
    })
    expect(odpowiedz.status).toBe(303)
  })

  it('menu jest na kazdej stronie i linki dzialaja', async () => {
    for (const sciezka of ['/', '/strony', '/pomoc']) {
      const tresc = await (await fetch(`${panelUrl}${sciezka}`)).text()
      expect(tresc).toContain('href="/strony"')
      expect(tresc).toContain('href="/pomoc"')
      expect(tresc).toContain('class="marka"')
    }
  })

  it('kazdy link wewnetrzny ze startu prowadzi do istniejacej strony', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const start = await (await fetch(`${panelUrl}/`)).text()
    const linki = [...start.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1] as string)
    expect(linki.length).toBeGreaterThan(3)

    for (const link of new Set(linki)) {
      const odpowiedz = await fetch(`${panelUrl}${link}`)
      expect(odpowiedz.status, `link ${link} nie dziala`).toBe(200)
    }

    // To samo dla strony witryny — tam linkow jest najwiecej.
    const witryna = await (await fetch(`${panelUrl}/strona/${siteId}`)).text()
    for (const link of new Set([...witryna.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1] as string))) {
      expect((await fetch(`${panelUrl}${link}`)).status, `link ${link} nie dziala`).toBe(200)
    }
  })

  it('strona witryny pokazuje liczby z crawla i audytu', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const tresc = await (await fetch(`${panelUrl}/strona/${siteId}`)).text()
    expect(tresc).toContain('Ustalenia według wagi')
    expect(tresc).toContain('Najczęstsze ustalenia')
    expect(tresc).toContain('robots.txt')
    expect(tresc).toContain(`href="/raport/${siteId}"`)
    expect(tresc).toContain(`href="/agent/${siteId}"`)
  })

  it('lista witryn pokazuje dodana strone', async () => {
    await poczekajNaKoniec(await analizuj(stronaUrl))
    const tresc = await (await fetch(`${panelUrl}/strony`)).text()
    expect(tresc).toContain('Moje strony')
    expect(tresc).toContain('127.0.0.1')
  })

  it('pomoc mowi wprost, ktore silniki sa dostepne', async () => {
    const tresc = await (await fetch(`${panelUrl}/pomoc`)).text()
    expect(tresc).toContain('Silniki językowe')
    expect(tresc).toContain('groq')
    expect(tresc).toContain('anthropic')
    // Kazdy silnik ma stan: gotowy albo wylaczony.
    expect(tresc).toMatch(/plakietka (dobra|neutralna)/)
  })

  it('pomoc nie zdradza sciezki do klucza, tylko fakt jego obecnosci', async () => {
    const tresc = await (await fetch(`${panelUrl}/pomoc`)).text()
    expect(tresc).toContain('SEO_GSC_KEY_FILE')
    expect(tresc).not.toContain('.sa.json')
  })

  it('naglowki bezpieczenstwa sa ustawione', async () => {
    const odpowiedz = await fetch(`${panelUrl}/`)
    expect(odpowiedz.headers.get('x-frame-options')).toBe('DENY')
    expect(odpowiedz.headers.get('referrer-policy')).toBe('no-referrer')
  })
})
