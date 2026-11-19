/**
 * @file Dominio de precos: o unico lugar com as regras de desconto, frete,
 * subtotal, total e precisao em reais. Puro (sem I/O nem Express).
 *
 * Importado direto pelos services (`import * as precos`).
 */
export * from './dinheiro'
export * from './descontos'
export * from './frete'
export * from './pedido'
