/**
 * @file Regra de frete: a unica do projeto. Usada por `POST /pedidos` (valor
 * cobrado, com o CEP do cadastro do cliente) e por `GET /frete` (simulacao,
 * com o CEP da query).
 */

/** Subtotal a partir do qual o frete e gratis, em reais. */
const FRETE_GRATIS_A_PARTIR_DE = 300

/**
 * Calcula o frete pelo CEP e pelo subtotal ANTES do desconto (acordo com o
 * comercial; nao alterar).
 *
 * - subtotal >= R$ 300: gratis (0);
 * - senao, pelo 1o digito do CEP: 0-3 -> R$ 15, 4-7 -> R$ 30, 8-9 -> R$ 20.
 *
 * @example frete('01310100', 100) // 15
 * @example frete('90000000', 300) // 0
 * @param cep CEP ja normalizado (8 digitos, sem hifen).
 * @param subtotal Subtotal dos itens em reais, antes do desconto.
 * @returns Valor do frete em reais.
 */
export const frete = (cep: string, subtotal: number): number => {
  if (subtotal >= FRETE_GRATIS_A_PARTIR_DE) return 0
  const faixa = parseInt(cep.substring(0, 1))
  if (faixa <= 3) return 15
  if (faixa <= 7) return 30
  return 20
}
