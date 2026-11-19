/**
 * @file Controllers de `/pedidos`: leem a entrada validada, chamam o service e
 * respondem. Os erros seguem para o `falhas(...)` da rota.
 */
import type { RequestHandler } from 'express'
import type { Services } from '../../services'
import type { ResumoPedido } from '../../services/pedidos'
import { validado } from '../middlewares/validar'
import { criarPedidoSchema } from '../schemas/pedido'

/**
 * Apresenta o resumo do pedido: as linhas legiveis dos itens
 * (`'2x Mouse sem fio - R$ 100.00'`, com o valor do item em 2 casas) e os
 * campos na ordem da resposta.
 *
 * @param resumo Dados do resumo (service).
 * @returns `{ pedido, cliente, tipo_cliente, itens, subtotal, desconto, frete, total, status }`.
 */
export const apresentarResumo = ({ pedido, itens, subtotal, desconto, total }: ResumoPedido) => ({
  pedido: pedido.id,
  cliente: pedido.nome,
  tipo_cliente: pedido.tipo,
  itens: itens.map((i) => i.quantidade + 'x ' + i.nome + ' - R$ ' + (i.quantidade * i.preco_unitario).toFixed(2)),
  subtotal,
  desconto,
  frete: pedido.frete,
  total,
  status: pedido.status,
})

/**
 * Cria os controllers de pedidos.
 *
 * @param pedidos Service de pedidos.
 * @returns `buscar`, `criar`, `resumo` e `cancelar`.
 */
export function criarPedidosController(pedidos: Services['pedidos']) {
  /** `GET /pedidos/:id` -> 200 com os valores gravados e `itens`. */
  const buscar: RequestHandler<{ id: string }> = async (req, res) => {
    res.json(await pedidos.buscar(req.params.id))
  }

  /** `POST /pedidos` -> 201 `{ id, cliente_id, subtotal, desconto, frete, total, status: 'criado' }`. */
  const criar: RequestHandler = async (_req, res) => {
    res.status(201).json(await pedidos.criar(validado(res, 'body', criarPedidoSchema)))
  }

  /** `GET /pedidos/:id/resumo` -> 200 com o resumo apresentado. */
  const resumo: RequestHandler<{ id: string }> = async (req, res) => {
    res.json(apresentarResumo(await pedidos.resumo(req.params.id)))
  }

  /** `POST /pedidos/:id/cancelar` -> 200 `{ id, status: 'cancelado' }`. */
  const cancelar: RequestHandler<{ id: string }> = async (req, res) => {
    res.json(await pedidos.cancelar(req.params.id))
  }

  return { buscar, criar, resumo, cancelar }
}
