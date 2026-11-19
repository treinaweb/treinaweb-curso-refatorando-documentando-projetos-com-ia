/**
 * @file Controllers de `/produtos`: leem a entrada validada, chamam o service e
 * respondem. Os erros seguem para o `falhas(...)` da rota.
 */
import type { RequestHandler } from 'express'
import type { Services } from '../../services'
import { validado } from '../middlewares/validar'
import { buscaSchema } from '../schemas/busca'

/**
 * Cria os controllers de produtos.
 *
 * @param produtos Service de produtos.
 * @returns `listar` e `buscar`.
 */
export function criarProdutosController(produtos: Services['produtos']) {
  /** `GET /produtos?busca=` -> 200 `[{ id, nome, preco, estoque }]`. */
  const listar: RequestHandler = async (_req, res) => {
    const { busca } = validado(res, 'query', buscaSchema)
    res.json(await produtos.listar(busca))
  }

  /** `GET /produtos/:id` -> 200 `{ id, nome, preco, estoque }`. */
  const buscar: RequestHandler<{ id: string }> = async (req, res) => {
    res.json(await produtos.buscar(req.params.id))
  }

  return { listar, buscar }
}
