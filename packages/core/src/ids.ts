import { ulid } from 'ulid'

/** ULID w postaci tekstowej. Marka typu zapobiega podstawieniu zwyklego stringa. */
export type Ulid = string & { readonly __brand: 'Ulid' }

/** Alfabet Crockford base32: bez I, L, O, U. */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function newId(): Ulid {
  return ulid() as Ulid
}

export function isUlid(value: string): value is Ulid {
  return ULID_PATTERN.test(value)
}
