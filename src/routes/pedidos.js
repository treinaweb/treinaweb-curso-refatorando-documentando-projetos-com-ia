/**
 * @file Rotas de pedidos, montadas em `/pedidos` (src/app.ts).
 *
 * Outras rotas de pedido ainda estao em src/routes/legado.js:
 * `GET /pedidos/:id/resumo` e `POST /pedidos/:id/cancelar`. Nao existe
 * `GET /pedidos` (listagem) nem `DELETE /pedidos/:id`. Erros usam o formato
 * `{ erro: '...' }`.
 */

var express = require('express')
var descontos = require('../descontos')

/**
 * Cria o router de pedidos sobre os repositories informados.
 *
 * Os handlers sao `async`; toda chamada a repository fica num `try` que
 * responde a mensagem 500 da operacao (sem ele, o Express 5 responderia 500
 * em HTML).
 *
 * @param {import('../repositories').Repositorios} r Repositories (src/repositories/).
 * @param {Object} v Validadores de entrada (middlewares montados em src/app.ts
 *   a partir de src/http/schemas/).
 * @param {import('express').RequestHandler} v.idPedido `:id` de pedido (404 `Pedido nao encontrado`).
 * @param {import('express').RequestHandler} v.criarPedido Corpo de `POST /pedidos`
 *   (src/http/schemas/pedido.ts; 400 com a mensagem do primeiro problema).
 * @returns {import('express').Router} Router com `GET /:id` e `POST /`.
 */
