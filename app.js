var express = require('express')
var db = require('./db')
var descontos = require('./descontos')
var utils = require('./utils')

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

app.get('/frete', function(req, res) {
    var cep = String(req.query.cep || '').replace('-', '')
    var subtotal = parseFloat(req.query.subtotal) || 0
    if (cep.length != 8 || isNaN(cep)) {
        return res.status(400).json({erro: 'CEP invalido'})
    }
    var frete = 0
    if (subtotal <= 300) {
        var faixa = parseInt(cep.substring(0, 1))
        if (faixa <= 3) {
            frete = 15
        } else if (faixa <= 7) {
            frete = 30
        } else {
            frete = 20
        }
    }
    res.json({cep: cep, subtotal: subtotal, frete: frete})
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

app.get('/pedidos/:id/resumo', function(req, res) {
    db.get('SELECT p.*, c.nome, c.tipo FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ' + req.params.id, function(err, ped) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao gerar resumo'})
        }
        if (!ped) {
            return res.status(404).json({erro: 'Pedido nao encontrado'})
        }
        db.all('SELECT i.*, pr.nome FROM itens_pedido i JOIN produtos pr ON pr.id = i.produto_id WHERE i.pedido_id = ?', [ped.id], function(err, itens) {
            if (err) {
                console.log(err)
                return res.status(500).json({erro: 'Erro ao gerar resumo'})
            }
            var sub = 0
            var linhas = []
            itens.forEach(function(i) {
                sub = sub + i.quantidade * i.preco_unitario
                linhas.push(i.quantidade + 'x ' + i.nome + ' - R$ ' + (i.quantidade * i.preco_unitario).toFixed(2))
            })
            sub = Number(sub.toFixed(2))
            var desc = 0
            if (ped.tipo == 'vip') {
                desc = descontos.desconto_vip(sub)
            } else if (ped.tipo == 'comum') {
                if (sub > 500) {
                    desc = Number((sub * 0.05).toFixed(2))
                }
            } else {
                var f = descontos['desconto_' + ped.tipo]
                if (f) {
                    desc = f(sub, itens)
                }
            }
            res.json({
                pedido: ped.id,
                cliente: ped.nome,
                tipo_cliente: ped.tipo,
                itens: linhas,
                subtotal: sub,
                desconto: desc,
                frete: ped.frete,
                total: Number((sub - desc + ped.frete).toFixed(2)),
                status: ped.status
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
