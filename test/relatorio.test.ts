import { describe, expect, it } from 'vitest'
import { api, appComBanco, CLIENTE, criarPedido } from './helpers'

// GET /relatorios/vendas (src/services/relatorio.ts). Este arquivo tem banco proprio e os testes
// sao ACUMULATIVOS, em sequencia: cada um parte dos pedidos criados pelos anteriores.
// O relatorio usa a politica `RELATORIO` (src/domain/precos/descontos.ts).

describe('GET /relatorios/vendas', () => {
  it('sem pedidos devolve so `geral` zerado', async () => {
    const res = await api().get('/relatorios/vendas')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({ geral: { pedidos: 0, itens: 0, faturamento: 0 } })
  })

  it('so com pedidos cancelados continua zerado', async () => {
    const pedido = await criarPedido(CLIENTE.vipCep7, [{ produto_id: 1, quantidade: 1 }])
    await api().post(`/pedidos/${pedido.id}/cancelar`).expect(200)
    const res = await api().get('/relatorios/vendas')
    expect(res.body).toEqual({ geral: { pedidos: 0, itens: 0, faturamento: 0 } })
  })

  it('agrupa por tipo, ignora cancelados e omite tipos sem pedidos', async () => {
    // comum, 2 x 250 = 500 -> desconto 25, frete 0 -> 475
    await criarPedido(CLIENTE.comumCep0, [{ produto_id: 2, quantidade: 2 }])
    // comum, 50 -> frete 30 -> 80
    await criarPedido(CLIENTE.comumCep4, [{ produto_id: 1, quantidade: 1 }])

    const res = await api().get('/relatorios/vendas')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      comum: { pedidos: 2, itens: 3, faturamento: 555 },
      geral: { pedidos: 2, itens: 3, faturamento: 555 },
    })
  })

  // Comportamento atual: @todo Diverge de POST /pedidos (politica RELATORIO). O relatorio
  // recalcula o desconto em vez de ler pedidos.desconto e arredonda com
  // Math.round para reais inteiros, entao o faturamento nao bate com a soma de
  // pedidos.total. Corrigir exige uma change propria.
  it('[atual] desconto arredondado com Math.round: faturamento difere da soma de pedidos.total', async () => {
    // vip, 3 x 29.90 = 89.70 -> cobrado: desconto 8.97, total 95.73
    //                         -> relatorio: desconto Math.round(8.97) = 9 -> 95.70
    const vip = await criarPedido(CLIENTE.vipCep2, [{ produto_id: 3, quantidade: 3 }])
    expect(vip).toMatchObject({ desconto: 8.97, total: 95.73 })
    // atacado, 5 x 29.90 + 5 x 24.90 = 274 -> cobrado: desconto 41.10, total 262.90
    //                                       -> relatorio: desconto 41 -> 263
    const atacado = await criarPedido(CLIENTE.atacadoCep5, [
      { produto_id: 3, quantidade: 5 },
      { produto_id: 14, quantidade: 5 },
    ])
    expect(atacado).toMatchObject({ desconto: 41.1, total: 262.9 })

    const res = await api().get('/relatorios/vendas')
    expect(res.body).toEqual({
      comum: { pedidos: 2, itens: 3, faturamento: 555 },
      vip: { pedidos: 1, itens: 3, faturamento: 95.7 },
      atacado: { pedidos: 1, itens: 10, faturamento: 263 },
      geral: { pedidos: 4, itens: 16, faturamento: 913.7 },
    })

    // soma de pedidos.total dos 4 pedidos ativos: 475 + 80 + 95.73 + 262.90 = 913.63
    expect(res.body.geral.faturamento).not.toBe(913.63)
  })
})

describe('GET /relatorios/vendas: falhas do banco', () => {
  it('devolve 500 Erro ao gerar relatorio quando a consulta dos pedidos falha', async () => {
    const api = await appComBanco('DROP TABLE pedidos')
    const res = await api().get('/relatorios/vendas')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao gerar relatorio' })
  })

  // Antes, o erro na leitura dos itens era ignorado e virava TypeError fora do
  // Express, derrubando o processo.
  it('falha na leitura dos itens devolve 500 e o processo continua atendendo', async () => {
    const api = await appComBanco(
      "INSERT INTO pedidos (cliente_id, subtotal, desconto, frete, total, status, criado_em) VALUES (1, 50, 0, 15, 65, 'criado', '2026-01-01T00:00:00.000Z'); DROP TABLE itens_pedido;",
    )
    const res = await api().get('/relatorios/vendas')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao gerar relatorio' })
    const depois = await api().get('/produtos')
    expect(depois.status).toBe(200)
  })
})
