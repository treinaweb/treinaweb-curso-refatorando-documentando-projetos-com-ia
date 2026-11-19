/**
 * @file Controller de `/frete`: le a query validada, chama o service e
 * responde. Os erros seguem para o `falhas(...)` da rota.
 */
import type { RequestHandler } from 'express'
import type { Services } from '../../services'
import { validado } from '../middlewares/validar'
import { freteSchema } from '../schemas/frete'

/**
 * Cria o controller do frete.
 *
 * @param frete Service de frete.
 * @returns `simular`.
 */
export function criarFreteController(frete: Services['frete']) {
  /** `GET /frete?cep=&subtotal=` -> 200 `{ cep, subtotal, frete }`. */
  const simular: RequestHandler = async (req, res) => {
    const { cep, subtotal } = validado(req, 'query', freteSchema)
    res.json(await frete.simular(cep, subtotal))
  }

  return { simular }
}
