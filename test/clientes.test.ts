import { describe, expect, it } from 'vitest'
import { api, SEED_CLIENTES } from './helpers'

// routes/clientes.js usa o formato de erro `{ error }` (o legado usa `{ erro }`).

describe('GET /clientes', () => {
  it('lista os clientes do seed ordenados por id', async () => {
    const res = await api().get('/clientes')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual(SEED_CLIENTES)
  })
})

describe('GET /clientes/:id', () => {
  it('devolve o cliente', async () => {
    const res = await api().get('/clientes/5')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(SEED_CLIENTES[4])
  })

  it('id inexistente devolve 404 no formato { error }', async () => {
    const res = await api().get('/clientes/999')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Cliente nao encontrado' })
  })

  // Comportamento atual: a afinidade INTEGER converte '1.0' em 1.
  it('[atual] id decimal encontra o cliente 1', async () => {
    const res = await api().get('/clientes/1.0')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(SEED_CLIENTES[0])
  })
})

describe('POST /clientes', () => {
  it('cadastra com CEP com hifen, grava sem hifen e sempre como comum', async () => {
    const res = await api()
      .post('/clientes')
      .send({ nome: 'Ana Teste', email: 'ana@example.com', cep: '04538-133' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      id: expect.any(Number),
      nome: 'Ana Teste',
      email: 'ana@example.com',
      cep: '04538133',
      tipo: 'comum',
    })

    const detalhe = await api().get(`/clientes/${res.body.id}`)
    expect(detalhe.body).toEqual(res.body)
    const lista = await api().get('/clientes')
    expect(lista.body.at(-1)).toEqual(res.body)
  })

  it('cadastra com CEP sem hifen e ignora `tipo` no corpo', async () => {
    const res = await api()
      .post('/clientes')
      .send({ nome: 'Bia Teste', email: 'bia@example.com', cep: '90010000', tipo: 'vip' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      id: expect.any(Number),
      nome: 'Bia Teste',
      email: 'bia@example.com',
      cep: '90010000',
      tipo: 'comum',
    })
  })

  it('aceita CEP numerico e com espacos nas pontas', async () => {
    const numerico = await api().post('/clientes').send({ nome: 'N', email: 'n@x', cep: 20040020 })
    expect(numerico.status).toBe(201)
    expect(numerico.body.cep).toBe('20040020')
    const espacos = await api().post('/clientes').send({ nome: 'E', email: 'e@x', cep: ' 20040-020 ' })
    expect(espacos.status).toBe(201)
    expect(espacos.body.cep).toBe('20040020')
  })

  // Comportamento atual de utils.validaCep: remove o PRIMEIRO hifen em qualquer
  // posicao e so confere tamanho 8 e `isNaN`, entao aceita hifen fora do lugar e
  // textos numericos que nao sao so digitos. Corrigir exige uma change propria.
  it('[atual] validaCep aceita hifen em qualquer posicao e numeros nao inteiros', async () => {
    const hifen = await api().post('/clientes').send({ nome: 'H', email: 'h@x', cep: '0131-0100' })
    expect(hifen.status).toBe(201)
    expect(hifen.body.cep).toBe('01310100')
    const ponto = await api().post('/clientes').send({ nome: 'P', email: 'p@x', cep: '1.310100' })
    expect(ponto.status).toBe(201)
    expect(ponto.body.cep).toBe('1.310100')
  })

  it('sem nome ou sem email devolve 400', async () => {
    for (const body of [
      { email: 'x@x', cep: '01310100' },
      { nome: 'X', cep: '01310100' },
      { nome: '', email: 'x@x', cep: '01310100' },
    ]) {
      const res = await api().post('/clientes').send(body)
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Nome e email sao obrigatorios' })
    }
  })

  it('nome/email sao validados antes do CEP', async () => {
    const res = await api().post('/clientes').send({ email: 'x@x', cep: '123' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nome e email sao obrigatorios' })
  })

  it('CEP ausente ou invalido devolve 400', async () => {
    for (const cep of [undefined, '', '123', '013101000', '01310-10a', '01310--100']) {
      const res = await api().post('/clientes').send({ nome: 'X', email: 'x@x', cep })
      expect(res.status, `cep ${JSON.stringify(cep)}`).toBe(400)
      expect(res.body).toEqual({ error: 'CEP invalido' })
    }
  })

  it('sem corpo devolve 400 de nome/email', async () => {
    const res = await api().post('/clientes')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nome e email sao obrigatorios' })
  })

  it('cadastro invalido nao grava nada', async () => {
    const antes = await api().get('/clientes')
    await api().post('/clientes').send({ nome: 'X', email: 'x@x', cep: '123' })
    const depois = await api().get('/clientes')
    expect(depois.body).toEqual(antes.body)
  })

  // Comportamento atual: so se confere `!nome || !email`, entao valores que nao
  // sao texto sao gravados como vieram.
  it('[atual] nome numerico e gravado como numero', async () => {
    const res = await api().post('/clientes').send({ nome: 123, email: 'n@x', cep: '01310100' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: expect.any(Number), nome: 123, email: 'n@x', cep: '01310100', tipo: 'comum' })
  })

  it('[atual] email booleano e gravado como o texto "1"', async () => {
    const res = await api().post('/clientes').send({ nome: 'B', email: true, cep: '01310100' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: expect.any(Number), nome: 'B', email: true, cep: '01310100', tipo: 'comum' })
    const detalhe = await api().get(`/clientes/${res.body.id}`)
    expect(detalhe.body.email).toBe('1')
  })

  it('sem nome e com email invalido devolve 400 de obrigatorios', async () => {
    const res = await api().post('/clientes').send({ email: true, cep: '01310100' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nome e email sao obrigatorios' })
  })
})

describe('clientes: lacunas', () => {
  it.todo('erros 500 "Erro ao listar/buscar/salvar cliente" exigem simular falha do SQLite')
})
