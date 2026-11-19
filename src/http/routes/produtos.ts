/**
 * @file Rotas de produtos, montadas em `/produtos` (src/app.ts). So leitura.
 *
 * Erros usam o formato `{ erro: '...' }`. Sem autenticacao (uso interno).
 */
import express from 'express'
import type { Services } from '../../services'
import { criarProdutosController } from '../controllers/produtos'
import { tratarErros } from '../middlewares/erros'
import { validar } from '../middlewares/validar'
import { buscaSchema } from '../schemas/busca'
import { idSchema } from '../schemas/id'

/**
 * Cria o router de produtos.
 *
 * Rotas:
 * - `GET /produtos`: lista os produtos. Query opcional `busca`, um unico texto
 *   (src/http/schemas/busca.ts), usado como parametro de
 *   `nome LIKE '%' || busca || '%'`: aspas e demais caracteres casam
 *   literalmente, e `%` e `_` continuam curingas. Nao diferencia maiusculas de
 *   minusculas para letras ASCII. Vazia lista todos.
 *   - 200: `[{ id, nome, preco, estoque }]`
 *   - 400: `{ erro: 'Busca invalida' }` (busca repetida ou objeto)
 *   - 500: `{ erro: 'Erro ao buscar produtos' }`
 * - `GET /produtos/:id`: detalhe de um produto (id so com digitos).
 *   - 200: `{ id, nome, preco, estoque }`
 *   - 404: `{ erro: 'Produto nao encontrado' }` (inexistente ou id fora do padrao)
 *   - 500: `{ erro: 'Erro ao buscar produto' }`
 *
 * @param services Services (`criarServices`).
 * @returns Router com `GET /` e `GET /:id`.
 */
export function criarProdutosRouter(services: Services): express.Router {
  const router = express.Router()
  const controller = criarProdutosController(services.produtos)
  const falhas = tratarErros('erro')
  const busca = validar({ schema: buscaSchema, origem: 'query', formato: 'erro' })
  const idProduto = validar({
    schema: idSchema,
    origem: 'params',
    formato: 'erro',
    status: 404,
    mensagem: 'Produto nao encontrado',
  })

  router.get('/', busca, controller.listar, falhas({ padrao: 'Erro ao buscar produtos' }))
  router.get('/:id', idProduto, controller.buscar, falhas({ padrao: 'Erro ao buscar produto' }))

  return router
}
