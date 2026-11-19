/**
 * Testes unitarios do dominio de precos (src/domain/precos/).
 *
 * Diferente dos testes de caracterizacao (test/*.test.ts, so pelo HTTP), estes
 * importam direto do dominio, e so dele. Documentam as regras, as fronteiras e
 * as divergencias com nome (`RESUMO`, `RELATORIO`) lado a lado com a politica
 * canonica (`PEDIDO`).
 */
import { describe, expect, it } from 'vitest'
import {
  PEDIDO,
  REGRAS,
  RELATORIO,
  RESUMO,
  TIPOS_RELATORIO,
  arred2,
  desconto,
  frete,
  quantidadeTotal,
  subtotal,
  total,
  type Politica,
} from '../../src/domain/precos'

describe('desconto: politica PEDIDO (canonica)', () => {
  it.each([
    [499.99, 0],
    [500, 25],
    [500.01, 25],
  ])('comum com subtotal %s: %s', (sub, esperado) => {
    expect(desconto(PEDIDO, 'comum', sub, 1)).toBe(esperado)
  })

  it.each([
    [0.01, 0],
    [100, 10],
    [123.45, 12.35],
  ])('vip com subtotal %s: %s (10% sobre qualquer valor)', (sub, esperado) => {
    expect(desconto(PEDIDO, 'vip', sub, 1)).toBe(esperado)
  })

  it.each([
    [9, 0],
    [10, 150],
  ])('atacado com quantidade %s: %s', (qtd, esperado) => {
    expect(desconto(PEDIDO, 'atacado', 1000, qtd)).toBe(esperado)
  })

  it.each(['desconhecido', '', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'tipo sem regra (%j): 0, sem cair no prototipo de objeto',
    (tipo) => {
      expect(desconto(PEDIDO, tipo, 1000, 100)).toBe(0)
      expect(desconto(RESUMO, tipo, 1000, 100)).toBe(0)
      expect(desconto(RELATORIO, tipo, 1000, 100)).toBe(0)
    },
  )
})

describe('desconto: as tres politicas lado a lado', () => {
  it('[atual] comum com exatamente R$ 500: PEDIDO 25, RESUMO 0 (> 500), RELATORIO 25', () => {
    expect(desconto(PEDIDO, 'comum', 500, 1)).toBe(25)
    expect(desconto(RESUMO, 'comum', 500, 1)).toBe(0)
    expect(desconto(RELATORIO, 'comum', 500, 1)).toBe(25)
  })

  it('[atual] vip com centavos: PEDIDO e RESUMO 12.35 (2 casas), RELATORIO 12 (Math.round)', () => {
    expect(desconto(PEDIDO, 'vip', 123.45, 1)).toBe(12.35)
    expect(desconto(RESUMO, 'vip', 123.45, 1)).toBe(12.35)
    expect(desconto(RELATORIO, 'vip', 123.45, 1)).toBe(12)
  })

  it('fora das divergencias, as tres concordam (comum 500.01, atacado 10 unidades)', () => {
    for (const p of [PEDIDO, RESUMO, RELATORIO]) {
      expect(desconto(p, 'comum', 600, 1)).toBe(30)
      expect(desconto(p, 'atacado', 1000, 10)).toBe(150)
      expect(desconto(p, 'atacado', 1000, 9)).toBe(0)
    }
  })

  it('[atual] o relatorio so conhece TIPOS_RELATORIO: um tipo novo nas regras nao entra nele', () => {
    expect([...RELATORIO.regras.keys()].sort()).toEqual([...TIPOS_RELATORIO].sort())

    // Simula um tipo novo nas regras canonicas e monta as politicas como o dominio monta.
    const regras = new Map([...REGRAS, ['parceiro', { taxa: 0.2, elegivel: () => true }]])
    const pedido: Politica = { regras, arredondar: arred2 }
    const relatorio: Politica = {
      regras: new Map([...regras].filter(([tipo]) => TIPOS_RELATORIO.includes(tipo))),
      arredondar: Math.round,
    }
    expect(desconto(pedido, 'parceiro', 100, 1)).toBe(20)
    expect(desconto(relatorio, 'parceiro', 100, 1)).toBe(0)
  })

  it('o resumo reaproveita a taxa canonica do comum (so a condicao difere)', () => {
    expect(RESUMO.regras.get('comum')?.taxa).toBe(REGRAS.get('comum')?.taxa)
    expect(RESUMO.regras.get('vip')).toBe(REGRAS.get('vip'))
    expect(RESUMO.regras.get('atacado')).toBe(REGRAS.get('atacado'))
  })
})

describe('frete', () => {
  it.each([
    ['01310100', 299.99, 15],
    ['01310100', 300, 0],
    ['90000000', 300.01, 0],
  ])('cep %s com subtotal %s: %s (gratis a partir de R$ 300)', (cep, sub, esperado) => {
    expect(frete(cep, sub)).toBe(esperado)
  })

  it.each([
    ['00000000', 15],
    ['39999999', 15],
    ['40000000', 30],
    ['79999999', 30],
    ['80000000', 20],
    ['99999999', 20],
  ])('cep %s abaixo de R$ 300: %s (pelo 1o digito)', (cep, esperado) => {
    expect(frete(cep, 0)).toBe(esperado)
  })
})

describe('dinheiro e pedido', () => {
  it('arred2 e Number(toFixed(2)), nao Math.round(x * 100) / 100', () => {
    expect(arred2(0.015)).toBe(0.01)
    expect(Math.round(0.015 * 100) / 100).toBe(0.02)
    expect(arred2(46.945)).toBe(Number((46.945).toFixed(2)))
  })

  it('subtotal soma preco_unitario * quantidade na ordem e arredonda so no fim', () => {
    expect(subtotal([])).toBe(0)
    expect(
      subtotal([
        { preco_unitario: 89.9, quantidade: 2 },
        { preco_unitario: 120, quantidade: 1 },
      ]),
    ).toBe(299.8)
    // 0.1 + 0.2 sem arredondar seria 0.30000000000000004
    expect(
      subtotal([
        { preco_unitario: 0.1, quantidade: 1 },
        { preco_unitario: 0.2, quantidade: 1 },
      ]),
    ).toBe(0.3)
    // tres itens de 0.005: a soma (0.015) arredonda para 0.01; arredondar cada item daria 0.03
    const itens = [0.005, 0.005, 0.005].map((preco) => ({ preco_unitario: preco, quantidade: 1 }))
    expect(subtotal(itens)).toBe(0.01)
  })

  it('total = subtotal - desconto + frete, nessa ordem, com 2 casas', () => {
    expect(total(500, 25, 0)).toBe(475)
    expect(total(123.45, 12.35, 15)).toBe(126.1)
    expect(total(123.45, 12.35, 15)).toBe(Number((123.45 - 12.35 + 15).toFixed(2)))
  })

  it('quantidadeTotal soma as quantidades convertidas com Number', () => {
    expect(quantidadeTotal([])).toBe(0)
    expect(quantidadeTotal([{ quantidade: 4 }, { quantidade: '6' }])).toBe(10)
  })
})
