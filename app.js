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

app.use('/clientes', require('./routes/clientes'))
app.use('/pedidos', require('./routes/pedidos'))

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

// TODO: mover o resto pra routes/ depois

app.post('/pedidos/:id/cancelar', function(req, res) {
    db.get('SELECT * FROM pedidos WHERE id = ?', [req.params.id], function(err, p) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao cancelar pedido'})
        }
        if (!p) {
            return res.status(404).json({erro: 'Pedido nao encontrado'})
        }
        if (p.status != 'criado') {
            return res.status(400).json({erro: 'Pedido nao pode ser cancelado (status ' + p.status + ')'})
        }
        db.run("UPDATE pedidos SET status = 'cancelado' WHERE id = ?", [p.id], function(err) {
            if (err) {
                console.log(err)
                return res.status(500).json({erro: 'Erro ao cancelar pedido'})
            }
            db.all('SELECT * FROM itens_pedido WHERE pedido_id = ?', [p.id], function(err, itens) {
                var n = 0
                itens.forEach(function(it) {
                    db.run('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [it.quantidade, it.produto_id], function() {
                        n++
                        if (n == itens.length) {
                            res.json({id: p.id, status: 'cancelado'})
                        }
                    })
                })
            })
        })
    })
})

/*
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
*/

app.listen(3000, function() {
    console.log('Loja rodando na porta 3000')
})
