/**
 * @file Relatorios, montados em `/relatorios` (src/app.ts).
 *
 * Erros usam o formato `{ erro: '...' }`. Sem autenticacao (uso interno).
 */
import express from 'express'
import type { Services } from '../../services'
import { criarRelatoriosController } from '../controllers/relatorios'
import { tratarErros } from '../middlewares/erros'

/**
 * Cria o router dos relatorios.
 *
 * Rota `GET /relatorios/vendas`: totais de vendas por tipo de cliente,
 * ignorando pedidos cancelados (src/services/relatorio.ts).
 * - 200 (sem pedidos): `{ geral: { pedidos: 0, itens: 0, faturamento: 0 } }`
 * - 200: `{ <tipo>: { pedidos, itens, faturamento }, ..., geral: {...} }`, em
 *   que `itens` e a soma das quantidades e `faturamento` = subtotal - desconto + frete
 * - 500: `{ erro: 'Erro ao gerar relatorio' }`
 *
 * @todo Diverge de POST /pedidos: recalcula o desconto com a politica
 *   `RELATORIO` (`Math.round`, reais inteiros) em vez de ler `pedidos.desconto`.
 *   O faturamento pode nao bater com a soma de `pedidos.total` (a confirmar).
 * @param services Services (`criarServices`).
 * @returns Router com `GET /vendas`.
 */
export function criarRelatoriosRouter(services: Services): express.Router {
  const router = express.Router()
  const controller = criarRelatoriosController(services.relatorio)
  const falhas = tratarErros('erro')

  router.get('/vendas', controller.vendas, falhas({ padrao: 'Erro ao gerar relatorio' }))

  return router
}
