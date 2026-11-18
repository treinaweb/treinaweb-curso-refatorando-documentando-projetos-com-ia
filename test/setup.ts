/**
 * Setup de cada arquivo de teste (roda no processo do arquivo, antes dele).
 *
 * - Silencia `console.log`/`console.error` (log de requisicoes e erros do
 *   codigo legado nao fazem parte do contrato).
 * - No fim, fecha a conexao do banco temporario criado em test/helpers.ts e
 *   apaga o arquivo. O setup e o arquivo de teste compartilham os modulos do
 *   worker, entao este `db` e o mesmo usado pelo app dos testes.
 */
import fs from 'node:fs'
import { afterAll, vi } from 'vitest'
import { arquivo, db } from './helpers'

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    db.close((err: Error | null) => (err ? reject(err) : resolve()))
  })
  fs.rmSync(arquivo, { force: true })
})
