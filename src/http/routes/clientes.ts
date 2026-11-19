/**
 * @file Rotas de clientes, montadas em `/clientes` (src/app.ts).
 *
 * Erros neste router usam o formato `{ error: '...' }` (diferente do
 * `{ erro: '...' }` das demais rotas). Sem autenticacao (uso interno).
 */
import express from 'express'
import type { Services } from '../../services'
import { criarClientesController } from '../controllers/clientes'
import { tratarErros } from '../middlewares/erros'
import { validar } from '../middlewares/validar'
import { criarClienteSchema } from '../schemas/cliente'
import { idSchema } from '../schemas/id'

/**
 * Cria o router de clientes.
 *
 * Rotas:
 * - `GET /clientes`: lista todos os clientes ordenados por id.
 *   - 200: `[{ id, nome, email, cep, tipo }]`
 *   - 500: `{ error: 'Erro ao listar clientes' }`
 * - `GET /clientes/:id`: detalhe de um cliente (id so com digitos).
 *   - 200: `{ id, nome, email, cep, tipo }`
 *   - 404: `{ error: 'Cliente nao encontrado' }` (inexistente ou id fora do padrao)
 *   - 500: `{ error: 'Erro ao buscar cliente' }`
 * - `POST /clientes`: cadastra um cliente. Body `{ nome, email, cep }`
 *   (src/http/schemas/cliente.ts). O CEP aceita hifen e espacos nas pontas e e
 *   gravado sem eles. O tipo e sempre `comum`; campos extras sao ignorados.
 *   - 201: `{ id, nome, email, cep, tipo: 'comum' }`
 *   - 400 (so o primeiro problema, na ordem nome, email, cep):
 *     `{ error: 'Nome e email sao obrigatorios' }`, `{ error: 'Nome invalido' }`,
 *     `{ error: 'Email invalido' }` ou `{ error: 'CEP invalido' }`
 *   - 500: `{ error: 'Erro ao salvar cliente' }`
 *
 * @param services Services (`criarServices`).
 * @returns Router com `GET /`, `GET /:id` e `POST /`.
 */
export function criarClientesRouter(services: Services): express.Router {
  const router = express.Router()
  const controller = criarClientesController(services.clientes)
  const falhas = tratarErros('error')
  const idCliente = validar({
    schema: idSchema,
    origem: 'params',
    formato: 'error',
    status: 404,
    mensagem: 'Cliente nao encontrado',
  })
  const corpo = validar({ schema: criarClienteSchema, origem: 'body', formato: 'error' })

  router.get('/', controller.listar, falhas({ padrao: 'Erro ao listar clientes' }))
  router.get('/:id', idCliente, controller.buscar, falhas({ padrao: 'Erro ao buscar cliente' }))
  router.post('/', corpo, controller.criar, falhas({ padrao: 'Erro ao salvar cliente' }))

  return router
}
