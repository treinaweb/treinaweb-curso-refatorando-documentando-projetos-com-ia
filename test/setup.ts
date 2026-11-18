/**
 * Setup de cada arquivo de teste (roda no processo do arquivo, antes dele).
 *
 * - Define `DB_PATH` como um arquivo temporario unico: db.js cria o schema e o
 *   seed nele no primeiro `require`. Precisa ser aqui (e nao no topo do teste)
 *   porque os `import` estaticos sao icados e rodariam antes.
 * - Silencia `console.log`/`console.error` (log de requisicoes e erros do
 *   codigo legado nao fazem parte do contrato).
 * - No fim, fecha a conexao e apaga o arquivo temporario.
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterAll, vi } from 'vitest'

const arquivo = path.join(os.tmpdir(), `loja-test-${process.pid}-${randomUUID()}.db`)
process.env.DB_PATH = arquivo

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

afterAll(async () => {
  // createRequire usa o mesmo cache de `require` nativo que app.js usa,
  // entao esta e a mesma conexao do app (nao uma segunda instancia).
  const db = createRequire(import.meta.url)('../db.js')
  await new Promise<void>((resolve, reject) => {
    db.close((err: Error | null) => (err ? reject(err) : resolve()))
  })
  fs.rmSync(arquivo, { force: true })
})
