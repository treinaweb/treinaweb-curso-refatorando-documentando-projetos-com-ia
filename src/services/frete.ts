/**
 * @file Simulacao de frete (sem I/O).
 */
import * as precos from '../domain/precos'

/** Resultado da simulacao de frete. */
export interface SimulacaoFrete {
  cep: string
  subtotal: number
  frete: number
}

/**
 * Cria o service de frete.
 *
 * @returns `simular`.
 */
export function criarFreteService() {
  return {
    /**
     * Simula o frete com a mesma regra de `POST /pedidos` (`precos.frete`). E
     * uma simulacao: usa o CEP informado, enquanto o pedido usa o CEP do
     * cadastro do cliente.
     *
     * @param cep CEP normalizado (8 digitos, sem hifen).
     * @param subtotal Subtotal em reais, antes do desconto.
     * @returns `{ cep, subtotal, frete }`.
     */
    async simular(cep: string, subtotal: number): Promise<SimulacaoFrete> {
      return { cep, subtotal, frete: precos.frete(cep, subtotal) }
    },
  }
}
