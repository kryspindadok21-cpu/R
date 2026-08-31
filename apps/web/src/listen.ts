import type { Server } from 'node:http'
import { LOOPBACK_HOSTS } from './server.js'

/**
 * Uruchamia panel na **obu** adresach petli zwrotnej.
 *
 * IPv6 bywa wylaczone w systemie albo w kontenerze i wtedy `::1` nie da sie
 * zbindowac. To nie jest powod, zeby panel nie wstal — nasluch na IPv4 wystarczy.
 * Odwrotnie tez: gdyby kiedys zabraklo IPv4, IPv6 ma wystarczyc samo. Panel
 * nie wstaje dopiero wtedy, gdy nie udalo sie **zadne** z nich.
 */
export interface ListenResult {
  readonly urls: readonly string[]
  readonly failures: readonly { host: string; reason: string }[]
}

export async function listenOnLoopback(
  create: () => Server,
  port: number,
): Promise<{ servers: Server[]; result: ListenResult }> {
  const servers: Server[] = []
  const urls: string[] = []
  const failures: { host: string; reason: string }[] = []

  // Port podany jako 0 znaczy „wybierz wolny". Wtedy **pierwszy** udany nasluch
  // ustala numer, a kolejne adresy dostaja ten sam — inaczej kazdy adres
  // wyladowalby na innym porcie i tylko jeden z nich odpowiadalby pod tym,
  // ktory panel wypisuje.
  let ustalonyPort = port

  for (const host of LOOPBACK_HOSTS) {
    const server = create()
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
          server.removeListener('listening', onListening)
          reject(error)
        }
        const onListening = (): void => {
          server.removeListener('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(ustalonyPort, host)
      })

      // Numer bierzemy z gniazda, a nie z argumentu: przy porcie 0 argument
      // jest zerem, a panel ma wypisac adres, pod ktory da sie wejsc.
      const adres = server.address()
      const faktyczny = typeof adres === 'object' && adres !== null ? adres.port : ustalonyPort
      ustalonyPort = faktyczny

      servers.push(server)
      urls.push(host.includes(':')
        ? `http://[${host}]:${faktyczny}`
        : `http://${host}:${faktyczny}`)
    } catch (error) {
      server.close()
      failures.push({
        host,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (servers.length === 0) {
    const powody = failures.map((f) => `${f.host}: ${f.reason}`).join('; ')
    throw new Error(
      `Nie udalo sie uruchomic panelu na porcie ${port}. ${powody}\n`
      + 'Najczestsza przyczyna to zajety port — zmien go przez SEO_PANEL_PORT.',
    )
  }

  return { servers, result: { urls, failures } }
}
