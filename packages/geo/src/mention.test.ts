import { describe, expect, it } from 'vitest'
import {
  detectInAnswers,
  detectMentions,
  measurePrompts,
  normalizeAnswer,
  shareOfVoice,
  visibility,
  type EngineAnswer,
  type EntityDefinition,
} from './mention.js'

const marka: EntityDefinition = {
  id: 'e-marka',
  name: 'Mentiometry',
  variants: ['Mentiometrym', 'Mentiometrach', 'mentiometry.com'],
  exclusions: [],
  version: 1,
}

const konkurent: EntityDefinition = {
  id: 'e-konkurent',
  name: 'Semrush',
  variants: ['Semrusha'],
  exclusions: [],
  version: 1,
}

describe('normalizeAnswer', () => {
  it('scala biale znaki, zachowuje podzial na akapity', () => {
    expect(normalizeAnswer('  Pierwszy   akapit.  \n\n\n\n Drugi \takapit. ')).toBe(
      'Pierwszy akapit.\n\nDrugi akapit.',
    )
  })

  it('normalizuje konce linii z Windowsa', () => {
    expect(normalizeAnswer('a\r\n\r\nb')).toBe('a\n\nb')
  })

  it('jest idempotentna — inaczej pozycje z D30 zalezalyby od liczby przebiegow', () => {
    const raz = normalizeAnswer(' A  b \r\n\n\n c ')
    expect(normalizeAnswer(raz)).toBe(raz)
  })
})

describe('detectMentions', () => {
  it('AC6: nie lapie nazwy wewnatrz dluzszego slowa', () => {
    const { mentions } = detectMentions('Polecam Mentiometryczne badania.', [marka])
    expect(mentions).toHaveLength(0)
  })

  it('AC6: lapie odmiane zadeklarowana jako wariant', () => {
    const { mentions } = detectMentions('Zmierzysz to Mentiometrym w tydzien.', [marka])
    expect(mentions).toHaveLength(1)
    expect(mentions[0]?.matched).toBe('Mentiometrym')
    expect(mentions[0]?.entityId).toBe('e-marka')
  })

  it('nie zgaduje odmiany, ktorej nikt nie zadeklarowal', () => {
    // „Mentiometrom" nie ma na liscie wariantow. Milczymy zamiast zgadywac —
    // automatyczny stemmer dokladalby wlasne bledy do pomiaru bledow.
    const { mentions } = detectMentions('Dzieki Mentiometrom widac wiecej.', [marka])
    expect(mentions).toHaveLength(0)
  })

  it('dziala z polskimi znakami na granicy slowa', () => {
    // `\b` z JavaScriptu zna tylko ASCII i tutaj by nie zadzialal.
    const zolw: EntityDefinition = {
      id: 'e-zolw', name: 'Żółw', variants: ['Żółwia'], exclusions: [], version: 1,
    }
    expect(detectMentions('Kupilem Żółwia wczoraj.', [zolw]).mentions).toHaveLength(1)
    expect(detectMentions('To jest Żółwiowaty ksztalt.', [zolw]).mentions).toHaveLength(0)
  })

  it('nie rozroznia wielkosci liter', () => {
    expect(detectMentions('mentiometry to narzedzie', [marka]).mentions).toHaveLength(1)
  })

  it('wariant domenowy nie lapie sie wewnatrz dluzszej domeny', () => {
    const domena: EntityDefinition = {
      id: 'e-domena', name: 'mentiometry.com', variants: [], exclusions: [], version: 1,
    }
    expect(detectMentions('Wejdz na mentiometry.com po wiecej.', [domena]).mentions).toHaveLength(1)
    expect(detectMentions('Adres to mentiometry.community', [domena]).mentions).toHaveLength(0)
  })

  it('nazwa glowna w cudzej domenie liczy sie — chyba ze jest w wykluczeniach', () => {
    // Kropka jest granica slowa, wiec „mentiometry" w „mentiometry.community"
    // to prawdziwe wystapienie nazwy i detektor ma prawo je zglosic. Uznanie,
    // ze akurat ta domena to nie my, jest **polityka o konkretnym ciagu** —
    // a D29 stawia takie decyzje w liscie wykluczen, czyli w danych, nie w kodzie.
    expect(detectMentions('Adres to mentiometry.community', [marka]).mentions).toHaveLength(1)

    const zWykluczeniem: EntityDefinition = {
      ...marka, exclusions: ['mentiometry.community'], version: 2,
    }
    expect(detectMentions('Adres to mentiometry.community', [zWykluczeniem]).mentions)
      .toHaveLength(0)
  })

  it('honoruje wykluczenia', () => {
    const delta: EntityDefinition = {
      id: 'e-delta', name: 'Delta', variants: [], exclusions: ['delta rzeki'], version: 1,
    }
    expect(detectMentions('Odwiedzilem delte, a wlasciwie delta rzeki.', [delta]).mentions)
      .toHaveLength(0)
    expect(detectMentions('Delta wypada najlepiej.', [delta]).mentions).toHaveLength(1)
  })

  it('nie liczy dwa razy tego samego miejsca, gdy wariant powtarza nazwe', () => {
    const dublet: EntityDefinition = {
      id: 'e-dublet', name: 'Alfa', variants: ['Alfa', 'alfa'], exclusions: [], version: 1,
    }
    expect(detectMentions('Alfa jest pierwsza.', [dublet]).mentions).toHaveLength(1)
  })

  it('D30: pozycja to udzial znakow, a numer akapitu liczy sie od zera', () => {
    const tekst = 'Pierwszy akapit bez marki.\n\nDrugi akapit: Mentiometry.'
    const { normalized, mentions } = detectMentions(tekst, [marka])
    const hit = mentions[0]
    expect(hit).toBeDefined()
    expect(hit?.paragraph).toBe(1)
    expect(hit?.positionShare).toBeCloseTo((hit?.start ?? 0) / normalized.length, 12)
    expect(hit?.positionShare).toBeGreaterThan(0.5)
  })

  it('D30: wzmianka na samym poczatku ma pozycje 0', () => {
    const { mentions } = detectMentions('Mentiometry mierzy wzmianki.', [marka])
    expect(mentions[0]?.positionShare).toBe(0)
    expect(mentions[0]?.paragraph).toBe(0)
  })

  it('pusta odpowiedz nie wybucha', () => {
    expect(detectMentions('', [marka])).toEqual({ normalized: '', mentions: [] })
  })

  it('zwraca wzmianki roznych encji w kolejnosci wystapienia', () => {
    const { mentions } = detectMentions('Semrush i Mentiometry to inne narzedzia.', [
      marka, konkurent,
    ])
    expect(mentions.map((m) => m.entityId)).toEqual(['e-konkurent', 'e-marka'])
  })
})