function createPedidosRouter(r, v) {
  var router = express.Router()

  /**
   * `GET /pedidos/:id`: detalhe do pedido com os itens.
   *
   * Retorna os valores gravados na criacao (nao recalcula nada).
   *
   * - 200: `{ id, cliente_id, subtotal, desconto, frete, total, status, criado_em,
   *   itens: [{ produto_id, nome, quantidade, preco_unitario }] }`
   * - 404: `{ erro: 'Pedido nao encontrado' }`
   * - 500: `{ erro: 'Erro ao buscar pedido' }` ou `{ erro: 'Erro ao buscar itens' }`
   *
   * @param {import('express').Request} req `req.params.id`: id do pedido.
   * @param {import('express').Response} res
   */
  async function getPedido(req, res) {
    var pedido
    try {
      pedido = await r.pedidos.buscar(req.params.id)
    } catch (err) {
      console.log(err)
      return res.status(500).json({erro: 'Erro ao buscar pedido'})
    }
    if (!pedido) {
      return res.status(404).json({erro: 'Pedido nao encontrado'})
    }
    try {
      pedido.itens = await r.pedidos.itensDoPedido(pedido.id)
    } catch (err) {
      console.log(err)
      return res.status(500).json({erro: 'Erro ao buscar itens'})
    }
    res.json(pedido)
  }

  router.get('/:id', v.idPedido, getPedido)

  /**
   * `POST /pedidos`: cria um pedido. E a fonte canonica das regras de preco:
   * os valores calculados aqui sao os gravados em `pedidos`.
   *
   * Body: `{ cliente_id, itens: [{ produto_id, quantidade }] }`, validado antes
   * pelo `v.criarPedido` (src/http/schemas/pedido.ts): ids e `quantidade` sao
   * inteiros positivos, ha ao menos um item e campos extras sao ignorados.
   *
   * Calculo:
   * - `preco_unitario` = preco atual do produto (copiado para `itens_pedido`);
   * - `subtotal` = soma de `preco_unitario * quantidade` (2 casas);
   * - desconto: `comum` 5% se subtotal >= 500; outros tipos via
   *   `descontos.desconto_<tipo>(subtotal, itens)`; sem funcao, 0;
   * - frete sobre o subtotal ANTES do desconto, pelo CEP do cadastro do cliente
   *   (subtotal >= 300 gratis; senao 1o digito 0-3 R$ 15, 4-7 R$ 30, 8-9 R$ 20);
   * - `total` = subtotal - desconto + frete.
   *
   * Efeitos: insere o pedido com status `criado`, insere os itens e baixa o
   * estoque de cada produto, numa transacao (`r.pedidos.criar`): se qualquer
   * gravacao falhar, nada fica gravado e a resposta e 500 'Erro ao salvar pedido'.
   *
   * Respostas:
   * - 201: `{ id, cliente_id, subtotal, desconto, frete, total, status: 'criado' }`
   * - 400 (validacao, so o primeiro problema): `cliente_id obrigatorio`,
   *   `cliente_id invalido`, `Pedido sem itens`, `produto_id obrigatorio no item N`,
   *   `produto_id invalido no item N`, `Quantidade invalida no item N`
   * - 400: `Estoque insuficiente para <produto>`
   * - 404: `Cliente nao encontrado`, `Produto <id> nao encontrado`
   * - 500: `Erro interno` (leitura do cliente ou dos produtos),
   *   `Erro ao salvar pedido` (gravacao)
   * (todas no formato `{ erro: '...' }`)
   *
   * @todo Diverge de utils.calcula_frete: a regra de frete abaixo e uma copia
   *   inline da funcao de utils.js. Hoje produzem o mesmo resultado; ao mudar
   *   uma, alinhe a outra (esta e a que vale para o valor cobrado).
   */
  router.post('/', v.criarPedido, async function(req, res) {
    var inicio = Date.now()
    var body = req.body
    var cliente_id = body.cliente_id
    var itens = body.itens

    var cliente
    var produtos
    try {
      cliente = await r.clientes.buscarCompleto(cliente_id)
      if (cliente) {
        produtos = await r.produtos.buscarVarios(itens.map(function(item) { return item.produto_id }))
      }
    } catch (err) {
      console.log(err)
      return res.status(500).json({erro: 'Erro interno'})
    }
    if (!cliente) {
      return res.status(404).json({erro: 'Cliente nao encontrado'})
    }
    var tmp2 = {}
    for (var j = 0; j < produtos.length; j++) {
      tmp2[produtos[j].id] = produtos[j]
    }
    var subtotal = 0
    for (var k = 0; k < itens.length; k++) {
      var p = tmp2[itens[k].produto_id]
      if (!p) {
        return res.status(404).json({erro: 'Produto ' + itens[k].produto_id + ' nao encontrado'})
      }
      if (p.estoque < itens[k].quantidade) {
        return res.status(400).json({erro: 'Estoque insuficiente para ' + p.nome})
      }
      itens[k].preco_unitario = p.preco
      subtotal = subtotal + p.preco * itens[k].quantidade
    }
    subtotal = Number(subtotal.toFixed(2))

    var desconto = 0
    if (cliente.tipo == 'comum') {
      if (subtotal >= 500) {
        desconto = Number((subtotal * 0.05).toFixed(2))
      }
    } else {
      var fn = descontos['desconto_' + cliente.tipo]
      if (fn) {
        desconto = fn(subtotal, itens)
      }
    }

    // nao mexer: frete gratis olha o subtotal, combinado com o comercial
    var frete = 0
    if (subtotal < 300) {
      var faixa = parseInt(cliente.cep.substring(0, 1))
      if (faixa <= 3) {
        frete = 15
      } else if (faixa <= 7) {
        frete = 30
      } else {
        frete = 20
      }
    }
    var total = Number((subtotal - desconto + frete).toFixed(2))
    var agora = new Date().toISOString()

    var pedido_id
    try {
      pedido_id = await r.pedidos.criar({
        cliente_id: cliente.id,
        subtotal: subtotal,
        desconto: desconto,
        frete: frete,
        total: total,
        criado_em: agora,
        itens: itens.map(function(item) {
          return {produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario: item.preco_unitario}
        })
      })
    } catch (err) {
      console.log(err)
      return res.status(500).json({erro: 'Erro ao salvar pedido'})
    }
    console.log('pedido ' + pedido_id + ' (' + cliente.tipo + ') em ' + (Date.now() - inicio) + 'ms')
    res.status(201).json({
      id: pedido_id,
      cliente_id: cliente.id,
      subtotal: subtotal,
      desconto: desconto,
      frete: frete,
      total: total,
      status: 'criado'
    })
  })

  return router
}

module.exports = createPedidosRouter
