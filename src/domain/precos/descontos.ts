/**
 * @file Desconto por tipo de cliente (`clientes.tipo`).
 *
 * As regras de cada tipo sao dados (`REGRAS`: taxa e condicao). Uma
 * `Politica` combina regras com um arredondamento. Ha tres politicas, uma por
 * ponto que calcula desconto:
 *
 * - `PEDIDO`: a canonica, usada por `POST /pedidos` (e o valor cobrado e
 *   gravado em `pedidos.desconto`);
 * - `RESUMO`: `GET /pedidos/:id/resumo`, que recalcula o desconto;
 * - `RELATORIO`: `GET /relatorios/vendas`, que recalcula o desconto.
 *
 * `RESUMO` e `RELATORIO` divergem da canonica de proposito (comportamento
 * registrado por testes `[atual]`, a confirmar com o negocio). Nao unifique
 * sem essa decisao. Um tipo novo e uma entrada em `REGRAS`: passa a valer no
 * pedido e no resumo, mas nao no relatorio (`TIPOS_RELATORIO`).
 */
import { arred2 } from './dinheiro'

/** Regra de desconto de um tipo de cliente. */
export interface Regra {
  /** Fracao do subtotal concedida como desconto (0.05 = 5%). */
  taxa: number
  /**
   * Se o pedido tem direito ao desconto.
   *
   * @param subtotal Subtotal dos itens em reais.
   * @param quantidade Soma das quantidades dos itens.
   */
  elegivel(subtotal: number, quantidade: number): boolean
}

/** Regras de desconto mais o arredondamento do valor. */
export interface Politica {
  /** Regra por tipo de cliente; tipo ausente nao tem desconto. */
  regras: ReadonlyMap<string, Regra>
  /** Arredondamento aplicado a `subtotal * taxa`. */
  arredondar(valor: number): number
}

const comum: Regra = { taxa: 0.05, elegivel: (subtotal) => subtotal >= 500 }

/**
 * Regra do `vip`: 10% sobre qualquer subtotal.
 *
 * @todo Diverge de comentario antigo: uma regra antiga dizia "vip ganha 10% so
 *   acima de 200 reais", mas o desconto vale para qualquer valor (a confirmar).
 */
const vip: Regra = { taxa: 0.1, elegivel: () => true }

const atacado: Regra = { taxa: 0.15, elegivel: (_subtotal, quantidade) => quantidade >= 10 }

/**
 * Regras canonicas por tipo:
 *
 * - `comum`: 5% se subtotal >= R$ 500;
 * - `vip`: 10% sobre qualquer valor;
 * - `atacado`: 15% se a soma das quantidades for >= 10;
 * - outros tipos: sem desconto.
 */
export const REGRAS: ReadonlyMap<string, Regra> = new Map([
  ['comum', comum],
  ['vip', vip],
  ['atacado', atacado],
])

/** Politica canonica (`POST /pedidos`): `REGRAS`, com 2 casas. */
export const PEDIDO: Politica = { regras: REGRAS, arredondar: arred2 }

/**
 * Politica do resumo do pedido (`GET /pedidos/:id/resumo`).
 *
 * @todo Diverge de POST /pedidos: o `comum` so tem desconto com subtotal
 *   > 500 (na canonica, >= 500). Num pedido `comum` de exatamente R$ 500,00, o
 *   resumo mostra desconto 0 e um total diferente do cobrado (a confirmar).
 */
export const RESUMO: Politica = {
  regras: new Map([...REGRAS, ['comum', { taxa: comum.taxa, elegivel: (subtotal) => subtotal > 500 }]]),
  arredondar: arred2,
}

/** Tipos que o relatorio conhece; um tipo novo em `REGRAS` nao entra aqui sozinho. */
export const TIPOS_RELATORIO: readonly string[] = ['vip', 'comum', 'atacado']

/**
 * Politica do relatorio de vendas (`GET /relatorios/vendas`).
 *
 * @todo Diverge de POST /pedidos: arredonda o desconto com `Math.round` para
 *   reais inteiros (na canonica, 2 casas), e so conhece os tipos de
 *   `TIPOS_RELATORIO`. O faturamento pode nao bater com a soma de
 *   `pedidos.total` (a confirmar).
 */
export const RELATORIO: Politica = {
  regras: new Map([...REGRAS].filter(([tipo]) => TIPOS_RELATORIO.includes(tipo))),
  arredondar: Math.round,
}

/**
 * Soma das quantidades dos itens (convertidas com `Number`), usada pela regra
 * do `atacado`.
 *
 * @param itens Itens do pedido; so `quantidade` e lida.
 * @returns A soma das quantidades.
 */
export const quantidadeTotal = (itens: readonly { quantidade: number | string }[]): number => {
  let qtd = 0
  for (const item of itens) {
    qtd = qtd + Number(item.quantidade)
  }
  return qtd
}

/**
 * Desconto de um pedido pela politica informada: `arredondar(subtotal * taxa)`
 * se o tipo tem regra e o pedido e elegivel; senao, 0.
 *
 * @example desconto(PEDIDO, 'comum', 500, 1)    // 25
 * @example desconto(RESUMO, 'comum', 500, 1)    // 0
 * @example desconto(RELATORIO, 'vip', 123.45, 1) // 12
 * @param politica `PEDIDO`, `RESUMO` ou `RELATORIO`.
 * @param tipo Tipo do cliente (`clientes.tipo`).
 * @param subtotal Subtotal dos itens em reais.
 * @param quantidade Soma das quantidades dos itens (`quantidadeTotal`).
 * @returns Valor do desconto em reais.
 */
export const desconto = (politica: Politica, tipo: string, subtotal: number, quantidade: number): number => {
  const regra = politica.regras.get(tipo)
  if (!regra || !regra.elegivel(subtotal, quantidade)) return 0
  return politica.arredondar(subtotal * regra.taxa)
}
