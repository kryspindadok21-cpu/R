import type { WindowStats } from './did.js'

/**
 * Dobor grupy kontrolnej (D49).
 *
 * Strony kontrolne wybiera sie **w chwili planowania akcji**, na podstawie
 * podobienstwa okresu przed, i zapisuje razem z eksperymentem. Dobor po
 * zobaczeniu wynikow to nie grupa kontrolna, tylko sposob na uzyskanie wyniku,
 * ktorego sie oczekuje.
 *
 * Ten modul nie ma dostepu do danych „po" i to jest celowe: nie da sie napisac
 * funkcji, ktora dobiera kontrole po wynikach, bo nie ma ich czym zobaczyc.
 */

export interface CandidatePage {
  readonly url: string
  /** Wylacznie okres PRZED. Danych „po" ten modul nie widzi. */
  readonly before: WindowStats
  readonly clickDepth: number | null
}

export interface ControlMatch {
  readonly url: string
  /** Odleglosc od strony zmienionej; mniej znaczy podobniej. */
  readonly distance: number
  readonly basis: string
}

export interface ControlSelection {
  readonly treatmentUrls: readonly string[]
  readonly control: readonly ControlMatch[]
  readonly selectedAt: number
  /** Powod, gdy nie udalo sie zebrac tylu stron, ile proszono. */
  readonly shortfall: string | null
}

/** Ile stron kontrolnych na jedna zmieniona. Wiecej kontroli zwęża przedzial. */
export const CONTROLS_PER_TREATMENT = 4

/**
 * Odleglosc miedzy stronami w okresie przed.
 *
 * Skladniki sa **znormalizowane logarytmicznie**, bo ruch ma rozklad skrajnie
 * skosny: roznica miedzy 10 a 100 wyswietleniami znaczy wiecej niz miedzy
 * 10 000 a 10 090, choc w liczbach bezwzglednych jest identyczna.
 */
export function pageDistance(a: CandidatePage, b: CandidatePage): number {
  const log = (v: number): number => Math.log10(Math.max(v, 0) + 1)
  const wyswietlenia = Math.abs(log(a.before.impressions) - log(b.before.impressions))
  const klikniecia = Math.abs(log(a.before.clicks) - log(b.before.clicks))
  const pozycja = Math.abs(a.before.position - b.before.position) / 20
  const glebokosc = a.clickDepth === null || b.clickDepth === null
    ? 0.5
    : Math.abs(a.clickDepth - b.clickDepth) / 5
  return wyswietlenia + klikniecia + pozycja + glebokosc
}

/**
 * Dobiera kontrole do stron zmienionych.
 *
 * Strona kontrolna moze zostac wybrana **tylko raz**. Ta sama strona liczona
 * jako kontrola dla kilku zmienionych zawyzalaby liczebnosc grupy, a wiec
 * i precyzje przedzialu — przedzial obliczony z powtorzen jest wezszy, niz
 * dane na to pozwalaja.
 */
export function selectControlGroup(
  treatment: readonly CandidatePage[],
  candidates: readonly CandidatePage[],
  options: { readonly perTreatment?: number; readonly now?: () => number } = {},
): ControlSelection {
  const perTreatment = options.perTreatment ?? CONTROLS_PER_TREATMENT
  const treatmentUrls = new Set(treatment.map((p) => p.url))

  const dostepne = candidates.filter((c) => !treatmentUrls.has(c.url))
  const wybrane = new Map<string, ControlMatch>()
  const potrzeba = treatment.length * perTreatment

  // Rundy zamiast „najlepsze N dla kazdej strony po kolei": pierwsza zmieniona
  // strona nie ma zabrac wszystkich dobrych kandydatow.
  for (let runda = 0; runda < perTreatment; runda += 1) {
    for (const zmieniona of treatment) {
      const najblizszy = dostepne
        .filter((c) => !wybrane.has(c.url))
        .map((c) => ({ page: c, distance: pageDistance(zmieniona, c) }))
        .sort((a, b) => a.distance - b.distance || a.page.url.localeCompare(b.page.url))[0]

      if (najblizszy === undefined) break

      wybrane.set(najblizszy.page.url, {
        url: najblizszy.page.url,
        distance: najblizszy.distance,
        basis: `najblizsza stronie ${zmieniona.url} w okresie przed `
          + `(odleglosc ${najblizszy.distance.toFixed(2)})`,
      })
    }
  }

  const control = [...wybrane.values()]
    .sort((a, b) => a.distance - b.distance || a.url.localeCompare(b.url))

  return {
    treatmentUrls: treatment.map((p) => p.url),
    control,
    selectedAt: (options.now ?? Date.now)(),
    shortfall: control.length >= potrzeba
      ? null
      : `wybrano ${control.length} stron kontrolnych z potrzebnych ${potrzeba}; `
        + `w serwisie bylo ${dostepne.length} kandydatow poza grupa zmieniona`,
  }
}
