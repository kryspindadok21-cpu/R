import { describe, expect, it } from 'vitest'
import { ProviderHttpError, type ProviderCallEntry, withLedger } from './ledger.js'

function collector() {
  const entries: ProviderCallEntry[] = []
  return { entries, ledger: { record: (e: ProviderCallEntry) => { entries.push(e) } } }
}

const META = {
  providerId: 'gsc' as const,
  capability: 'performance.byDate',
  quotaUnits: 1,
  costMicros: 0,
  requestFingerprint: 'odcisk',
}

describe('withLedger', () => {
  it('zapisuje udane wywolanie i zwraca wartosc', async () => {
    const { entries, ledger } = collector()
    let t = 1000
    const value = await withLedger(ledger, META, () => (t += 25), async () => ({ value: 'ok', httpStatus: 200 }))
    expect(value).toBe('ok')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ ok: true, httpStatus: 200, quotaUnits: 1, costMicros: 0 })
    expect(entries[0]!.durationMs).toBe(25)
  })

  it('zapisuje nieudane wywolanie i przepuszcza blad', async () => {
    const { entries, ledger } = collector()
    await expect(
      withLedger(ledger, META, () => 0, async () => { throw new ProviderHttpError(429, 'rate_limit', 'za duzo') }),
    ).rejects.toThrow('za duzo')
    expect(entries[0]).toMatchObject({ ok: false, httpStatus: 429, errorCode: 'rate_limit' })
  })

  it('zapisuje blad nie-HTTP jako unknown', async () => {
    const { entries, ledger } = collector()
    await expect(withLedger(ledger, META, () => 0, async () => { throw new Error('siec padla') })).rejects.toThrow()
    expect(entries[0]).toMatchObject({ ok: false, errorCode: 'unknown' })
    expect(entries[0]!.httpStatus).toBeUndefined()
  })

  it('zapisuje wywolanie ZANIM blad opusci funkcje', async () => {
    const { entries, ledger } = collector()
    try {
      await withLedger(ledger, META, () => 0, async () => { throw new Error('x') })
    } catch {
      expect(entries).toHaveLength(1)
    }
  })

  it('przepisuje metadane wywolania do wpisu', async () => {
    const { entries, ledger } = collector()
    await withLedger(ledger, META, () => 7, async () => ({ value: 1, httpStatus: 200 }))
    expect(entries[0]).toMatchObject({
      providerId: 'gsc', capability: 'performance.byDate', requestFingerprint: 'odcisk', startedAt: 7,
    })
  })
})
