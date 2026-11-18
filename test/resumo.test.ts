import { describe, expect, it } from 'vitest'
import { api, CLIENTE, criarPedido } from './helpers'

// GET /pedidos/:id/resumo (app.js) recalcula subtotal e desconto a partir dos
// itens gravados (nao le pedidos.desconto/total); o frete vem do valor gravado.

describe('GET /pedidos/:id/resumo', () => {
  it('monta o resumo com linhas por item, cliente e valores', async () => {
    const pedido = await criarPedido(CLIENTE.vipCep7, [
      { produto_id: 4, quantidade: 1 },
      { produto_id: 13, quantidade: 2 },
    ])
    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({
      pedido: pedido.id,
      cliente: 'Fernanda Costa',
      tipo_cliente: 'vip',
      itens: ['1x Cabo HDMI 2m - R$ 34.70', '2x Memória RAM 8GB - R$ 319.80'],
      subtotal: 354.5,
      desconto: 35.45,
      frete: 0,
      total: 319.05,
      status: 'criado',
    })
  })

  it('usa o frete gravado no pedido', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep4, [{ produto_id: 1, quantidade: 1 }])
    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.body).toEqual({
      pedido: pedido.id,
      cliente: 'Carla Oliveira',
      tipo_cliente: 'comum',
      itens: ['1x Mouse sem fio - R$ 50.00'],
      subtotal: 50,
      desconto: 0,
      frete: 30,
      total: 80,
      status: 'criado',
    })
  })

  it('linha do item formata o valor com 2 casas (ponto flutuante)', async () => {
    const pedido = await criarPedido(CLIENTE.vipCep2, [{ produto_id: 3, quantidade: 3 }])
    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.body).toEqual({
      pedido: pedido.id,
      cliente: 'João Pereira',
      tipo_cliente: 'vip',
      itens: ['3x Cabo USB-C 1m - R$ 89.70'],
      subtotal: 89.7,
      desconto: 8.97,
      frete: 15,
      total: 95.73,
      status: 'criado',
    })
  })

  it('atacado usa descontos.js (15% com 10 unidades)', async () => {
    const pedido = await criarPedido(CLIENTE.atacadoCep5, [
      { produto_id: 3, quantidade: 5 },
      { produto_id: 14, quantidade: 5 },
    ])
    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.body).toMatchObject({ tipo_cliente: 'atacado', subtotal: 274, desconto: 41.1, frete: 30, total: 262.9 })
  })

  it('comum acima de R$ 500 bate com o valor cobrado', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep4, [
      { produto_id: 6, quantidade: 1 },
      { produto_id: 10, quantidade: 1 },
    ])
    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.body).toMatchObject({ subtotal: 938.9, desconto: 46.95, frete: 0, total: 891.95 })
    expect(res.body.total).toBe(pedido.total)
  })

  // Comportamento atual: @todo Diverge de POST /pedidos (app.js). O resumo aplica
  // os 5% do cliente `comum` so com subtotal > 500 (la e >= 500). Num pedido de
  // exatamente R$ 500,00 o resumo mostra desconto 0 e total diferente do cobrado
  // (a confirmar com o negocio). Corrigir exige uma change propria.
  it('[atual] comum com exatamente R$ 500: resumo mostra desconto 0, diferente do cobrado', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 2, quantidade: 2 }])
    expect(pedido).toMatchObject({ subtotal: 500, desconto: 25, frete: 0, total: 475 })

    const gravado = await api().get(`/pedidos/${pedido.id}`)
    expect(gravado.body).toMatchObject({ desconto: 25, total: 475 })

    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.body).toEqual({
      pedido: pedido.id,
      cliente: 'Maria Silva',
      tipo_cliente: 'comum',
      itens: ['2x Teclado mecânico - R$ 500.00'],
      subtotal: 500,
      desconto: 0,
      frete: 0,
      total: 500,
      status: 'criado',
    })
  })

  it('pedido cancelado mostra status cancelado', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 1, quantidade: 1 }])
    await api().post(`/pedidos/${pedido.id}/cancelar`).expect(200)
    const res = await api().get(`/pedidos/${pedido.id}/resumo`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelado')
  })

  it('pedido inexistente devolve 404', async () => {
    const res = await api().get('/pedidos/999/resumo')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Pedido nao encontrado' })
  })

  // Comportamento atual: o id e concatenado no SQL do resumo (app.js).
  it('[atual] id nao numerico devolve 500 (SQL concatenado)', async () => {
    const res = await api().get('/pedidos/abc/resumo')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao gerar resumo' })
  })
})

describe('GET /pedidos/:id/resumo: lacunas', () => {
  it.todo('erro 500 "Erro ao gerar resumo" na consulta dos itens exige simular falha do SQLite')
})
