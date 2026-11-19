/**
 * @file Relatorio de vendas por tipo de cliente.
 */
import * as precos from '../domain/precos'
import type { Repositorios } from '../repositories'
import type { ItemPedido } from '../repositories/pedidos'

/** Totais de um grupo do relatorio. */
export interface TotaisVendas {
  /** Numero de pedidos. */
  pedidos: number
  /** Soma das quantidades dos itens. */
  itens: number
  /** Soma de `subtotal - desconto + frete`, em reais, com 2 casas. */
  faturamento: number
}

/**
 * Relatorio: um grupo por tipo de cliente, na ordem em que os tipos aparecem
 * nos pedidos, e `geral` por ultimo.
 */
export type RelatorioVendas = Record<string, TotaisVendas>

/**
 * Cria o service do relatorio.
 *
 * @param r Repositories.
 * @returns `vendas`.
 */
export function criarRelatorioService(r: Repositorios) {
  return {
    /**
     * Totais de vendas por tipo de cliente, ignorando pedidos cancelados.
     *
     * Sequencia de calculo (muda centavos se for alterada): soma o faturamento
     * de cada pedido no seu tipo; arredonda cada tipo com `arred2`; soma os
     * tipos ja arredondados no geral; arredonda o geral.
     *
     * O desconto usa a politica `precos.RELATORIO`
     * (src/domain/precos/descontos.ts), que so conhece os tipos de
     * `TIPOS_RELATORIO`: um tipo novo nas regras nao tem desconto aqui.
     *
     * @todo Diverge de POST /pedidos: recalcula o desconto em vez de ler
     *   `pedidos.desconto`, e a politica `RELATORIO` arredonda com `Math.round`
     *   para reais inteiros (la sao 2 casas). O faturamento pode nao bater com a
     *   soma de `pedidos.total` (a confirmar).
     * @returns `{ <tipo>: { pedidos, itens, faturamento }, ..., geral }`; sem
     *   pedidos, `{ geral: { pedidos: 0, itens: 0, faturamento: 0 } }`.
     */
    async vendas(): Promise<RelatorioVendas> {
      const pedidos = await r.pedidos.listarAtivosComTipo()
      const itensPorPedido: ItemPedido[][] = []
      for (const pedido of pedidos) {
        itensPorPedido.push(await r.pedidos.itensDe(pedido.id))
      }
      if (pedidos.length === 0) {
        return { geral: { pedidos: 0, itens: 0, faturamento: 0 } }
      }

      // Objeto simples (nao Map): a ordem das chaves na resposta e a de insercao.
      const porTipo: RelatorioVendas = {}
      pedidos.forEach((pedido, indice) => {
        const quantidade = itensPorPedido[indice].reduce((soma, item) => soma + item.quantidade, 0)
        const desconto = precos.desconto(precos.RELATORIO, pedido.tipo, pedido.subtotal, quantidade)
        if (!porTipo[pedido.tipo]) {
          porTipo[pedido.tipo] = { pedidos: 0, itens: 0, faturamento: 0 }
        }
        porTipo[pedido.tipo].pedidos++
        porTipo[pedido.tipo].itens += quantidade
        porTipo[pedido.tipo].faturamento += pedido.subtotal - desconto + pedido.frete
      })

      const geral: TotaisVendas = { pedidos: 0, itens: 0, faturamento: 0 }
      for (const tipo in porTipo) {
        porTipo[tipo].faturamento = precos.arred2(porTipo[tipo].faturamento)
        geral.pedidos += porTipo[tipo].pedidos
        geral.itens += porTipo[tipo].itens
        geral.faturamento += porTipo[tipo].faturamento
      }
      geral.faturamento = precos.arred2(geral.faturamento)
      porTipo.geral = geral
      return porTipo
    },
  }
}
