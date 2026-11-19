/**
 * @file Rotas de pedidos, montadas em `/pedidos` (src/app.ts).
 *
 * Nao existe `GET /pedidos` (listagem). Erros usam o formato
 * `{ erro: '...' }`. Sem autenticacao (uso interno).
 */
import express from 'express'
import type { Services } from '../../services'
import { criarPedidosController } from '../controllers/pedidos'
import { tratarErros } from '../middlewares/erros'
import { validar } from '../middlewares/validar'
import { idSchema } from '../schemas/id'
import { criarPedidoSchema } from '../schemas/pedido'

/**
 * Cria o router de pedidos. Os ids no path so aceitam digitos; fora disso, a
 * resposta e `404 { erro: 'Pedido nao encontrado' }`, igual a um id
 * inexistente.
 *
 * Rotas:
 * - `GET /pedidos/:id`: detalhe do pedido com os itens, com os valores gravados
 *   na criacao (nao recalcula nada).
 *   - 200: `{ id, cliente_id, subtotal, desconto, frete, total, status, criado_em,
 *     itens: [{ produto_id, nome, quantidade, preco_unitario }] }`
 *   - 404: `{ erro: 'Pedido nao encontrado' }`
 *   - 500: `{ erro: 'Erro ao buscar pedido' }` ou `{ erro: 'Erro ao buscar itens' }`
 * - `POST /pedidos`: cria um pedido; e a fonte canonica das regras de preco
 *   (src/services/pedidos.ts, src/domain/precos/). Body
 *   `{ cliente_id, itens: [{ produto_id, quantidade }] }`
 *   (src/http/schemas/pedido.ts): ids e `quantidade` inteiros positivos, ao
 *   menos um item, campos extras ignorados. Insere o pedido com status
 *   `criado`, os itens e a baixa de estoque numa transacao.
 *   - 201: `{ id, cliente_id, subtotal, desconto, frete, total, status: 'criado' }`
 *   - 400 (validacao, so o primeiro problema): `cliente_id obrigatorio`,
 *     `cliente_id invalido`, `Pedido sem itens`, `produto_id obrigatorio no item N`,
 *     `produto_id invalido no item N`, `Quantidade invalida no item N`
 *   - 400: `Estoque insuficiente para <produto>`
 *   - 404: `Cliente nao encontrado`, `Produto <id> nao encontrado`
 *   - 500: `Erro interno` (leitura do cliente ou dos produtos),
 *     `Erro ao salvar pedido` (gravacao; nada fica gravado)
 * - `GET /pedidos/:id/resumo`: resumo legivel. Recalcula subtotal e desconto
 *   dos itens gravados (politica `RESUMO`); o frete e o gravado.
 *   - 200: `{ pedido, cliente, tipo_cliente, itens: ['2x Mouse sem fio - R$ 100.00', ...],
 *     subtotal, desconto, frete, total, status }`
 *   - 404: `{ erro: 'Pedido nao encontrado' }`
 *   - 500: `{ erro: 'Erro ao gerar resumo' }`
 * - `POST /pedidos/:id/cancelar`: cancela (`criado` -> `cancelado`) e devolve o
 *   estoque, numa transacao.
 *   - 200: `{ id, status: 'cancelado' }`
 *   - 400: `{ erro: 'Pedido nao pode ser cancelado (status <status>)' }`
 *   - 404: `{ erro: 'Pedido nao encontrado' }`
 *   - 500: `{ erro: 'Erro ao cancelar pedido' }`
 *
 * Todas as respostas de erro usam o formato `{ erro: '...' }`.
 *
 * @todo Diverge de POST /pedidos: o resumo usa a politica `RESUMO`, que so da
 *   desconto ao cliente `comum` com subtotal > 500 (la e >= 500). Num pedido
 *   `comum` de exatamente R$ 500,00, o resumo mostra desconto 0 e um total
 *   diferente do cobrado (a confirmar).
 * @param services Services (`criarServices`).
 * @returns Router com `GET /:id`, `POST /`, `GET /:id/resumo` e `POST /:id/cancelar`.
 */
export function criarPedidosRouter(services: Services): express.Router {
  const router = express.Router()
  const controller = criarPedidosController(services.pedidos)
  const falhas = tratarErros('erro')
  const idPedido = validar({
    schema: idSchema,
    origem: 'params',
    formato: 'erro',
    status: 404,
    mensagem: 'Pedido nao encontrado',
  })
  const corpo = validar({ schema: criarPedidoSchema, origem: 'body', formato: 'erro' })

  router.get(
    '/:id',
    idPedido,
    controller.buscar,
    falhas({ padrao: 'Erro ao buscar pedido', itens: 'Erro ao buscar itens' }),
  )
  router.post('/', corpo, controller.criar, falhas({ padrao: 'Erro interno', gravacao: 'Erro ao salvar pedido' }))
  router.get('/:id/resumo', idPedido, controller.resumo, falhas({ padrao: 'Erro ao gerar resumo' }))
  router.post('/:id/cancelar', idPedido, controller.cancelar, falhas({ padrao: 'Erro ao cancelar pedido' }))

  // DELETE /pedidos/:id desativado de proposito: pedidos sao cancelados
  // (POST /pedidos/:id/cancelar), nunca excluidos. Nao reative.

  return router
}
