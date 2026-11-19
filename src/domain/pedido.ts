/**
 * @file Ciclo de vida do pedido: `criado` -> `cancelado`, e so isso.
 *
 * Pedidos sao cancelados, nunca excluidos. Nao existem outros status.
 */

/** Status de um pedido. */
export type StatusPedido = 'criado' | 'cancelado'

/**
 * Diz se um pedido com o status informado pode ser cancelado: so a partir de
 * `criado`.
 *
 * @example podeCancelar('criado')    // true
 * @example podeCancelar('cancelado') // false
 * @param status Status gravado (texto vindo do banco).
 * @returns `true` se a transicao para `cancelado` e permitida.
 */
export const podeCancelar = (status: string): boolean => status === 'criado'
