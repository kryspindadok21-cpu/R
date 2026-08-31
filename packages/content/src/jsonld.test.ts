import { describe, expect, it } from 'vitest'
import {
  approveDraft, verifyAuthor, type ApprovedDraft, type DraftInput, type VerifiedAuthor,
} from './gates.js'
import { MAX_HEADLINE_LENGTH, articleSchemaScript, buildArticleSchema } from './jsonld.js'

const TRESC = `
Zmierzyliśmy widoczność marki w odpowiedziach trzech modeli językowych przez
sześć tygodni. Model z dostępem do wyszukiwarki wymieniał nas o jedenaście
punktów procentowych częściej niż ten sam model odpowiadający z pamięci.
Różnica utrzymała się w każdym tygodniu pomiaru i nie dało się jej wytłumaczyć.
`

const WEJSCIE: DraftInput = {
  title: 'Grounding zmienia widoczność o jedenaście punktów',
  markdown: TRESC,
  author: { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' },
  uniqueAssets: [{ kind: 'own-data', description: 'sześć tygodni pomiaru', source: 'własny tracker' }],
  engine: 'groq',
  modelVersion: 'llama-3.3-70b-versatile',
  promptId: 'brief-01',
}

function zatwierdzony(nadpisz: Partial<DraftInput> = {}): ApprovedDraft {
  const wynik = approveDraft({ ...WEJSCIE, ...nadpisz }, {
    corpus: [{ id: 'obcy', text: 'Kwas foliowy w diecie kobiet w ciąży od lat siedemdziesiątych.' }],
    now: () => 1_700_000_000_000,
  })
  if (wynik.kind !== 'approved') throw new Error('fikstura miala przejsc bramki')
  return wynik.draft
}

function autor(): VerifiedAuthor {
  const wynik = verifyAuthor(WEJSCIE.author)
  if (wynik.kind !== 'ok') throw new Error('fikstura miala przejsc bramke autora')
  return wynik.author
}

describe('buildArticleSchema', () => {
  const schema = buildArticleSchema({
    title: WEJSCIE.title, author: autor(),
    url: 'https://przyklad.test/blog/grounding',
    datePublished: '2026-08-31',
    description: 'Sześć tygodni pomiaru widoczności w trzech modelach.',
    publisherName: 'Mentiometry',
  })

  it('D39: autor jest osoba z rozwiazywalnym sameAs', () => {
    expect(schema.author).toEqual({
      '@type': 'Person',
      name: 'Krzysztof Nowak',
      sameAs: ['https://przyklad.test/o-mnie'],
    })
  })

  it('sklada poprawny szkielet artykulu', () => {
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Article')
    expect(schema.url).toBe('https://przyklad.test/blog/grounding')
    expect(schema.mainEntityOfPage['@id']).toBe('https://przyklad.test/blog/grounding')
  })

  it('bez daty modyfikacji bierze date publikacji', () => {
    expect(schema.dateModified).toBe('2026-08-31')
    const zmodyfikowany = buildArticleSchema({
      title: WEJSCIE.title, author: autor(), url: 'https://a.test/x',
      datePublished: '2026-08-01', dateModified: '2026-08-31',
    })
    expect(zmodyfikowany.dateModified).toBe('2026-08-31')
  })

  it('pola opcjonalne nie pojawiaja sie jako undefined', () => {
    const goly = buildArticleSchema({
      title: WEJSCIE.title, author: autor(), url: 'https://a.test/x', datePublished: '2026-08-31',
    })
    expect(goly).not.toHaveProperty('description')
    expect(goly).not.toHaveProperty('publisher')
    expect(JSON.stringify(goly)).not.toContain('undefined')
  })

  it('za dlugi naglowek jest ucinany, a nie zostawiany do uciecia przez Google', () => {
    const dlugi = 'a'.repeat(200)
    const schema = buildArticleSchema({
      title: dlugi, author: autor(), url: 'https://a.test/x', datePublished: '2026-08-31',
    })
    expect(schema.headline.length).toBe(MAX_HEADLINE_LENGTH)
    expect(schema.headline.endsWith('…')).toBe(true)
  })

  it('naglowek miesciacy sie w limicie zostaje nietkniety', () => {
    expect(buildArticleSchema({
      title: WEJSCIE.title, author: autor(), url: 'https://a.test/x', datePublished: '2026-08-31',
    }).headline).toBe(WEJSCIE.title)
  })
})

describe('AC7: autor przechodzi przez typ, nie przez sprawdzenie', () => {
  it('nie da sie zbudowac JSON-LD z autorem, ktorego nikt nie sprawdzil', () => {
    // Bez `verifyAuthor` linia z autorem sie nie kompiluje — i o to chodzi.
    const podrobka = buildArticleSchema({
      title: 'X',
      // @ts-expect-error zwykly Author nie jest VerifiedAuthor
      author: { name: 'Zmyslony', sameAs: 'nie-adres' },
      url: 'https://a.test/x', datePublished: '2026-08-31',
    })
    expect(podrobka).toBeDefined()
  })

  it('autor z zatwierdzonego draftu przechodzi bez dodatkowej pracy', () => {
    const draft = zatwierdzony()
    const schema = buildArticleSchema({
      title: draft.title, author: draft.author,
      url: 'https://a.test/x', datePublished: '2026-08-31',
    })
    expect(schema.author.name).toBe('Krzysztof Nowak')
  })
})

describe('articleSchemaScript', () => {
  it('sklada blok gotowy do wstawienia', () => {
    const blok = articleSchemaScript(buildArticleSchema({
      title: WEJSCIE.title, author: autor(), url: 'https://a.test/x', datePublished: '2026-08-31',
    }))
    expect(blok.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(blok.endsWith('</script>')).toBe(true)
  })

  it('tytul z zamknieciem skryptu nie rozwala strony', () => {
    // Parser HTML konczy blok skryptu na `</script>` takze wewnatrz ciagu znakow.
    const blok = articleSchemaScript(buildArticleSchema({
      title: 'Uwaga </script> tutaj', author: autor(),
      url: 'https://a.test/x', datePublished: '2026-08-31',
    }))
    expect(blok.slice(0, -'</script>'.length)).not.toContain('</script>')
    expect(blok).toContain('\\u003c/script>')
  })

  it('wynik jest poprawnym JSON-em po odwroceniu eskejpowania', () => {
    const schema = buildArticleSchema({
      title: WEJSCIE.title, author: autor(), url: 'https://a.test/x', datePublished: '2026-08-31',
    })
    const json = articleSchemaScript(schema)
      .replace('<script type="application/ld+json">\n', '')
      .replace('\n</script>', '')
      .replace(/\\u003c/g, '<')
    expect(JSON.parse(json)).toEqual(schema)
  })
})
