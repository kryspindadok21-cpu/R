import { describe, expect, it } from 'vitest'
import { approveDraft, type ApprovedDraft, type DraftInput } from './gates.js'
import type { CorpusDocument } from './originality.js'

const TRESC = `
Zmierzyliśmy widoczność marki w odpowiedziach trzech modeli językowych przez
sześć tygodni. Model z dostępem do wyszukiwarki wymieniał nas o jedenaście
punktów procentowych częściej niż ten sam model odpowiadający z pamięci.
Różnica utrzymała się w każdym tygodniu pomiaru i nie dało się jej wytłumaczyć
zmianą treści na stronie, bo strona w tym czasie nie była ruszana.
`

const OBCY: CorpusDocument[] = [{
  id: 'konkurent',
  text: 'Kwas foliowy w diecie kobiet w ciąży jest przedmiotem badań od lat '
    + 'siedemdziesiątych. Zalecana dzienna dawka wynosi czterysta mikrogramów '
    + 'i powinna być przyjmowana już na etapie planowania ciąży.',
}]

const DRAFT: DraftInput = {
  title: 'Grounding zmienia widoczność o jedenaście punktów',
  markdown: TRESC,
  author: { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' },
  uniqueAssets: [{
    kind: 'own-data',
    description: 'Sześć tygodni pomiaru na 50 promptach, trzy silniki',
    source: 'własny tracker GEO, przebiegi 2026-07-15 .. 2026-08-26',
  }],
  engine: 'groq',
  modelVersion: 'llama-3.3-70b-versatile',
  promptId: 'brief-01',
}

const OPCJE = { corpus: OBCY, now: () => 1_700_000_000_000 }

describe('approveDraft', () => {
  it('draft z zasobem, autorem i oryginalna trescia przechodzi', () => {
    const wynik = approveDraft(DRAFT, OPCJE)
    expect(wynik.kind).toBe('approved')
    if (wynik.kind !== 'approved') return
    expect(wynik.draft.approvedAt).toBe(1_700_000_000_000)
    expect(wynik.draft.originality.passed).toBe(true)
    // Metadane modelu wedruja razem z draftem (D40).
    expect(wynik.draft.engine).toBe('groq')
    expect(wynik.draft.modelVersion).toBe('llama-3.3-70b-versatile')
  })

  it('D37: brak unikalnego zasobu odrzuca draft', () => {
    const wynik = approveDraft({ ...DRAFT, uniqueAssets: [] }, OPCJE)
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.map((f) => f.gate)).toContain('unique-asset')
    expect(wynik.failures[0]?.reason).toContain('streszczeniem cudzych artykulow')
  })

  it('D37: zasob zadeklarowany, ale bez zrodla, nie liczy sie', () => {
    const wynik = approveDraft({
      ...DRAFT,
      uniqueAssets: [{ kind: 'own-data', description: 'jakieś dane', source: '  ' }],
    }, OPCJE)
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.find((f) => f.gate === 'unique-asset')?.reason)
      .toContain('bez zrodla')
  })

  it('D34: przepisana tresc jest odrzucona z dowodem', () => {
    const wynik = approveDraft(DRAFT, { ...OPCJE, corpus: [{ id: 'top10-1', text: TRESC }] })
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    const powod = wynik.failures.find((f) => f.gate === 'originality')?.reason ?? ''
    expect(powod).toContain('top10-1')
    expect(powod).toContain('pokrywajace sie fragmenty')
  })

  it('D34: brak zestawu porownawczego blokuje, a nie przepuszcza', () => {
    const wynik = approveDraft(DRAFT, { ...OPCJE, corpus: [] })
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.find((f) => f.gate === 'originality')?.reason)
      .toContain('nie da sie ocenic')
  })

  it('D39: autor bez nazwiska odrzuca draft', () => {
    const wynik = approveDraft({
      ...DRAFT, author: { name: '  ', sameAs: 'https://przyklad.test/o-mnie' },
    }, OPCJE)
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.find((f) => f.gate === 'author')?.reason)
      .toContain('nigdy nie generujemy encji autorskich')
  })

  it('D39: sameAs, ktore nie jest adresem, odrzuca draft', () => {
    const wynik = approveDraft({
      ...DRAFT, author: { name: 'Jan Kowalski', sameAs: 'ekspert branzowy' },
    }, OPCJE)
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.find((f) => f.gate === 'author')?.reason)
      .toContain('falszowanie E-E-A-T')
  })

  it('D39: sameAs z innym schematem niz http nie przechodzi', () => {
    const wynik = approveDraft({
      ...DRAFT, author: { name: 'Jan Kowalski', sameAs: 'mailto:jan@przyklad.test' },
    }, OPCJE)
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.find((f) => f.gate === 'author')?.reason).toContain('mailto:')
  })

  it('zbiera wszystkie niepowodzenia naraz, a nie pierwsze', () => {
    // Redaktor ma zobaczyc cala liste od razu, zamiast wracac trzy razy.
    const wynik = approveDraft({
      ...DRAFT,
      uniqueAssets: [],
      author: { name: '', sameAs: 'nie-adres' },
    }, { ...OPCJE, corpus: [{ id: 'kopia', text: TRESC }] })
    expect(wynik.kind).toBe('rejected')
    if (wynik.kind !== 'rejected') return
    expect(wynik.failures.map((f) => f.gate).sort())
      .toEqual(['author', 'originality', 'unique-asset'])
  })

  it('kazdy rodzaj unikalnego zasobu jest akceptowany', () => {
    for (const kind of ['own-data', 'first-hand-quote', 'original-diagram', 'expert-byline'] as const) {
      const wynik = approveDraft({
        ...DRAFT,
        uniqueAssets: [{ kind, description: 'opis', source: 'zrodlo' }],
      }, OPCJE)
      expect(wynik.kind).toBe('approved')
    }
  })

  it('ApprovedDraft nie da sie zlozyc recznie', () => {
    // To jest test na typ, nie na zachowanie. Bez `as` linia ponizej nie
    // kompiluje sie — i o to chodzi: publikacja przyjmuje ApprovedDraft,
    // wiec jedyna droga do niej wiedzie przez approveDraft.
    // @ts-expect-error znacznik zatwierdzenia jest niedostepny poza modulem
    const podrobka: ApprovedDraft = { ...DRAFT, originality: null, approvedAt: 0 }
    expect(podrobka).toBeDefined()
  })
})
