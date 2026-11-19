/**
 * Setup de cada arquivo de teste (roda no processo do arquivo, antes dele).
 *
 * - Silencia `console.log`/`console.error` (o log de requisicoes e o log das
 *   falhas no tratador de erros nao fazem parte do contrato).
 * - No fim, fecha e apaga os bancos temporarios abertos por test/helpers.ts
 *   (o do app principal e os de `appComBanco`). O setup e o arquivo de teste
 *   compartilham os modulos do worker, entao sao os mesmos bancos.
 */
import { afterAll, vi } from 'vitest'
import { fecharBancos } from './helpers'

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

afterAll(fecharBancos)
