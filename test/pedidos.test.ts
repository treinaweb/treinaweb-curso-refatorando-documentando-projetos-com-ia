import { describe, expect, it } from 'vitest'
import { api, appComBanco, CLIENTE, criarPedido, estoqueDe, ISO_8601, postPedido } from './helpers'

// POST /pedidos (routes/pedidos.js) e a fonte canonica das regras de preco:
// total = subtotal - desconto + frete, frete sobre o subtotal ANTES do desconto,
// pelo CEP do cadastro do cliente.

/** Resposta 201 esperada de POST /pedidos. */
const criado = (cliente_id: number, subtotal: number, desconto: number, frete: number, total: number) => ({
  id: expect.any(Number),
  cliente_id,
  subtotal,
  desconto,
  frete,
  total,
  status: 'criado',
})

describe('POST /pedidos: validacoes', () => {
  // Sem corpo conta como `{}` (o antigo ramo `Body vazio` era inalcancavel e saiu).
  it('sem corpo devolve 400 cliente_id obrigatorio', async () => {
    const res = await api().post('/pedidos')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'cliente_id obrigatorio' })
  })

  // O erro do express.json() acontece antes das rotas e cai no tratador padrao
  // do Express: 400 em HTML, nao no formato `{ erro }` das rotas.
  it('corpo JSON malformado devolve 400 em HTML do Express', async () => {
    const res = await api().post('/pedidos').set('Content-Type', 'application/json').send('{"cliente_id":')
    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/^text\/html/)
  })

  it('sem cliente_id devolve 400', async () => {
    const res = await api()
      .post('/pedidos')
      .send({ itens: [{ produto_id: 1, quantidade: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'cliente_id obrigatorio' })
  })

  it('cliente_id e validado antes dos itens', async () => {
    const res = await api().post('/pedidos').send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'cliente_id obrigatorio' })
  })

  it('itens ausentes, vazios ou que nao sao lista devolvem 400', async () => {
    for (const itens of [undefined, [], 'x', { produto_id: 1, quantidade: 1 }]) {
      const res = await api().post('/pedidos').send({ cliente_id: 1, itens })
      expect(res.status, JSON.stringify(itens)).toBe(400)
      expect(res.body).toEqual({ erro: 'Pedido sem itens' })
    }
  })

  it('item sem produto_id devolve 400 com o numero do item (base 1)', async () => {
    const res = await postPedido(1, [
      { produto_id: 1, quantidade: 1 },
      { produto_id: undefined, quantidade: 1 },
    ])
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'produto_id obrigatorio no item 2' })
  })

  it('quantidade que nao e inteiro positivo devolve 400 com o numero do item', async () => {
    for (const quantidade of [0, -1, 1.5, '2', null, undefined]) {
      const res = await postPedido(1, [
        { produto_id: 1, quantidade: 1 },
        { produto_id: 2, quantidade },
      ])
      expect(res.status, JSON.stringify(quantidade)).toBe(400)
      expect(res.body).toEqual({ erro: 'Quantidade invalida no item 2' })
    }
  })

  it('produto_id e conferido antes da quantidade, item a item', async () => {
    const res = await postPedido(1, [
      { produto_id: 1, quantidade: 0 },
      { produto_id: undefined, quantidade: 1 },
    ])
    expect(res.body).toEqual({ erro: 'Quantidade invalida no item 1' })
  })

  it('cliente inexistente devolve 404', async () => {
    const res = await postPedido(999, [{ produto_id: 1, quantidade: 1 }])
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Cliente nao encontrado' })
  })

  it('produto inexistente devolve 404 com o id', async () => {
    const res = await postPedido(1, [
      { produto_id: 1, quantidade: 1 },
      { produto_id: 999, quantidade: 1 },
    ])
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Produto 999 nao encontrado' })
  })

  it('estoque insuficiente devolve 400 com o nome do produto e nao baixa nada', async () => {
    const mouse = await estoqueDe(1)
    const notebook = await estoqueDe(11)
    const res = await postPedido(1, [
      { produto_id: 1, quantidade: 1 },
      { produto_id: 11, quantidade: notebook + 1 },
    ])
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'Estoque insuficiente para Notebook 14 polegadas' })
    expect(await estoqueDe(1)).toBe(mouse)
    expect(await estoqueDe(11)).toBe(notebook)
  })

  // Ids do corpo: ausente ou null -> "obrigatorio"; qualquer outro valor que nao
  // seja inteiro positivo -> "invalido" (antes "abc" dava 500 pelo SQL
  // concatenado, 0/""/false davam "obrigatorio", 1.5 dava 404 e "1" era aceito).
  it('cliente_id null devolve 400 cliente_id obrigatorio', async () => {
    const res = await postPedido(null, [{ produto_id: 3, quantidade: 1 }])
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'cliente_id obrigatorio' })
  })

  it('cliente_id que nao e inteiro positivo devolve 400 cliente_id invalido', async () => {
    for (const cliente_id of ['abc', 0, '', false, 1.5, -3, '1']) {
      const res = await postPedido(cliente_id, [{ produto_id: 3, quantidade: 1 }])
      expect(res.status, JSON.stringify(cliente_id)).toBe(400)
      expect(res.body).toEqual({ erro: 'cliente_id invalido' })
    }
  })

  it('cliente_id e avaliado antes dos itens', async () => {
    const res = await api().post('/pedidos').send({ cliente_id: 'abc', itens: [] })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'cliente_id invalido' })
  })

  it('produto_id que nao e inteiro positivo devolve 400 produto_id invalido', async () => {
    for (const produto_id of ['abc', 0, '3', 1.5, -1, true]) {
      const res = await postPedido(1, [
        { produto_id: 1, quantidade: 1 },
        { produto_id, quantidade: 1 },
      ])
      expect(res.status, JSON.stringify(produto_id)).toBe(400)
      expect(res.body).toEqual({ erro: 'produto_id invalido no item 2' })
    }
  })

  it('produto_id null devolve 400 produto_id obrigatorio', async () => {
    const res = await postPedido(1, [{ produto_id: null, quantidade: 1 }])
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'produto_id obrigatorio no item 1' })
  })

  // Item que nao e objeto conta como item vazio (antes `null` derrubava o
  // handler com TypeError e o Express respondia 500 em HTML).
  it('item que nao e objeto devolve 400 produto_id obrigatorio', async () => {
    for (const item of [null, 5, 'x', [1]]) {
      const res = await postPedido(1, [item as never])
      expect(res.status, JSON.stringify(item)).toBe(400)
      expect(res.body).toEqual({ erro: 'produto_id obrigatorio no item 1' })
    }
  })

  it('pedido com ids validos e estoque cria normalmente', async () => {
    const res = await postPedido(1, [{ produto_id: 3, quantidade: 1 }])
    expect(res.status).toBe(201)
    expect(res.body).toEqual(criado(1, 29.9, 0, 15, 44.9))
  })
})

