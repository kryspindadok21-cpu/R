import type { DefaultTreeAdapterTypes } from 'parse5'

export type Node = DefaultTreeAdapterTypes.Node
export type Element = DefaultTreeAdapterTypes.Element
export type Document = DefaultTreeAdapterTypes.Document
export type ChildNode = DefaultTreeAdapterTypes.ChildNode

/**
 * Minimalna warstwa zapytan nad drzewem parse5. Swiadomie nie jest silnikiem
 * selektorow CSS (D13): reguly audytu pytaja o kilkanascie konkretnych rzeczy,
 * nie o dowolny selektor. Kazda funkcja tutaj jest czysta.
 */

function hasChildNodes(node: Node): node is Node & { childNodes: ChildNode[] } {
  return 'childNodes' in node && Array.isArray((node as { childNodes?: unknown }).childNodes)
}

export function isElement(node: Node): node is Element {
  return 'tagName' in node
}

/** Odwiedza kazdy wezel drzewa w kolejnosci dokumentu. */
export function walk(root: Node, visit: (node: Node) => void): void {
  visit(root)
  if (!hasChildNodes(root)) return
  for (const child of root.childNodes) walk(child, visit)
}

/**
 * Zawartosc `<template>` lezy w osobnym fragmencie, nie w `childNodes`.
 * Googlebot jej nie renderuje jako tresci, wiec traktujemy ja jak niewidoczna,
 * ale skrypty i dane strukturalne w srodku nadal potrafia byc istotne.
 */
export function templateContent(node: Element): Node | undefined {
  const content = (node as { content?: Node }).content
  return content
}

export function elementsByTag(root: Node, ...tags: readonly string[]): Element[] {
  const wanted = new Set(tags.map((t) => t.toLowerCase()))
  const found: Element[] = []
  walk(root, (node) => {
    if (isElement(node) && wanted.has(node.tagName.toLowerCase())) found.push(node)
  })
  return found
}

export function firstElementByTag(root: Node, tag: string): Element | undefined {
  return elementsByTag(root, tag)[0]
}

export function attr(element: Element, name: string): string | undefined {
  const lower = name.toLowerCase()
  for (const a of element.attrs) if (a.name.toLowerCase() === lower) return a.value
  return undefined
}

export function hasAttr(element: Element, name: string): boolean {
  return attr(element, name) !== undefined
}

/** Tekst wszystkich wezlow tekstowych pod elementem, bez normalizacji bialych znakow. */
export function rawTextOf(node: Node): string {
  let out = ''
  walk(node, (n) => {
    if (n.nodeName === '#text') out += (n as { value: string }).value
  })
  return out
}

/** Ten sam tekst, ale ze zwinietymi bialymi znakami — tak widzi go czlowiek. */
export function textOf(node: Node): string {
  return collapseWhitespace(rawTextOf(node))
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Znajduje `<meta>` po atrybucie `name` albo `property` (OpenGraph uzywa `property`).
 * Zwraca `content` pierwszego trafienia — przegladarka robi tak samo.
 */
export function metaContent(root: Node, key: string): string | undefined {
  const lower = key.toLowerCase()
  for (const meta of elementsByTag(root, 'meta')) {
    const name = attr(meta, 'name') ?? attr(meta, 'property') ?? attr(meta, 'http-equiv')
    if (name?.toLowerCase() === lower) return attr(meta, 'content')
  }
  return undefined
}
