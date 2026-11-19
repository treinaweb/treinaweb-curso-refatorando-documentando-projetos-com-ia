/**
 * @file Precisao de valores em reais no dominio de precos.
 */

/**
 * Arredonda um valor em reais para 2 casas, exatamente como o codigo legado:
 * `Number(valor.toFixed(2))`.
 *
 * Nao e o mesmo que `Math.round(valor * 100) / 100`: por causa da
 * representacao binaria, os dois divergem em alguns valores (por exemplo,
 * `0.015` vira 0.01 aqui e 0.02 com `Math.round`). Os valores gravados e
 * respondidos dependem desta forma; nao troque.
 *
 * @example arred2(46.945) // 46.95
 * @param valor Valor em reais.
 * @returns O valor com 2 casas.
 */
export const arred2 = (valor: number): number => Number(valor.toFixed(2))
