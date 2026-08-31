import { homedir } from 'node:os'
import { loadConfig } from '@seo/cli/lib'
import { listenOnLoopback } from './listen.js'
import { DEFAULT_PORT, createPanel } from './server.js'

const config = loadConfig(process.env, homedir())
const port = Number(process.env.SEO_PANEL_PORT ?? DEFAULT_PORT)

const panelConfig = {
  dbPath: config.dbPath,
  tenantId: config.tenantId,
  gscKeyFile: config.gscKeyFile,
}

const { servers, result } = await listenOnLoopback(() => createPanel(panelConfig), port)

process.stdout.write(
  '\n'
  + `  Panel dziala.  Otworz w przegladarce:  http://localhost:${port}\n\n`
  + `  Adresy:  ${result.urls.join('  ')}\n`
  + `  Baza:    ${config.dbPath}\n`
  + '  Stop:    Ctrl+C\n\n'
  + (result.failures.length === 0
    ? ''
    : `  Uwaga: nie udalo sie zajac ${result.failures.map((f) => f.host).join(', ')} `
      + '— panel dziala na pozostalych adresach.\n\n'),
)

for (const sygnal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sygnal, () => {
    for (const server of servers) server.close()
    process.exit(0)
  })
}
