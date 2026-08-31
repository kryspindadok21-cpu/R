import { homedir } from 'node:os'
import { loadConfig } from '@seo/cli/lib'
import { DEFAULT_HOST, DEFAULT_PORT, createPanel } from './server.js'

const config = loadConfig(process.env, homedir())
const port = Number(process.env.SEO_PANEL_PORT ?? DEFAULT_PORT)

const server = createPanel({
  dbPath: config.dbPath,
  tenantId: config.tenantId,
  gscKeyFile: config.gscKeyFile,
})

// Wylacznie petla zwrotna: panel uruchamia crawler na dowolny adres i ma pelny
// dostep do bazy. Wystawienie go na siec byloby oddaniem obu tych rzeczy.
server.listen(port, DEFAULT_HOST, () => {
  process.stdout.write(
    `Panel dziala: http://${DEFAULT_HOST}:${port}\n` +
    `Baza:         ${config.dbPath}\n` +
    'Zatrzymanie:  Ctrl+C\n',
  )
})