describe('POST /pedidos: regras de preco', () => {
  it('comum abaixo de R$ 500 nao tem desconto', async () => {
    // 250 + 149.90 + 100 = 499.90 (>= 300: frete gratis)
    const body = await criarPedido(CLIENTE.comumCep0, [
      { produto_id: 2, quantidade: 1 },
      { produto_id: 17, quantidade: 1 },
      { produto_id: 8, quantidade: 1 },
    ])
    expect(body).toEqual(criado(CLIENTE.comumCep0, 499.9, 0, 0, 499.9))
  })

  it('comum com exatamente R$ 500 tem 5% de desconto (>= 500)', async () => {
    const body = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 2, quantidade: 2 }])
    expect(body).toEqual(criado(CLIENTE.comumCep0, 500, 25, 0, 475))
  })

  it('comum acima de R$ 500 tem 5% de desconto com 2 casas', async () => {
    // 899 + 39.90 = 938.90 -> 5% = 46.945 -> 46.95 (toFixed)
    const body = await criarPedido(CLIENTE.comumCep4, [
      { produto_id: 6, quantidade: 1 },
      { produto_id: 10, quantidade: 1 },
    ])
    expect(body).toEqual(criado(CLIENTE.comumCep4, 938.9, 46.95, 0, 891.95))
  })

  it('vip tem 10% sobre qualquer valor (nao so acima de R$ 200)', async () => {
    const body = await criarPedido(CLIENTE.vipCep2, [{ produto_id: 1, quantidade: 1 }])
    expect(body).toEqual(criado(CLIENTE.vipCep2, 50, 5, 15, 60))
  })

  it('vip com centavos arredonda o desconto para 2 casas', async () => {
    const body = await criarPedido(CLIENTE.vipCep7, [{ produto_id: 14, quantidade: 1 }])
    expect(body).toEqual(criado(CLIENTE.vipCep7, 24.9, 2.49, 30, 52.41))
  })

  it('atacado com 9 unidades somadas nao tem desconto', async () => {
    // 5 x 29.90 + 4 x 24.90 = 149.50 + 99.60 = 249.10
    const body = await criarPedido(CLIENTE.atacadoCep5, [
      { produto_id: 3, quantidade: 5 },
      { produto_id: 14, quantidade: 4 },
    ])
    expect(body).toEqual(criado(CLIENTE.atacadoCep5, 249.1, 0, 30, 279.1))
  })

  it('atacado com 10 unidades somadas em mais de um item tem 15%', async () => {
    // 5 x 29.90 + 5 x 24.90 = 149.50 + 124.50 = 274 -> 15% = 41.10
    const body = await criarPedido(CLIENTE.atacadoCep5, [
      { produto_id: 3, quantidade: 5 },
      { produto_id: 14, quantidade: 5 },
    ])
    expect(body).toEqual(criado(CLIENTE.atacadoCep5, 274, 41.1, 30, 262.9))
  })

  it.each([
    ['0-3', CLIENTE.comumCep0, 15],
    ['4-7', CLIENTE.comumCep4, 30],
    ['8-9 (8)', CLIENTE.comumCep8, 20],
    ['8-9 (9)', CLIENTE.comumCep9, 20],
  ])('frete pelo CEP do cadastro, faixa %s', async (_faixa, cliente, frete) => {
    const body = await criarPedido(cliente, [{ produto_id: 1, quantidade: 1 }])
    expect(body).toEqual(criado(cliente, 50, 0, frete, 50 + frete))
  })

  it('frete gratis olha o subtotal ANTES do desconto', async () => {
    // vip: 3 x 100 = 300 -> frete 0, mesmo com o subtotal descontado (270) abaixo de 300
    const body = await criarPedido(CLIENTE.vipCep2, [{ produto_id: 8, quantidade: 3 }])
    expect(body).toEqual(criado(CLIENTE.vipCep2, 300, 30, 0, 270))
  })

  it('subtotal logo acima de 300 e gratis; logo abaixo paga frete', async () => {
    // 39.90 + 219.90 + 45 = 304.80 -> gratis
    const acima = await criarPedido(CLIENTE.comumCep8, [
      { produto_id: 10, quantidade: 1 },
      { produto_id: 12, quantidade: 1 },
      { produto_id: 15, quantidade: 1 },
    ])
    expect(acima).toEqual(criado(CLIENTE.comumCep8, 304.8, 0, 0, 304.8))
    // 219.90 + 45 + 24.90 = 289.80 -> paga R$ 20
    const abaixo = await criarPedido(CLIENTE.comumCep8, [
      { produto_id: 12, quantidade: 1 },
      { produto_id: 15, quantidade: 1 },
      { produto_id: 14, quantidade: 1 },
    ])
    expect(abaixo).toEqual(criado(CLIENTE.comumCep8, 289.8, 0, 20, 309.8))
  })

  it('ponto flutuante: 3 x 29.90 da subtotal 89.70 (2 casas)', async () => {
    const body = await criarPedido(CLIENTE.vipCep2, [{ produto_id: 3, quantidade: 3 }])
    expect(body).toEqual(criado(CLIENTE.vipCep2, 89.7, 8.97, 15, 95.73))
  })

  it('ponto flutuante: 3 x 61.70 da subtotal 185.10 (2 casas)', async () => {
    const body = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 5, quantidade: 3 }])
    expect(body).toEqual(criado(CLIENTE.comumCep0, 185.1, 0, 15, 200.1))
  })
})

