var express = require('express')
var db = require('./db')
var descontos = require('./descontos')

var app = express()
app.use(express.json())

app.get('/produtos', function(req, res) {
    db.all('SELECT * FROM produtos', function(err, rows) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar produtos'})
        }
        res.json(rows)
    })
})

app.get('/produtos/:id', function(req, res) {
    db.get('SELECT * FROM produtos WHERE id = ?', [req.params.id], function(err, row) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar produto'})
        }
        if (!row) {
            return res.status(404).json({erro: 'Produto nao encontrado'})
        }
        res.json(row)
    })
})

app.get('/clientes', function(req, res) {
    db.all('SELECT * FROM clientes', function(err, rows) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar clientes'})
        }
        res.json(rows)
    })
})

app.get('/clientes/:id', function(req, res) {
    db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id], function(err, row) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar cliente'})
        }
        if (!row) {
            return res.status(404).json({erro: 'Cliente nao encontrado'})
        }
        res.json(row)
    })
})

app.post('/clientes', function(req, res) {
    var nome = req.body.nome
    var email = req.body.email
    var cep = String(req.body.cep || '').replace('-', '')
    if (!nome || !email) {
        return res.status(400).json({erro: 'Nome e email sao obrigatorios'})
    }
    if (cep.length != 8 || isNaN(cep)) {
        return res.status(400).json({erro: 'CEP invalido'})
    }
    db.run('INSERT INTO clientes (nome, email, cep) VALUES (?, ?, ?)', [nome, email, cep], function(err) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao salvar cliente'})
        }
        res.status(201).json({id: this.lastID, nome: nome, email: email, cep: cep, tipo: 'comum'})
    })
})

app.get('/pedidos', function(req, res) {
    db.all('SELECT * FROM pedidos ORDER BY id DESC', function(err, rows) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar pedidos'})
        }
        res.json(rows)
    })
})

app.get('/pedidos/:id', function(req, res) {
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
})

app.post('/pedidos', function(req, res) {
    var cliente_id = req.body.cliente_id
    var itens = req.body.itens
    if (!itens || itens.length == 0) {
        return res.status(400).json({erro: 'Pedido sem itens'})
    }
    db.get('SELECT * FROM clientes WHERE id = ?', [cliente_id], function(err, cliente) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro interno'})
        }
        if (!cliente) {
            return res.status(404).json({erro: 'Cliente nao encontrado'})
        }
        var ids = itens.map(function(i) { return i.produto_id })
        db.all('SELECT * FROM produtos WHERE id IN (' + ids.join(',') + ')', function(err, produtos) {
            if (err) {
                console.log(err)
                return res.status(500).json({erro: 'Erro interno'})
            }
            var subtotal = 0
            for (var i = 0; i < itens.length; i++) {
                var produto = produtos.find(function(p) { return p.id == itens[i].produto_id })
                if (!produto) {
                    return res.status(404).json({erro: 'Produto ' + itens[i].produto_id + ' nao encontrado'})
                }
                if (produto.estoque < itens[i].quantidade) {
                    return res.status(400).json({erro: 'Estoque insuficiente para ' + produto.nome})
                }
                itens[i].preco_unitario = produto.preco
                subtotal = subtotal + produto.preco * itens[i].quantidade
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
            var total = Number((subtotal - desconto).toFixed(2))
            db.run('INSERT INTO pedidos (cliente_id, subtotal, desconto, total, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)', [cliente.id, subtotal, desconto, total, 'criado', new Date().toISOString()], function(err) {
                if (err) {
                    console.log(err)
                    return res.status(500).json({erro: 'Erro ao salvar pedido'})
                }
                var pedido_id = this.lastID
                var feitos = 0
                itens.forEach(function(item) {
                    db.run('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)', [pedido_id, item.produto_id, item.quantidade, item.preco_unitario], function(err) {
                        db.run('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.quantidade, item.produto_id], function(err) {
                            feitos++
                            if (feitos == itens.length) {
                                res.status(201).json({id: pedido_id, subtotal: subtotal, desconto: desconto, total: total, status: 'criado'})
                            }
                        })
                    })
                })
            })
        })
    })
})

app.delete('/pedidos/:id', function(req, res) {
    db.run('DELETE FROM itens_pedido WHERE pedido_id = ?', [req.params.id], function(err) {
        db.run('DELETE FROM pedidos WHERE id = ?', [req.params.id], function(err) {
            if (err) {
                console.log(err)
                return res.status(500).json({erro: 'Erro ao excluir pedido'})
            }
            res.status(204).end()
        })
    })
})

app.listen(3000, function() {
    console.log('Loja rodando na porta 3000')
})
