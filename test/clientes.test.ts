import { describe, expect, it } from 'vitest'
import { api, appComBanco, SEED_CLIENTES } from './helpers'

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

  // Ids no path so com digitos (antes '1.0' encontrava o cliente 1).
  it('id decimal devolve 404 no formato { error }', async () => {
    const res = await api().get('/clientes/1.0')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Cliente nao encontrado' })
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

  // CEP so como texto (antes o numero 20040020 era aceito).
  it('aceita CEP com espacos nas pontas e recusa CEP numerico', async () => {
    const numerico = await api().post('/clientes').send({ nome: 'N', email: 'n@x', cep: 20040020 })
    expect(numerico.status).toBe(400)
    expect(numerico.body).toEqual({ error: 'CEP invalido' })
    const espacos = await api().post('/clientes').send({ nome: 'E', email: 'e@x', cep: ' 20040-020 ' })
    expect(espacos.status).toBe(201)
    expect(espacos.body.cep).toBe('20040020')
  })

  // CEP estrito: 5 digitos, hifen opcional e 3 digitos (antes o hifen era aceito
  // em qualquer posicao e '1.310100' passava pelo `isNaN`).
  it('CEP com hifen fora do lugar ou com ponto devolve 400', async () => {
    for (const cep of ['0131-0100', '1.310100']) {
      const res = await api().post('/clientes').send({ nome: 'H', email: 'h@x', cep })
      expect(res.status, cep).toBe(400)
      expect(res.body).toEqual({ error: 'CEP invalido' })
    }
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

  // Nome e email so como texto (antes eram gravados como vieram: 123 e true).
  it('nome que nao e texto devolve 400 Nome invalido e nao grava', async () => {
    const antes = await api().get('/clientes')
    const res = await api().post('/clientes').send({ nome: 123, email: 'n@x', cep: '01310100' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nome invalido' })
    expect((await api().get('/clientes')).body).toEqual(antes.body)
  })

  it('email que nao e texto devolve 400 Email invalido', async () => {
    const res = await api().post('/clientes').send({ nome: 'B', email: true, cep: '01310100' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Email invalido' })
  })

  it('nome e avaliado antes do email e do CEP', async () => {
    const res = await api().post('/clientes').send({ nome: 123, email: true, cep: 123 })
    expect(res.body).toEqual({ error: 'Nome invalido' })
  })

  it('nome so com espacos e aceito', async () => {
    const res = await api().post('/clientes').send({ nome: '   ', email: 'e@x', cep: '01310100' })
    expect(res.status).toBe(201)
    expect(res.body.nome).toBe('   ')
  })

  it('sem nome e com email invalido devolve 400 de obrigatorios', async () => {
    const res = await api().post('/clientes').send({ email: true, cep: '01310100' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nome e email sao obrigatorios' })
  })
})

describe('clientes: falhas do banco (formato { error })', () => {
  it('GET /clientes devolve 500 Erro ao listar clientes', async () => {
    const api = await appComBanco('DROP TABLE clientes')
    const res = await api().get('/clientes')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Erro ao listar clientes' })
  })

  it('GET /clientes/:id devolve 500 Erro ao buscar cliente', async () => {
    const api = await appComBanco('DROP TABLE clientes')
    const res = await api().get('/clientes/1')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Erro ao buscar cliente' })
  })

  it('POST /clientes devolve 500 Erro ao salvar cliente', async () => {
    const api = await appComBanco('DROP TABLE clientes')
    const res = await api().post('/clientes').send({ nome: 'A', email: 'a@x', cep: '01310100' })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Erro ao salvar cliente' })
  })
})
