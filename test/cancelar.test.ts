import { describe, expect, it } from 'vitest'
import { api, CLIENTE, criarPedido, estoqueDe } from './helpers'

// Ciclo de vida: criado -> cancelado (so a partir de criado). Pedidos sao
// cancelados, nunca excluidos.

describe('POST /pedidos/:id/cancelar', () => {
  it('cancela, devolve o estoque de cada item e muda o status gravado', async () => {
    const mouse = await estoqueDe(1)
    const ssd = await estoqueDe(12)
    const pedido = await criarPedido(CLIENTE.comumCep0, [
      { produto_id: 1, quantidade: 2 },
      { produto_id: 12, quantidade: 3 },
    ])
    expect(await estoqueDe(1)).toBe(mouse - 2)
    expect(await estoqueDe(12)).toBe(ssd - 3)

    const res = await api().post(`/pedidos/${pedido.id}/cancelar`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({ id: pedido.id, status: 'cancelado' })

    expect(await estoqueDe(1)).toBe(mouse)
    expect(await estoqueDe(12)).toBe(ssd)

    const gravado = await api().get(`/pedidos/${pedido.id}`)
    expect(gravado.body).toMatchObject({ status: 'cancelado', total: pedido.total })
  })

  it('devolve o estoque de itens repetidos do mesmo produto', async () => {
    const webcam = await estoqueDe(8)
    const pedido = await criarPedido(CLIENTE.comumCep0, [
      { produto_id: 8, quantidade: 1 },
      { produto_id: 8, quantidade: 2 },
    ])
    expect(await estoqueDe(8)).toBe(webcam - 3)
    await api().post(`/pedidos/${pedido.id}/cancelar`).expect(200)
    expect(await estoqueDe(8)).toBe(webcam)
  })

  it('cancelar de novo devolve 400 e nao devolve estoque outra vez', async () => {
    const mouse = await estoqueDe(1)
    const pedido = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 1, quantidade: 1 }])
    await api().post(`/pedidos/${pedido.id}/cancelar`).expect(200)

    const res = await api().post(`/pedidos/${pedido.id}/cancelar`)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'Pedido nao pode ser cancelado (status cancelado)' })
    expect(await estoqueDe(1)).toBe(mouse)
  })

  it('pedido inexistente devolve 404', async () => {
    const res = await api().post('/pedidos/999/cancelar')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Pedido nao encontrado' })
  })

  it('id nao numerico devolve 404', async () => {
    const res = await api().post('/pedidos/abc/cancelar')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Pedido nao encontrado' })
  })

  // Comportamento atual: a afinidade INTEGER converte '<id>.0' no id.
  it('[atual] id decimal cancela o pedido', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 3, quantidade: 1 }])
    const res = await api().post(`/pedidos/${pedido.id}.0/cancelar`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: pedido.id, status: 'cancelado' })
  })

  it.todo(
    'pedido sem itens nunca responde (o loop de devolucao nao chama res.json); inalcancavel pela API, que exige itens',
  )
  it.todo('erros 500 "Erro ao cancelar pedido" exigem simular falha do SQLite')
})

describe('DELETE /pedidos/:id (desativado de proposito)', () => {
  it('devolve 404 e o pedido continua existindo', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 1, quantidade: 1 }])
    const res = await api().delete(`/pedidos/${pedido.id}`)
    expect(res.status).toBe(404)
    const gravado = await api().get(`/pedidos/${pedido.id}`)
    expect(gravado.status).toBe(200)
    expect(gravado.body.status).toBe('criado')
  })
})
