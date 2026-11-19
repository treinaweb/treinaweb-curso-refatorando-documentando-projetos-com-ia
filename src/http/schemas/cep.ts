/**
 * @file Schema de CEP, usado por `POST /clientes` (corpo) e `GET /frete`
 * (query). E a unica regra de CEP do projeto.
 *
 * Aceita texto que, sem espacos nas pontas, tenha 5 digitos, hifen opcional e
 * 3 digitos. Qualquer outro valor, inclusive numero, ausencia ou lista (query
 * repetida), da `CEP invalido`. A saida do parse e o CEP normalizado: sem os
 * espacos das pontas e sem o hifen (8 digitos), como e gravado.
 *
 * @example cepSchema.parse(' 01310-100 ') // '01310100'
 * @example cepSchema.safeParse('0131-0100').success // false (hifen fora do lugar)
 * @example cepSchema.safeParse(20040020).success    // false (so texto)
 */
import { z } from 'zod'

/** Mensagem unica de CEP rejeitado. */
export const CEP_INVALIDO = 'CEP invalido'

/** CEP aceito, depois do `trim`: 5 digitos, hifen opcional, 3 digitos. */
const FORMATO_CEP = /^\d{5}-?\d{3}$/

/** Campo de CEP; a saida e o CEP sem espacos nas pontas e sem hifen. */
export const cepSchema = z
  .string({ error: CEP_INVALIDO })
  .refine((cep) => FORMATO_CEP.test(cep.trim()), { error: CEP_INVALIDO })
  .transform((cep) => cep.trim().replace('-', ''))
