import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SUSPICIOUS_NAME = /(\.sa\.json|service[-_]account.*\.json|credentials?\.json)$/i

/**
 * Naglowek PEM plus cialo klucza. Sam naglowek nie wystarcza — wystepuje
 * w dokumentacji i w tym pliku, a falszywy alarm w bramce CI jest gorszy niz
 * brak bramki: uczy zespol ja obchodzic. Po naglowku dopuszczamy zarowno
 * prawdziwe znaki nowej linii, jak i sekwencje \n z klucza zapisanego w JSON.
 */
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\\n|\s)+[A-Za-z0-9+/=]{64,}/

export function checkSecrets(root: string): string[] {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const found: string[] = []
  for (const file of tracked) {
    if (SUSPICIOUS_NAME.test(file)) { found.push(`${file}: nazwa wyglada na klucz konta serwisowego`); continue }
    if (!/\.(json|ts|js|env|txt|md|ya?ml)$/i.test(file)) continue
    if (PRIVATE_KEY_PATTERN.test(readFileSync(`${root}/${file}`, 'utf8'))) {
      found.push(`${file}: zawiera klucz prywatny`)
    }
  }
  return found
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = checkSecrets(process.cwd())
  for (const f of found) process.stderr.write(`${f}\n`)
  process.exitCode = found.length === 0 ? 0 : 1
}
