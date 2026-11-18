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

  it('subtotal ausente vale 0 (e paga frete)', async () => {
    const ausente = await api().get('/frete').query({ cep: '01310100' })
    expect(ausente.body).toEqual({ cep: '01310100', subtotal: 0, frete: 15 })
  })

  // Subtotal so com digitos e decimal opcional apos ponto (antes `abc` valia 0
  // e `350reais` valia 350, pelo parseFloat).
  it('subtotal invalido ou com sufixo devolve 400', async () => {
    for (const subtotal of ['abc', '350reais']) {
      const res = await api().get('/frete').query({ cep: '01310100', subtotal })
      expect(res.status, subtotal).toBe(400)
      expect(res.body).toEqual({ erro: 'Subtotal invalido' })
    }
  })

  it('CEP ausente ou invalido devolve 400', async () => {
    for (const query of [{}, { cep: '' }, { cep: '123' }, { cep: 'abcdefgh' }]) {
      const res = await api().get('/frete').query({ ...query, subtotal: '100' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ erro: 'CEP invalido' })
    }
  })

  // Antes o parseFloat aceitava negativo, expoente, '.5' e cortava na virgula.
  it('subtotal negativo, com expoente, sem parte inteira, com virgula ou repetido devolve 400', async () => {
    for (const subtotal of ['-10', '1e3', '.5', '100,50']) {
      const res = await api().get('/frete').query({ cep: '01310100', subtotal })
      expect(res.status, subtotal).toBe(400)
      expect(res.body).toEqual({ erro: 'Subtotal invalido' })
    }
    const repetido = await api().get('/frete?cep=01310100&subtotal=1&subtotal=2')
    expect(repetido.status).toBe(400)
    expect(repetido.body).toEqual({ erro: 'Subtotal invalido' })
  })

  it('subtotal decimal com ponto e aceito', async () => {
    const res = await api().get('/frete').query({ cep: '01310100', subtotal: '299.99' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ cep: '01310100', subtotal: 299.99, frete: 15 })
  })

  it('subtotal vazio vale 0', async () => {
    const res = await api().get('/frete?cep=01310100&subtotal=')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ cep: '01310100', subtotal: 0, frete: 15 })
  })

  // CEP estrito tambem na simulacao (antes o hifen era aceito em qualquer posicao).
  it('CEP com hifen fora do lugar ou repetido devolve 400', async () => {
    const hifen = await api().get('/frete').query({ cep: '0131-0100' })
    expect(hifen.status).toBe(400)
    expect(hifen.body).toEqual({ erro: 'CEP invalido' })
    const repetido = await api().get('/frete?cep=01310100&cep=01310100')
    expect(repetido.status).toBe(400)
    expect(repetido.body).toEqual({ erro: 'CEP invalido' })
  })

  it('CEP e avaliado antes do subtotal', async () => {
    const res = await api().get('/frete').query({ cep: '123', subtotal: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'CEP invalido' })
  })
})
