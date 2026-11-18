/**
 * @file Schema de CEP, usado por `POST /clientes` (corpo) e `GET /frete`
 * (query).
 *
 * A regra e a de `validaCep` (src/utils.js), reaproveitada aqui para existir
 * num lugar so: texto que, sem espacos nas pontas, tenha 5 digitos, hifen
 * opcional e 3 digitos. Qualquer outro valor, inclusive numero, ausencia ou
 * lista (query repetida), da `CEP invalido`.
 */
import { z } from 'zod'
import utils = require('../../utils')

/** Mensagem unica de CEP rejeitado. */
export const CEP_INVALIDO = 'CEP invalido'

/** Campo de CEP. */
export const cepSchema = z
  .string({ error: CEP_INVALIDO })
  .refine((cep) => utils.validaCep(cep) !== null, { error: CEP_INVALIDO })
