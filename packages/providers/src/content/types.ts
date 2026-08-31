/** Draft wygenerowany przez silnik — surowy, **przed** bramkami. */
export interface GeneratedDraft {
  readonly title: string
  readonly markdown: string
  /** Zasoby zadeklarowane przez model. Bramka i tak je sprawdzi (D37). */
  readonly uniqueAssets: readonly {
    readonly kind: 'own-data' | 'first-hand-quote' | 'original-diagram' | 'expert-byline'
    readonly description: string
    readonly source: string
  }[]
  readonly engine: string
  readonly modelVersion: string
  readonly promptId: string
  /** Niepuste, gdy wywolanie sie nie udalo — draft jest wtedy pusty. */
  readonly error: string | null
  /** Niepuste, gdy model odmowil. Odmowa jest danymi, nie awaria. */
  readonly refusalReason: string | null
}

export interface ContentProvider {
  readonly engine: string
  readonly modelVersion: string
  /** `briefMarkdown` to dokladnie ten sam tekst, ktory widzi recenzent w PR (D41). */
  generate(briefMarkdown: string, promptId: string): Promise<GeneratedDraft>
}
