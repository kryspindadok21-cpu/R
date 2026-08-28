import { collapseWhitespace, isElement, type Node } from './dom.js'

/**
 * Znaczniki, ktorych zawartosc nie jest tresci widoczna. `<noscript>` jest tu
 * celowo: jego zawartosc widzi wylacznie przegladarka bez JS, wiec liczenie jej
 * jako tresci zamaskowaloby dokladnie ten problem, ktory chcemy wykrywac (D16).
 */
const INVISIBLE_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'head',
])

/** Znaczniki blokowe — po nich wstawiamy spacje, zeby slowa sie nie skleily. */
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'div', 'dd', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
  'table', 'td', 'th', 'tr', 'ul',
])

/** Tekst widoczny dla czytelnika i dla robota, ktory nie wykonuje JavaScriptu. */
export function visibleText(root: Node): string {
  const parts: string[] = []

  const visit = (node: Node): void => {
    if (isElement(node)) {
      const tag = node.tagName.toLowerCase()
      if (INVISIBLE_TAGS.has(tag)) return
      if (BLOCK_TAGS.has(tag)) parts.push(' ')
    }
    if (node.nodeName === '#text') {
      parts.push((node as { value: string }).value)
      return
    }
    const children = (node as { childNodes?: readonly Node[] }).childNodes
    if (children) for (const child of children) visit(child)
    if (isElement(node) && BLOCK_TAGS.has(node.tagName.toLowerCase())) parts.push(' ')
  }

  visit(root)
  return collapseWhitespace(parts.join(''))
}

/**
 * Liczy slowa. Dzieli po bialych znakach, ale odrzuca „slowa" zlozone wylacznie
 * ze znakow interpunkcyjnych — inaczej lista wypunktowana zawyza wynik.
 */
export function countWords(text: string): number {
  if (text.length === 0) return 0
  let count = 0
  for (const token of text.split(/\s+/)) {
    if (token.length === 0) continue
    if (/[\p{L}\p{N}]/u.test(token)) count += 1
  }
  return count
}
