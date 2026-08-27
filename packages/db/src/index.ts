export { openDatabase, type Db } from './connection.js'
export { migrate } from './migrate.js'
// rawHandle i schema swiadomie nieeksportowane — jedynym wejsciem do bazy
// bedzie repos(), ktore wymusza TenantScope (D5, Zadanie 4).