const odpowiedz = (promptId: string, runIndex: number, text: string): EngineAnswer => ({
  promptId, runIndex, text,
})

describe('measurePrompts', () => {
  it('D23: agreguje po prompcie, nie po przebiegu', () => {
    const detected = detectInAnswers(
      [
        odpowiedz('p1', 0, 'Polecam Mentiometry.'),
        odpowiedz('p1', 1, 'Nie znam takiego narzedzia.'),
        odpowiedz('p1', 2, 'Mentiometry i Semrush.'),
        odpowiedz('p2', 0, 'Semrush.'),
        odpowiedz('p2', 1, 'Semrush.'),
        odpowiedz('p2', 2, 'Semrush.'),
      ],
      [marka, konkurent],
    )
    expect(measurePrompts(detected, 'e-marka')).toEqual([
      { promptId: 'p1', hits: 2, trials: 3 },
      { promptId: 'p2', hits: 0, trials: 3 },
    ])
  })

  it('kilka wzmianek w jednej odpowiedzi to jedno trafienie', () => {
    const detected = detectInAnswers(
      [odpowiedz('p1', 0, 'Mentiometry, znowu Mentiometry, i jeszcze Mentiometry.')],
      [marka],
    )
    expect(measurePrompts(detected, 'e-marka')).toEqual([
      { promptId: 'p1', hits: 1, trials: 1 },
    ])
  })
})

describe('visibility', () => {
  it('daje odsetek z przedzialem, a nie sama liczbe', () => {
    const detected = detectInAnswers(
      [
        odpowiedz('p1', 0, 'Mentiometry.'),
        odpowiedz('p1', 1, 'Nic.'),
        odpowiedz('p1', 2, 'Nic.'),
      ],
      [marka],
    )
    const wynik = visibility(detected, 'e-marka')
    expect(wynik.rate).toBeCloseTo(1 / 3, 10)
    expect(wynik.interval.low).toBeGreaterThan(0)
    expect(wynik.interval.high).toBeLessThan(1)
    // Przy trzech przebiegach przedzial jest szerszy niz pol skali — i to jest
    // uczciwa informacja, a nie wada pomiaru.
    expect(wynik.interval.high - wynik.interval.low).toBeGreaterThan(0.5)
  })
})

describe('shareOfVoice', () => {
  it('liczy odpowiedzi ze wzmianka, a nie liczbe wzmianek', () => {
    const detected = detectInAnswers(
      [
        odpowiedz('p1', 0, 'Mentiometry, Mentiometry, Mentiometry.'),
        odpowiedz('p1', 1, 'Semrush.'),
      ],
      [marka, konkurent],
    )
    const wynik = shareOfVoice(detected, [marka, konkurent])
    expect(wynik.map((v) => v.answersWithMention)).toEqual([1, 1])
    expect(wynik[0]?.share.rate).toBeCloseTo(0.5, 10)
  })

  it('podaje mediane pozycji pierwszej wzmianki, a null gdy encji nie bylo', () => {
    const detected = detectInAnswers(
      [
        odpowiedz('p1', 0, 'Mentiometry na starcie.'),
        odpowiedz('p1', 1, 'Najpierw duzo tekstu bez marki, a dopiero potem Mentiometry.'),
      ],
      [marka, konkurent],
    )
    const [nasza, ich] = shareOfVoice(detected, [marka, konkurent])
    expect(nasza?.medianFirstPosition).toBeGreaterThan(0)
    expect(ich?.medianFirstPosition).toBeNull()
    expect(ich?.share.rate).toBe(0)
  })

  it('brak jakichkolwiek wzmianek nie dzieli przez zero', () => {
    const detected = detectInAnswers([odpowiedz('p1', 0, 'Nie wiem.')], [marka, konkurent])
    const wynik = shareOfVoice(detected, [marka, konkurent])
    expect(wynik.every((v) => v.share.rate === 0)).toBe(true)
    // Bez prob nie wiemy nic — przedzial to cala skala, nie zero.
    expect(wynik[0]?.share.interval).toEqual({ low: 0, high: 1 })
  })
})