describe('POST /pedidos: efeitos e GET /pedidos/:id', () => {
  it('baixa o estoque de cada item', async () => {
    const mouse = await estoqueDe(1)
    const hdmi = await estoqueDe(4)
    await criarPedido(CLIENTE.comumCep0, [
      { produto_id: 1, quantidade: 2 },
      { produto_id: 4, quantidade: 3 },
    ])
    expect(await estoqueDe(1)).toBe(mouse - 2)
    expect(await estoqueDe(4)).toBe(hdmi - 3)
  })

  it('aceita pedir exatamente o estoque disponivel', async () => {
    const disponivel = await estoqueDe(16)
    await criarPedido(CLIENTE.comumCep0, [{ produto_id: 16, quantidade: disponivel }])
    expect(await estoqueDe(16)).toBe(0)
  })

  it('GET /pedidos/:id devolve os valores gravados e os itens com preco copiado', async () => {
    const criadoBody = await criarPedido(CLIENTE.vipCep7, [
      { produto_id: 4, quantidade: 1 },
      { produto_id: 13, quantidade: 2 },
    ])
    const res = await api().get(`/pedidos/${criadoBody.id}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    // 34.70 + 2 x 159.90 = 354.50 -> vip 35.45, frete gratis
    expect(res.body).toEqual({
      id: criadoBody.id,
      cliente_id: CLIENTE.vipCep7,
      subtotal: 354.5,
      desconto: 35.45,
      frete: 0,
      total: 319.05,
      status: 'criado',
      criado_em: expect.stringMatching(ISO_8601),
      itens: [
        { produto_id: 4, nome: 'Cabo HDMI 2m', quantidade: 1, preco_unitario: 34.7 },
        { produto_id: 13, nome: 'Memória RAM 8GB', quantidade: 2, preco_unitario: 159.9 },
      ],
    })
    expect(res.body).toMatchObject(criadoBody)
  })

  it('GET /pedidos/:id inexistente devolve 404', async () => {
    const res = await api().get('/pedidos/999')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Pedido nao encontrado' })
  })

  it('GET /pedidos/:id nao numerico devolve 404', async () => {
    const res = await api().get('/pedidos/abc')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Pedido nao encontrado' })
  })

  // Ids no path so com digitos (antes '<id>.0' encontrava o pedido).
  it('GET /pedidos/:id decimal devolve 404 mesmo com o pedido existindo', async () => {
    const pedido = await criarPedido(CLIENTE.comumCep0, [{ produto_id: 3, quantidade: 1 }])
    const res = await api().get(`/pedidos/${pedido.id}.0`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ erro: 'Pedido nao encontrado' })
  })

  it('nao existe listagem GET /pedidos', async () => {
    const res = await api().get('/pedidos')
    expect(res.status).toBe(404)
  })

  // Comportamento atual (bug): o estoque e conferido item a item contra o valor
  // lido antes do pedido, sem somar itens repetidos do mesmo produto, e a baixa
  // nao confere nada. Pedir o mesmo produto em dois itens passa do estoque e o
  // deixa negativo. Corrigir exige uma change propria.
  it('[atual] produto repetido em dois itens passa do estoque e o deixa negativo', async () => {
    const suporte = await estoqueDe(9)
    expect(suporte).toBe(3)
    const res = await postPedido(CLIENTE.comumCep0, [
      { produto_id: 9, quantidade: 2 },
      { produto_id: 9, quantidade: 2 },
    ])
    // 4 x 299.90 = 1199.60 -> comum 5% = 59.98
    expect(res.status).toBe(201)
    expect(res.body).toEqual(criado(CLIENTE.comumCep0, 1199.6, 59.98, 0, 1139.62))
    expect(await estoqueDe(9)).toBe(-1)
  })
})

/** Pedido gravado direto no banco (id 1), para testar falhas na leitura dos itens. */
const PEDIDO_GRAVADO =
  "INSERT INTO pedidos (cliente_id, subtotal, desconto, frete, total, status, criado_em) VALUES (1, 50, 0, 15, 65, 'criado', '2026-01-01T00:00:00.000Z');"

describe('POST /pedidos e GET /pedidos/:id: falhas do banco', () => {
  it('GET /pedidos/:id devolve 500 Erro ao buscar pedido', async () => {
    const api = await appComBanco('DROP TABLE pedidos')
    const res = await api().get('/pedidos/1')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao buscar pedido' })
  })

  it('GET /pedidos/:id devolve 500 Erro ao buscar itens quando so os itens falham', async () => {
    const api = await appComBanco(PEDIDO_GRAVADO + ' DROP TABLE itens_pedido;')
    const res = await api().get('/pedidos/1')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao buscar itens' })
  })

  it('POST /pedidos devolve 500 Erro interno quando a leitura do cliente falha', async () => {
    const api = await appComBanco('DROP TABLE clientes')
    const res = await api()
      .post('/pedidos')
      .send({ cliente_id: 1, itens: [{ produto_id: 1, quantidade: 1 }] })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro interno' })
  })

  it('POST /pedidos devolve 500 Erro interno quando a leitura dos produtos falha', async () => {
    const api = await appComBanco('DROP TABLE produtos')
    const res = await api()
      .post('/pedidos')
      .send({ cliente_id: 1, itens: [{ produto_id: 1, quantidade: 1 }] })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro interno' })
  })

  it('POST /pedidos devolve 500 Erro ao salvar pedido quando a gravacao do pedido falha', async () => {
    const api = await appComBanco('DROP TABLE pedidos')
    const res = await api()
      .post('/pedidos')
      .send({ cliente_id: 1, itens: [{ produto_id: 1, quantidade: 1 }] })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao salvar pedido' })
  })
})

/** Trigger que faz falhar qualquer comando do tipo informado na tabela. */
const falhaEm = (momento: string, tabela: string) =>
  `CREATE TRIGGER falha BEFORE ${momento} ON ${tabela} BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;`

// A criacao do pedido e atomica (antes, sem transacao, uma falha no meio
// deixava o pedido gravado pela metade e respondia uma mensagem propria).
describe('POST /pedidos: gravacao atomica', () => {
  it('falha ao gravar um item devolve 500 Erro ao salvar pedido e nao grava nada', async () => {
    const api = await appComBanco(falhaEm('INSERT', 'itens_pedido'))
    const antes = (await api().get('/produtos/1')).body.estoque
    const res = await api()
      .post('/pedidos')
      .send({ cliente_id: 1, itens: [{ produto_id: 1, quantidade: 2 }] })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao salvar pedido' })
    expect((await api().get('/pedidos/1')).status).toBe(404)
    expect((await api().get('/produtos/1')).body.estoque).toBe(antes)
  })

  it('falha ao baixar o estoque devolve 500 Erro ao salvar pedido e nao grava nada', async () => {
    const api = await appComBanco(falhaEm('UPDATE', 'produtos'))
    const mouse = (await api().get('/produtos/1')).body.estoque
    const teclado = (await api().get('/produtos/2')).body.estoque
    const res = await api()
      .post('/pedidos')
      .send({
        cliente_id: 1,
        itens: [
          { produto_id: 1, quantidade: 1 },
          { produto_id: 2, quantidade: 1 },
        ],
      })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ erro: 'Erro ao salvar pedido' })
    expect((await api().get('/pedidos/1')).status).toBe(404)
    expect((await api().get('/produtos/1')).body.estoque).toBe(mouse)
    expect((await api().get('/produtos/2')).body.estoque).toBe(teclado)
  })
})
