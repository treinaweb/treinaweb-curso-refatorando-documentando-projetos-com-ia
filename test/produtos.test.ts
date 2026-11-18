import { describe, expect, it } from 'vitest'
import { api, appComBanco, SEED_PRODUTOS } from './helpers'

describe('GET /produtos', () => {
  it('lista todos os produtos do seed', async () => {
    const res = await api().get('/produtos')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual(SEED_PRODUTOS)
  })

  it('busca vazia lista todos', async () => {
    const res = await api().get('/produtos?busca=')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(SEED_PRODUTOS)
  })

  it('filtra por parte do nome sem diferenciar maiusculas (ASCII)', async () => {
    const cabos = SEED_PRODUTOS.filter((p) => [3, 4, 14].includes(p.id))
    for (const busca of ['cabo', 'CABO', 'Cabo']) {
      const res = await api().get('/produtos').query({ busca })
      expect(res.status).toBe(200)
      expect(res.body).toEqual(cabos)
    }
  })

  it('letras acentuadas diferenciam maiusculas (LIKE do SQLite so ignora caixa em ASCII)', async () => {
    const memoria = SEED_PRODUTOS.filter((p) => p.id === 13)
    const minuscula = await api().get('/produtos').query({ busca: 'memória' })
    expect(minuscula.body).toEqual(memoria)
    const maiuscula = await api().get('/produtos').query({ busca: 'MEMÓRIA' })
    expect(maiuscula.status).toBe(200)
    expect(maiuscula.body).toEqual([])
  })

  it('busca sem resultados devolve lista vazia', async () => {
    const res = await api().get('/produtos').query({ busca: 'geladeira' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  // A busca e parametro do LIKE (antes era concatenada no SQL e a aspa dava 500).
  it('aspa simples na busca e um caractere comum', async () => {
    const res = await api().get('/produtos').query({ busca: "'" })
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    const injecao = await api().get('/produtos').query({ busca: "' OR '1'='1" })
    expect(injecao.status).toBe(200)
    expect(injecao.body).toEqual([])
  })

  // O query parser do Express 4 transforma a busca repetida em lista e `busca[x]`
  // em objeto (antes, concatenados no SQL, davam 200 com lista vazia).
  it('busca repetida ou como objeto devolve 400', async () => {
    for (const url of ['/produtos?busca=a&busca=b', '/produtos?busca[x]=cabo']) {
      const res = await api().get(url)
      expect(res.status, url).toBe(400)
      expect(res.body, url).toEqual({ erro: 'Busca invalida' })
    }
  })

  it('o _ na busca funciona como curinga de um caractere', async () => {
    const res = await api().get('/produtos').query({ busca: 'Cabo_HDMI' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual([SEED_PRODUTOS[3]])
  })
})

describe('GET /produtos/:id', () => {
  it('devolve o produto', async () => {
    const res = await api().get('/produtos/9')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({ id: 9, nome: 'Suporte para notebook', preco: 299.9, estoque: 3 })
  })

  it('id inexistente devolve 404', async () => {
    const res = await api().get('/produtos/999')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Produto nao encontrado' })
  })

  it('id nao numerico devolve 404', async () => {
    const res = await api().get('/produtos/abc')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Produto nao encontrado' })
  })

  // Ids no path so com digitos: os demais respondem como id inexistente
  // (antes a afinidade INTEGER do SQLite convertia '1.0', '1e0' e ' 1' em 1).
  it('id decimal, com expoente ou com espaco devolve 404', async () => {
    for (const id of ['1.0', '1e0', '%201']) {
      const res = await api().get(`/produtos/${id}`)
      expect(res.status, id).toBe(404)
      expect(res.body).toEqual({ erro: 'Produto nao encontrado' })
    }
  })

  it('id com zero a esquerda encontra o produto', async () => {
    const res = await api().get('/produtos/01')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 1, nome: 'Mouse sem fio', preco: 50, estoque: 40 })
  })
})

describe('produtos: falhas do banco', () => {
  it('GET /produtos devolve 500 Erro ao buscar produtos', async () => {
    const api = await appComBanco('DROP TABLE produtos')
    const res = await api().get('/produtos')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao buscar produtos' })
  })

  it('GET /produtos/:id devolve 500 Erro ao buscar produto', async () => {
    const api = await appComBanco('DROP TABLE produtos')
    const res = await api().get('/produtos/1')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao buscar produto' })
  })
})
