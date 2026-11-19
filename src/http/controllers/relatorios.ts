/**
 * @file Controller de `/relatorios`: chama o service e responde. Os erros
 * seguem para o `falhas(...)` da rota.
 */
import type { RequestHandler } from 'express'
import type { Services } from '../../services'

/**
 * Cria o controller dos relatorios.
 *
 * @param relatorio Service do relatorio.
 * @returns `vendas`.
 */
export function criarRelatoriosController(relatorio: Services['relatorio']) {
  /** `GET /relatorios/vendas` -> 200 `{ <tipo>: { pedidos, itens, faturamento }, ..., geral }`. */
  const vendas: RequestHandler = async (_req, res) => {
    res.json(await relatorio.vendas())
  }

  return { vendas }
}
