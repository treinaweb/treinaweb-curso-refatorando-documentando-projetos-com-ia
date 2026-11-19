/**
 * @file Controllers de `/clientes`: leem a entrada validada, chamam o service e
 * respondem. Os erros seguem para o `falhas(...)` da rota.
 */
import type { RequestHandler } from 'express'
import type { Services } from '../../services'
import { validado } from '../middlewares/validar'
import { criarClienteSchema } from '../schemas/cliente'

/**
 * Cria os controllers de clientes.
 *
 * @param clientes Service de clientes.
 * @returns `listar`, `buscar` e `criar`.
 */
export function criarClientesController(clientes: Services['clientes']) {
  /** `GET /clientes` -> 200 `[{ id, nome, email, cep, tipo }]`. */
  const listar: RequestHandler = async (_req, res) => {
    res.json(await clientes.listar())
  }

  /** `GET /clientes/:id` -> 200 `{ id, nome, email, cep, tipo }`. */
  const buscar: RequestHandler<{ id: string }> = async (req, res) => {
    res.json(await clientes.buscar(req.params.id))
  }

  /** `POST /clientes` -> 201 `{ id, nome, email, cep, tipo: 'comum' }`. */
  const criar: RequestHandler = async (req, res) => {
    res.status(201).json(await clientes.criar(validado(req, 'body', criarClienteSchema)))
  }

  return { listar, buscar, criar }
}
