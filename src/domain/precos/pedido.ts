/**
 * @file Subtotal e total do pedido, na mesma sequencia de calculo do codigo
 * legado (a ordem das operacoes de ponto flutuante muda centavos).
 */
import { arred2 } from './dinheiro'

/** Item com preco, para o subtotal. */
export interface ItemComPreco {
  /** Preco do produto copiado para o item, em reais. */
  preco_unitario: number
  /** Quantidade do item. */
  quantidade: number
}

/**
 * Subtotal dos itens: soma `preco_unitario * quantidade` na ordem dos itens e
 * arredonda para 2 casas so no fim.
 *
 * @param itens Itens do pedido.
 * @returns Subtotal em reais, com 2 casas.
 */
export const subtotal = (itens: readonly ItemComPreco[]): number => {
  let soma = 0
  for (const item of itens) {
    soma = soma + item.preco_unitario * item.quantidade
  }
  return arred2(soma)
}

/**
 * Total do pedido: `subtotal - desconto + frete`, nessa ordem, com 2 casas.
 *
 * @param valorSubtotal Subtotal em reais.
 * @param desconto Desconto em reais.
 * @param valorFrete Frete em reais.
 * @returns Total em reais, com 2 casas.
 */
export const total = (valorSubtotal: number, desconto: number, valorFrete: number): number =>
  arred2(valorSubtotal - desconto + valorFrete)
