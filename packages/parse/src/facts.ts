/**
 * `PageFacts` to jedyny ksztalt, o ktory pytaja reguly audytu. Zasada: fakt,
 * nie ocena. „Tytul ma 91 znakow" jest faktem, „tytul za dlugi" jest regula
 * i mieszka w @seo/rules. Dzieki temu progi da sie zmienic bez ruszania parsera.
 */

export interface MetaRobots {
  readonly raw: string | null
  readonly noindex: boolean
  readonly nofollow: boolean
  readonly noarchive: boolean
  readonly nosnippet: boolean
  readonly maxSnippet: number | null
  readonly maxImagePreview: string | null
}

export interface HeadingFact {
  readonly level: number
  readonly text: string
}

export type LinkRel = 'follow' | 'nofollow' | 'sponsored' | 'ugc'

export interface LinkFact {
  readonly href: string
  /** Adres bezwzgledny; `null`, gdy nie da sie rozwiazac wzgledem adresu strony. */
  readonly resolved: string | null
  readonly anchorText: string
  readonly rel: LinkRel
  readonly relTokens: readonly string[]
  readonly isInternal: boolean
  /** Link owiniety w obraz bez tekstu — kotwica jest pusta, ale link nie jest bledem. */
  readonly wrapsImage: boolean
}

export interface ImageFact {
  readonly src: string | null
  readonly resolved: string | null
  readonly hasAlt: boolean
  readonly alt: string
  readonly width: string | null
  readonly height: string | null
  readonly loading: string | null
  /** Kolejnosc w dokumencie — przyblizenie „nad zgieciem" bez renderowania. */
  readonly documentIndex: number
}

export interface JsonLdFact {
  readonly raw: string
  /** `null`, gdy blok nie jest poprawnym JSON-em. Blad skladni to fakt, nie wyjatek. */
  readonly parsed: unknown
  readonly parseError: string | null
  readonly types: readonly string[]
}

/** Zasob ladowany przez strone. Potrzebny do wykrycia tresci mieszanej (http na https). */
export type ResourceKind = 'script' | 'stylesheet' | 'image' | 'iframe' | 'media' | 'preload'

export interface ResourceFact {
  readonly kind: ResourceKind
  readonly url: string
  readonly resolved: string | null
}

export interface HreflangFact {
  readonly lang: string
  readonly href: string
  readonly resolved: string | null
}

export interface PageFacts {
  /** Adres, wzgledem ktorego rozwiazano linki. */
  readonly url: string
  readonly title: string | null
  readonly titleLength: number
  readonly titleCount: number
  readonly metaDescription: string | null
  readonly metaDescriptionLength: number
  readonly metaRobots: MetaRobots
  readonly canonicalRaw: string | null
  readonly canonicalResolved: string | null
  /** Wiecej niz jeden canonical to sprzecznosc — Google ignoruje wtedy wszystkie. */
  readonly canonicalCount: number
  /** Zawartosc `<meta http-equiv="refresh">`; przekierowanie, ktorego nie widac w HTTP. */
  readonly metaRefresh: string | null
  readonly lang: string | null
  readonly charset: string | null
  readonly viewport: string | null
  readonly headings: readonly HeadingFact[]
  readonly h1Count: number
  readonly h1Texts: readonly string[]
  /** Miejsca, w ktorych poziom naglowka przeskoczyl o wiecej niz jeden w dol. */
  readonly headingOrderJumps: readonly { readonly from: number; readonly to: number }[]
  readonly links: readonly LinkFact[]
  readonly images: readonly ImageFact[]
  readonly jsonLd: readonly JsonLdFact[]
  readonly openGraph: Readonly<Record<string, string>>
  readonly twitterCard: Readonly<Record<string, string>>
  readonly hreflang: readonly HreflangFact[]
  readonly resources: readonly ResourceFact[]
  readonly text: string
  readonly wordCount: number
  /** Udzial tekstu w bajtach dokumentu. Niski przy stronie zlozonej z samego JS. */
  readonly textToHtmlRatio: number
  /** Pierwszy akapit po pierwszym `H1` — material na odpowiedz wprost dla AI. */
  readonly firstParagraphAfterH1: string | null
  readonly scriptCount: number
  readonly inlineScriptCount: number
  readonly stylesheetCount: number
  readonly inlineStyleCount: number
  readonly iframeCount: number
  readonly hasNoscript: boolean
  readonly htmlBytes: number
}
