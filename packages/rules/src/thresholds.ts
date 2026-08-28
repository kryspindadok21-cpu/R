/**
 * Wszystkie progi w jednym pliku. Powod: progi wymagaja korekty po pierwszym
 * przebiegu na prawdziwej stronie (§8 specyfikacji Fazy 1), a korekta nie moze
 * oznaczac grzebania w kilkunastu regulach.
 *
 * Kazda wartosc ma uzasadnienie. Prog bez uzasadnienia to zgadywanie udajace pomiar.
 */
export interface Thresholds {
  /** Powyzej tej dlugosci tytul bywa ucinany w wynikach wyszukiwania. */
  readonly titleMaxLength: number
  /** Ponizej tej dlugosci tytul nie niesie kontekstu — sama nazwa marki nie wystarcza. */
  readonly titleMinLength: number
  /** Google i tak przepisuje opisy, ale powyzej tej dlugosci ucina je zawsze. */
  readonly descriptionMaxLength: number
  readonly descriptionMinLength: number
  /** Ponizej tylu slow strona rzadko odpowiada na cokolwiek samodzielnie. */
  readonly thinContentWords: number
  /** Tekst alternatywny dluzszy niz to jest opisem, a nie etykieta. */
  readonly altMaxLength: number
  /** Liczba klikniec od strony glownej, powyzej ktorej strona jest praktycznie ukryta. */
  readonly maxClickDepth: number
  /** Dlugosc lancucha przekierowan, ktora zaczyna kosztowac budzet crawlowania. */
  readonly maxRedirectHops: number
  /** Czas odpowiedzi serwera, powyzej ktorego crawler i uzytkownik odczuwaja zwloke. */
  readonly slowResponseMs: number
  /** Rozmiar samego HTML — nie zasobow. Powyzej tego dokument jest przeladowany. */
  readonly heavyHtmlBytes: number
  /** Minimalna liczba slow w pierwszym akapicie, zeby uznac go za odpowiedz wprost. */
  readonly answerUpfrontMinWords: number
  /** Ponizej tylu znakow naglowek nie niesie wlasnego kontekstu dla fragmentu. */
  readonly standaloneHeadingMinLength: number
  /** Dlugosc sciezki adresu, powyzej ktorej adres jest trudny do udostepnienia. */
  readonly urlMaxLength: number
  /**
   * Minimalna liczba slow, zeby uznac dwie strony za duplikat tresci. Ponizej
   * tego progu „identyczna tresc" znaczy zwykle „obie strony sa puste", a to
   * jest inny problem i inna regula.
   */
  readonly duplicateContentMinWords: number
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  titleMaxLength: 60,
  titleMinLength: 15,
  descriptionMaxLength: 160,
  descriptionMinLength: 50,
  thinContentWords: 150,
  altMaxLength: 125,
  maxClickDepth: 4,
  maxRedirectHops: 2,
  slowResponseMs: 1500,
  heavyHtmlBytes: 500_000,
  answerUpfrontMinWords: 12,
  standaloneHeadingMinLength: 12,
  urlMaxLength: 115,
  duplicateContentMinWords: 50,
}
