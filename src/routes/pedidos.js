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
var utils = require('../utils')

/**
 * Cria o router de pedidos sobre a conexao informada.
 *
 * @param {import('sqlite3').Database} db Conexao aberta (`abrirBanco`).
 * @param {Object} v Validadores de entrada (middlewares montados em src/app.ts
 *   a partir de src/http/schemas/).
 * @param {import('express').RequestHandler} v.idPedido `:id` de pedido (404 `Pedido nao encontrado`).
 * @param {import('express').RequestHandler} v.criarPedido Corpo de `POST /pedidos`
 *   (src/http/schemas/pedido.ts; 400 com a mensagem do primeiro problema).
 * @returns {import('express').Router} Router com `GET /:id` e `POST /`.
 */
function createPedidosRouter(db, v) {
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
  function getPedido(req, res) {
    db.get('SELECT * FROM pedidos WHERE id = ?', [req.params.id], function(err, pedido) {
      if (err) {
        console.log(err)
        return res.status(500).json({erro: 'Erro ao buscar pedido'})
      }
      if (!pedido) {
        return res.status(404).json({erro: 'Pedido nao encontrado'})
      }
      db.all('SELECT i.produto_id, p.nome, i.quantidade, i.preco_unitario FROM itens_pedido i JOIN produtos p ON p.id = i.produto_id WHERE i.pedido_id = ?', [pedido.id], function(err, itens) {
        if (err) {
          console.log(err)
          return res.status(500).json({erro: 'Erro ao buscar itens'})
        }
        pedido.itens = itens
        res.json(pedido)
      })
    })
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
   * estoque de cada produto. Nao ha transacao: se um insert/update falhar no
   * meio, o pedido fica gravado (resposta 500 'Pedido criado com erros').
   *
   * Respostas:
   * - 201: `{ id, cliente_id, subtotal, desconto, frete, total, status: 'criado' }`
   * - 400 (validacao, so o primeiro problema): `cliente_id obrigatorio`,
   *   `cliente_id invalido`, `Pedido sem itens`, `produto_id obrigatorio no item N`,
   *   `produto_id invalido no item N`, `Quantidade invalida no item N`
   * - 400: `Estoque insuficiente para <produto>`
   * - 404: `Cliente nao encontrado`, `Produto <id> nao encontrado`
   * - 500: `Erro interno`, `Erro ao salvar pedido`, `Pedido criado com erros`
   * (todas no formato `{ erro: '...' }`)
   *
   * Atencao: varios SQLs aqui sao concatenados (codigo legado, nao copie).
   *
   * @todo Diverge de utils.calcula_frete: a regra de frete abaixo e uma copia
   *   inline da funcao de utils.js. Hoje produzem o mesmo resultado; ao mudar
   *   uma, alinhe a outra (esta e a que vale para o valor cobrado).
   */
  router.post('/', v.criarPedido, function(req, res) {
    var inicio = Date.now()
    var body = req.body
    var cliente_id = body.cliente_id
    var itens = body.itens

    utils.buscar_cliente(db, cliente_id, function(err, cliente) {
      if (err) {
        console.log(err)
        return res.status(500).json({erro: 'Erro interno'})
      }
      if (!cliente) {
        return res.status(404).json({erro: 'Cliente nao encontrado'})
      }
      var ids = []
      for (var i = 0; i < itens.length; i++) {
        ids.push(itens[i].produto_id)
      }
      db.all('SELECT * FROM produtos WHERE id IN (' + ids.join(',') + ')', function(err, produtos) {
        if (err) {
          console.log(err)
          return res.status(500).json({erro: 'Erro interno'})
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

        db.run("INSERT INTO pedidos (cliente_id, subtotal, desconto, frete, total, status, criado_em) VALUES (" + cliente.id + ", " + subtotal + ", " + desconto + ", " + frete + ", " + total + ", 'criado', '" + agora + "')", function(err) {
          if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao salvar pedido'})
          }
          var pedido_id = this.lastID
          var feitos = 0
          var deuErro = false
          for (var m = 0; m < itens.length; m++) {
            (function(item) {
              db.run('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)', [pedido_id, item.produto_id, item.quantidade, item.preco_unitario], function(err) {
                if (err) {
                  deuErro = true
                  console.log('erro item', err)
                }
                db.run('UPDATE produtos SET estoque = estoque - ' + item.quantidade + ' WHERE id = ' + item.produto_id, function(err2) {
                  if (err2) {
                    deuErro = true
                    console.log(err2)
                  }
                  feitos++
                  if (feitos == itens.length) {
                    if (deuErro) {
                      return res.status(500).json({erro: 'Pedido criado com erros'})
                    }
                    //console.log('pedido ok', pedido_id)
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
                  }
                })
              })
            })(itens[m])
          }
        })
      })
    })
  })

  return router
}

module.exports = createPedidosRouter
