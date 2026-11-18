/**
 * @file Schema do corpo de `POST /pedidos`.
 *
 * Ordem de avaliacao (a resposta usa so o primeiro problema): `cliente_id`,
 * depois `itens`, depois item a item, com `produto_id` antes de `quantidade`.
 * `{item}` nas mensagens e trocado pela posicao do item (base 1) pelo
 * middleware `validar`.
 *
 * Mensagens (formato `{ erro }`, status 400):
 * - `cliente_id obrigatorio` (ausente ou `null`) / `cliente_id invalido`;
 * - `Pedido sem itens` (ausente, nao e lista ou lista vazia);
 * - `produto_id obrigatorio no item N` (ausente, `null` ou item que nao e
 *   objeto) / `produto_id invalido no item N`;
 * - `Quantidade invalida no item N` (qualquer valor que nao seja inteiro > 0).
 *
 * Campos extras sao ignorados. Clientes e produtos inexistentes, estoque e
 * calculo ficam no handler (src/routes/pedidos.js).
 */
import { z } from 'zod'
import { inteiroPositivo, objetoOuVazio } from './comum'

const QUANTIDADE_INVALIDA = 'Quantidade invalida no item {item}'

/** Um item do pedido. */
const itemSchema = objetoOuVazio(
  z.object({
    produto_id: inteiroPositivo('produto_id obrigatorio no item {item}', 'produto_id invalido no item {item}'),
    quantidade: z
      .number({ error: QUANTIDADE_INVALIDA })
      .int({ error: QUANTIDADE_INVALIDA })
      .positive({ error: QUANTIDADE_INVALIDA }),
  }),
)

/** Corpo de `POST /pedidos` (sem corpo conta como `{}`). */
export const criarPedidoSchema = objetoOuVazio(
  z.object({
    cliente_id: inteiroPositivo('cliente_id obrigatorio', 'cliente_id invalido'),
    itens: z.array(itemSchema, { error: 'Pedido sem itens' }).min(1, { error: 'Pedido sem itens' }),
  }),
)
