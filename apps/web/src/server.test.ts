import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { openInitialized } from '@seo/cli/lib'
import { tenantScope } from '@seo/core'
import { closeDatabase, repos } from '@seo/db'
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

/**
 * Klucze silnikow **zdejmowane na czas testow**.
 *
 * Bez tego suita zachowywalaby sie inaczej na maszynie, gdzie wlasciciel
 * wyeksportowal `SEO_GROQ_KEY` — i, co gorsza, trasa `/geo/:id/run` poszlaby
 * naprawde do sieci. Testy dzialaja bez sieci i to nie jest wygoda, tylko
 * warunek: jedyne prawdziwe wywolanie API w calym projekcie to `seo gsc smoke`.
 */
const KLUCZE_SILNIKOW = [
  'SEO_GEMINI_KEY', 'SEO_GROQ_KEY', 'SEO_OPENROUTER_KEY', 'SEO_ANTHROPIC_KEY',
] as const

beforeEach(async () => {
  for (const klucz of KLUCZE_SILNIKOW) vi.stubEnv(klucz, undefined)
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
  vi.unstubAllEnvs()
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

/** Frazy prosto do bazy — panel czyta ta sama sciezka, co po `seo gsc sync`. */
function zasiej(
  siteId: string,
  wiersze: readonly { query: string; clicks: number; impressions: number; position: number }[],
): void {
  const scope = tenantScope('local')
  const { db } = openInitialized({
    dbPath: join(dir, 'seo.db'), tenantId: 'local', gscKeyFile: undefined,
  })
  try {
    const r = repos(db, scope)
    const run = r.write.startSyncRun(siteId, '2026-03-01', '2026-03-01', 'final', 'date,query')
    r.write.upsertQueryDaily(siteId, run, wiersze.map((w) => ({
      date: '2026-03-01',
      query: w.query,
      clicks: w.clicks,
      impressions: w.impressions,
      ctr: w.impressions === 0 ? 0 : w.clicks / w.impressions,
      position: w.position,
    })))
  } finally { closeDatabase(db) }
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

  it('pomiar z tablicy agenta dziala i mowi, czego brakuje', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const odpowiedz = await fetch(`${panelUrl}/agent/${siteId}/measure`, { method: 'POST' })
    expect(odpowiedz.status).toBe(200)
    const tresc = await odpowiedz.text()
    expect(tresc).toContain('Ostatni pomiar')
    // Bez danych z Search Console nie ma eksperymentow — i panel mowi to wprost,
    // zamiast pokazywac pusta liste.
    expect(tresc).toContain('Nie było czego mierzyć')
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

  /**
   * Wczesniej ten test sprawdzal, ze na stronie nie ma ciagu `.sa.json`. To byl
   * **wskaznik zastepczy**, a nie sedno: `~/.seo/gsc.sa.json` to udokumentowane
   * miejsce, takie samo dla kazdego, i uzytkownik musi je zobaczyc, zeby wiedziec,
   * gdzie polozyc plik. Wyciekiem byloby wypisanie **rozwiazanej** sciezki —
   * ta niesie nazwe konta w systemie. Test sprawdza teraz dokladnie to.
   */
  it('pomoc podaje fakt obecnosci klucza, nigdy rozwiazanej sciezki do niego', async () => {
    const tajna = join(dir, 'skarbiec', 'konto-wlasciciela.sa.json')
    const zKluczem = createPanel({
      dbPath: join(dir, 'seo.db'), tenantId: 'local', gscKeyFile: tajna,
    })
    await new Promise<void>((r) => zKluczem.listen(0, '127.0.0.1', r))
    const adres = `http://127.0.0.1:${(zKluczem.address() as AddressInfo).port}`

    try {
      const tresc = await (await fetch(`${adres}/pomoc`)).text()
      expect(tresc).toContain('klucz znaleziony')
      expect(tresc).not.toContain(tajna)
      expect(tresc).not.toContain('konto-wlasciciela')
    } finally {
      await new Promise((r) => zKluczem.close(r))
    }
  })

  it('naglowki bezpieczenstwa sa ustawione', async () => {
    const odpowiedz = await fetch(`${panelUrl}/`)
    expect(odpowiedz.headers.get('x-frame-options')).toBe('DENY')
    expect(odpowiedz.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('llms.txt powstaje z zapisanego crawla i da sie go pobrac', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const podglad = await (await fetch(`${panelUrl}/llms-txt/${siteId}`)).text()
    expect(podglad).toContain('<h1>llms.txt</h1>')
    expect(podglad).toContain('Strona glowna')

    const plik = await fetch(`${panelUrl}/llms-txt/${siteId}?format=txt`)
    expect(plik.headers.get('content-type')).toContain('text/plain')
    expect(plik.headers.get('content-disposition')).toContain('llms.txt')
    const tresc = await plik.text()
    expect(tresc.startsWith('#')).toBe(true)
    expect(tresc).toContain('/oferta')
  })

  it('tracker GEO mowi wprost, czego brakuje do pomiaru', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const tresc = await (await fetch(`${panelUrl}/geo/${siteId}`)).text()
    expect(tresc).toContain('<h1>Widoczność w AI</h1>')
    expect(tresc).toContain('brakuje danych')
    expect(tresc).toContain('definicji własnej marki')
    expect(tresc).toContain('choć jednego promptu')
    // Przycisk pomiaru nie moze istniec, dopoki nie ma czego mierzyc.
    expect(tresc).not.toContain('Zmierz widoczność')
  })

  it('marka i prompty zapisuja sie z panelu, a kolejna zmiana zaklada nowa wersje', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const zapisz = async (variants: string): Promise<Response> => fetch(
      `${panelUrl}/geo/${siteId}/encja`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ name: 'Mentiometry', variants, wlasna: '1' }),
        redirect: 'manual',
      },
    )

    const pierwsza = await zapisz('mentiometry')
    expect(pierwsza.status).toBe(303)
    expect(decodeURIComponent(pierwsza.headers.get('location') as string))
      .toContain('wersja 1')

    // D29: zmiana wariantow zaklada nowa wersje, a stara zostaje w bazie.
    const druga = await zapisz('mentiometry, mentiometry.com')
    expect(decodeURIComponent(druga.headers.get('location') as string))
      .toContain('wersja 2')

    const prompty = await fetch(`${panelUrl}/geo/${siteId}/prompty`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ prompty: 'jak zmierzyć widoczność w AI\n\nnajlepszy audyt SEO' }),
      redirect: 'manual',
    })
    expect(prompty.status).toBe(303)
    // Pusta linia miedzy promptami nie jest promptem.
    expect(decodeURIComponent(prompty.headers.get('location') as string))
      .toContain('dodano 2, w zestawie 2')

    const strona = await (await fetch(`${panelUrl}/geo/${siteId}`)).text()
    expect(strona).toContain('Mentiometry')
    expect(strona).toContain('wersja 2')
    expect(strona).toContain('jak zmierzyć widoczność w AI')
    expect(strona).toContain('najlepszy audyt SEO')
  })

  it('pomiar bez klucza konczy sie bledem z powodem, a nie cisza', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const uruchom = await fetch(`${panelUrl}/geo/${siteId}/run`, {
      method: 'POST', redirect: 'manual',
    })
    expect(uruchom.status).toBe(303)

    const wynik = await poczekajNaKoniec(uruchom.headers.get('location') as string)
    expect(wynik).toContain('Nie udało się')
    // Powod jest wypisany co do silnika — D17 obowiazuje takze tutaj.
    expect(wynik).toContain('groq')
  })

  it('silnik tresci odmawia liczenia bez danych z Search Console', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const tresc = await (await fetch(`${panelUrl}/tresc/${siteId}`)).text()
    expect(tresc).toContain('<h1>Silnik treści</h1>')
    expect(tresc).toContain('brak danych z Search Console')
    expect(tresc).toContain('Ta warstwa nie ma z czego liczyć')
    // Bez danych nie pokazujemy formularza, ktory i tak nie mialby czego policzyc.
    expect(tresc).not.toContain('Policz klastry')
  })

  it('klastrowanie odrzuca date w zlym ksztalcie zamiast ja parsowac', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const odpowiedz = await fetch(`${panelUrl}/tresc/${siteId}/klastry`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ from: '1 marca 2026', to: '2026-03-31' }),
      redirect: 'manual',
    })
    expect(odpowiedz.status).toBe(400)
    expect(await odpowiedz.text()).toContain('RRRR-MM-DD')
  })

  it('strona witryny prowadzi do wszystkich czterech warstw', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const tresc = await (await fetch(`${panelUrl}/strona/${siteId}`)).text()
    for (const sciezka of ['/raport/', '/agent/', '/geo/', '/tresc/', '/llms-txt/']) {
      expect(tresc).toContain(`href="${sciezka}${siteId}"`)
    }
  })

  it('nieznana strona pod nowymi trasami konczy sie 404, nie wyjatkiem', async () => {
    for (const sciezka of ['/geo/brak', '/tresc/brak', '/llms-txt/brak', '/brief/brak']) {
      const odpowiedz = await fetch(`${panelUrl}${sciezka}`)
      expect(odpowiedz.status).toBe(404)
    }
  })

  it('z frazami w bazie panel liczy klastry i robi z nich brief', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    // Frazy wstrzykniete prosto do bazy — `seo gsc sync` wymaga sieci i konta
    // serwisowego, a tu sprawdzamy panel, nie Google. Daty sa tekstem
    // przepisanym doslownie, dokladnie tak, jak przychodza z API (D3).
    zasiej(siteId, [
      { query: 'audyt seo warszawa', clicks: 12, impressions: 900, position: 8.2 },
      { query: 'audyt seo cennik', clicks: 6, impressions: 640, position: 11.4 },
      { query: 'audyt seo firma', clicks: 3, impressions: 410, position: 14.1 },
      { query: 'audyt seo ile kosztuje', clicks: 2, impressions: 280, position: 17.9 },
    ])

    const przed = await (await fetch(`${panelUrl}/tresc/${siteId}`)).text()
    expect(przed).toContain('Policz klastry')
    expect(przed).toContain('2026-03-01')

    const klastry = await fetch(`${panelUrl}/tresc/${siteId}/klastry`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ from: '2026-03-01', to: '2026-03-01' }),
      redirect: 'manual',
    })
    expect(klastry.status).toBe(303)
    const cel = klastry.headers.get('location') as string
    // D33: metoda zapasowa melduje sie wprost, a nie udaje pomiaru SERP.
    expect(decodeURIComponent(cel)).toContain('uwaga=')

    const zKlastrami = await (await fetch(`${panelUrl}${cel}`)).text()
    expect(zKlastrami).toContain('podobieństwo słów')
    expect(zKlastrami).toContain('metoda zapasowa')
    expect(zKlastrami).toContain('audyt seo')
    expect(zKlastrami).toContain('Zrób brief')

    const slug = /name="slug" value="([^"]+)"/.exec(zKlastrami)?.[1] as string
    expect(slug).toBeDefined()

    const brief = await fetch(`${panelUrl}/tresc/${siteId}/brief`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ slug }),
      redirect: 'manual',
    })
    expect(brief.status).toBe(303)

    const tresc = await (await fetch(`${panelUrl}${brief.headers.get('location')}`)).text()
    expect(tresc).toContain('audyt seo')
    expect(tresc).toContain('pre class="zrzut"')
    // D38: dla pokrytego tematu domyslna decyzja jest odswiezenie, nie nowa strona.
    expect(tresc).toMatch(/odświeżyć istniejącą|napisać nową/)

    const lista = await (await fetch(`${panelUrl}/tresc/${siteId}`)).text()
    expect(lista).toContain('/brief/')
  })

  it('HEAD na istniejacym adresie nie udaje 404', async () => {
    const gotowe = await poczekajNaKoniec(await analizuj(stronaUrl))
    const siteId = /href="\/strona\/([^"]+)"/.exec(gotowe)?.[1] as string

    const glowa = await fetch(`${panelUrl}/strona/${siteId}`, { method: 'HEAD' })
    expect(glowa.status).toBe(200)
    expect(glowa.headers.get('content-type')).toContain('text/html')

    const plik = await fetch(`${panelUrl}/llms-txt/${siteId}?format=txt`, { method: 'HEAD' })
    expect(plik.status).toBe(200)
    expect(plik.headers.get('content-type')).toContain('text/plain')
    expect(plik.headers.get('content-disposition')).toContain('llms.txt')
  })

  it('pomoc prowadzi przez dodanie dostepu do Search Console, gdy klucza brak', async () => {
    const tresc = await (await fetch(`${panelUrl}/pomoc`)).text()
    expect(tresc).toContain('brak klucza')
    expect(tresc).toContain('Konto serwisowe w Google Cloud')
    expect(tresc).toContain('~/.seo/gsc.sa.json')
    expect(tresc).toContain('Użytkownicy i uprawnienia')
    // Sciezka do klucza to instrukcja, a nie sekret — ale sam klucz nigdy nie wycieka.
    expect(tresc).not.toContain('client_secret')
    expect(tresc).not.toContain('BEGIN PRIVATE KEY')
  })
})
