/**
 * @file Schema do `id` no path (`/produtos/:id`, `/clientes/:id`,
 * `/pedidos/:id`, resumo e cancelamento).
 *
 * So digitos (`^\d+$`); zeros a esquerda sao aceitos. Quem monta o validador
 * usa `status: 404` e a mensagem de "nao encontrado" da rota: um id fora do
 * padrao responde igual a um id inexistente.
 */
import { z } from 'zod'

/** `req.params` com `id` so de digitos. */
export const idSchema = z.object({ id: z.string().regex(/^\d+$/) })
