var express = require('express')
var router = express.Router()
var db = require('../db')
var descontos = require('../descontos')
var utils = require('../utils')

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

router.get('/:id', getPedido)

router.post('/', function(req, res) {
  var inicio = Date.now()
  var body = req.body
  if (!body) {
    return res.status(400).json({erro: 'Body vazio'})
  }
  var cliente_id = body.cliente_id
  var itens = body.itens
  if (!cliente_id) {
    return res.status(400).json({erro: 'cliente_id obrigatorio'})
  }
  if (!itens || !Array.isArray(itens) || itens.length == 0) {
    return res.status(400).json({erro: 'Pedido sem itens'})
  }
  for (var i = 0; i < itens.length; i++) {
    if (!itens[i].produto_id) {
      return res.status(400).json({erro: 'produto_id obrigatorio no item ' + (i + 1)})
    }
    var q = itens[i].quantidade
    if (!Number.isInteger(q) || q <= 0) {
      return res.status(400).json({erro: 'Quantidade invalida no item ' + (i + 1)})
    }
  }

  utils.buscar_cliente(cliente_id, function(err, cliente) {
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

module.exports = router
