/**
 * @file Schema da query de `GET /frete` (simulacao).
 *
 * Ordem de avaliacao: `cep` (veja src/http/schemas/cep.ts) e depois
 * `subtotal`. Mensagens (formato `{ erro }`, status 400): `CEP invalido` e
 * `Subtotal invalido`.
 *
 * `subtotal` ausente ou vazio vale 0. Fora isso, so digitos com parte decimal
 * opcional apos ponto: negativo, expoente (`1e3`), `.5`, virgula, sufixo
 * (`350reais`) e query repetida sao rejeitados.
 *
 * Saida do parse: `{ cep, subtotal }`, com o CEP normalizado (veja
 * src/http/schemas/cep.ts) e o `subtotal` como numero (`parseFloat`; 0 se
 * ausente ou vazio).
 */
import { z } from 'zod'
import { cepSchema } from './cep'
import { objetoOuVazio } from './comum'

/** Subtotal aceito quando informado. */
const FORMATO_SUBTOTAL = /^\d+(\.\d+)?$/

/**
 * Confere o `subtotal` da query.
 *
 * @param valor Valor recebido na query.
 * @returns `true` se estiver ausente, vazio ou no formato aceito.
 */
const subtotalValido = (valor: unknown): boolean =>
  valor === undefined || valor === '' || (typeof valor === 'string' && FORMATO_SUBTOTAL.test(valor))

/** Query de `GET /frete`. */
export const freteSchema = objetoOuVazio(
  z.object({
    cep: cepSchema,
    // `z.optional` e necessario: no Zod 4, `z.unknown().refine()` torna a chave
    // obrigatoria (e o erro viria com a mensagem do proprio Zod).
    subtotal: z
      .optional(z.unknown().refine(subtotalValido, { error: 'Subtotal invalido' }))
      .transform((valor) => (typeof valor === 'string' && valor !== '' ? parseFloat(valor) : 0)),
  }),
)
