import { describe, expect, it } from 'vitest'
import { isUlid, newId } from './ids.js'

describe('newId', () => {
  it('generuje ULID o poprawnym ksztalcie', () => {
    expect(isUlid(newId())).toBe(true)
  })

  it('generuje wartosci unikalne', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
  })

  it('generuje wartosci rosnace leksykograficznie w czasie', async () => {
    const first = newId()
    await new Promise((r) => setTimeout(r, 2))
    expect(newId() > first).toBe(true)
  })

  it('odrzuca ksztalty inne niz ULID', () => {
    expect(isUlid('za-krotki')).toBe(false)
    expect(isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAI')).toBe(false) // I nie nalezy do alfabetu Crockforda
  })
})
