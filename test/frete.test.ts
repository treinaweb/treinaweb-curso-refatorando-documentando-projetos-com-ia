import { describe, expect, it } from 'vitest'
import { api } from './helpers'

// GET /frete e uma simulacao: usa o CEP da query (POST /pedidos usa o do cadastro).

describe('GET /frete', () => {
  it.each([
    ['01310100', 15],
    ['20040020', 15],
    ['30130000', 15],
    ['40020000', 30],
    ['50030230', 30],
    ['60060100', 30],
    ['70040010', 30],
    ['80010000', 20],
    ['90010000', 20],
  ])('CEP %s com subtotal abaixo de 300 custa R$ %d', async (cep, frete) => {
    const res = await api().get('/frete').query({ cep, subtotal: '100' })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({ cep, subtotal: 100, frete })
  })

  it('subtotal 299.99 ainda paga frete; 300 ou mais e gratis', async () => {
    const abaixo = await api().get('/frete').query({ cep: '40020000', subtotal: '299.99' })
    expect(abaixo.body).toEqual({ cep: '40020000', subtotal: 299.99, frete: 30 })
    const limite = await api().get('/frete').query({ cep: '40020000', subtotal: '300' })
    expect(limite.body).toEqual({ cep: '40020000', subtotal: 300, frete: 0 })
    const acima = await api().get('/frete').query({ cep: '40020000', subtotal: '5000' })
    expect(acima.body).toEqual({ cep: '40020000', subtotal: 5000, frete: 0 })
  })

  it('CEP com hifen sai normalizado na resposta', async () => {
    const res = await api().get('/frete').query({ cep: '80010-000', subtotal: '10' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ cep: '80010000', subtotal: 10, frete: 20 })
  })

  it('subtotal ausente ou invalido vale 0 (e paga frete)', async () => {
    const ausente = await api().get('/frete').query({ cep: '01310100' })
    expect(ausente.body).toEqual({ cep: '01310100', subtotal: 0, frete: 15 })
    const invalido = await api().get('/frete').query({ cep: '01310100', subtotal: 'abc' })
    expect(invalido.body).toEqual({ cep: '01310100', subtotal: 0, frete: 15 })
  })

  it('subtotal com sufixo nao numerico usa o prefixo (parseFloat)', async () => {
    const res = await api().get('/frete').query({ cep: '01310100', subtotal: '350reais' })
    expect(res.body).toEqual({ cep: '01310100', subtotal: 350, frete: 0 })
  })

  it('CEP ausente ou invalido devolve 400', async () => {
    for (const query of [{}, { cep: '' }, { cep: '123' }, { cep: 'abcdefgh' }]) {
      const res = await api().get('/frete').query({ ...query, subtotal: '100' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ erro: 'CEP invalido' })
    }
  })
})
