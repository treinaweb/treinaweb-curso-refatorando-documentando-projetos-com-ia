/**
 * @file Dominio de precos: o unico lugar com as regras de desconto, frete,
 * subtotal, total e precisao em reais. Puro (sem I/O nem Express).
 *
 * O `createApp` (src/app.ts) injeta este modulo inteiro nas factories dos
 * routers como `precos` (o JS legado nao importa `.ts` sob o Vitest).
 */
export * from './dinheiro'
export * from './descontos'
export * from './frete'
export * from './pedido'
