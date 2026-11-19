/**
 * @file Simulacao de frete, montada em `/frete` (src/app.ts).
 *
 * Erros usam o formato `{ erro: '...' }`. Sem autenticacao (uso interno).
 */
import express from 'express'
import type { Services } from '../../services'
import { criarFreteController } from '../controllers/frete'
import { tratarErros } from '../middlewares/erros'
import { validar } from '../middlewares/validar'
import { freteSchema } from '../schemas/frete'

/**
 * Cria o router do frete.
 *
 * Rota `GET /frete?cep=&subtotal=`: simula o frete com a mesma regra de
 * `POST /pedidos`, mas com o CEP informado na query (o pedido usa o CEP do
 * cadastro do cliente). A query e validada por src/http/schemas/frete.ts:
 * `subtotal` ausente ou vazio vale 0; senao, so digitos com decimal opcional
 * apos ponto.
 * - 200: `{ cep, subtotal, frete }` (cep sem hifen)
 * - 400 (CEP antes do subtotal): `{ erro: 'CEP invalido' }` ou
 *   `{ erro: 'Subtotal invalido' }`
 *
 * A simulacao nao usa o banco: o 500 `{ erro: 'Erro interno' }` so cobre um
 * erro inesperado (antes, a pagina HTML 500 do Express).
 *
 * @param services Services (`criarServices`).
 * @returns Router com `GET /`.
 */
export function criarFreteRouter(services: Services): express.Router {
  const router = express.Router()
  const controller = criarFreteController(services.frete)
  const falhas = tratarErros('erro')
  const query = validar({ schema: freteSchema, origem: 'query', formato: 'erro' })

  router.get('/', query, controller.simular, falhas({ padrao: 'Erro interno' }))

  return router
}
