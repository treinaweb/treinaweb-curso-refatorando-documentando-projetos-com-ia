var express = require('express')
var db = require('./db')
var descontos = require('./descontos')
var utils = require('./utils')

var app = express()
app.use(express.json())
app.use(function(req, res, next) {
    console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url)
    next()
})

app.get('/produtos', function(req, res) {
    var sql = 'SELECT * FROM produtos'
    if (req.query.busca) {
        sql = sql + " WHERE nome LIKE '%" + req.query.busca + "%'"
    }
    db.all(sql, function(err, rows) {
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
    var cep = utils.validaCep(req.query.cep)
    if (!cep) {
        return res.status(400).json({erro: 'CEP invalido'})
    }
    var subtotal = parseFloat(req.query.subtotal) || 0
    res.json({cep: cep, subtotal: subtotal, frete: utils.calcula_frete(cep, subtotal)})
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

app.get('/relatorios/vendas', function(req, res) {
    db.all("SELECT p.*, c.tipo FROM pedidos p, clientes c WHERE c.id = p.cliente_id AND p.status != 'cancelado'", function(err, pedidos) {
        if (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao gerar relatorio'})
        }
        if (pedidos.length == 0) {
            return res.json({geral: {pedidos: 0, itens: 0, faturamento: 0}})
        }
        var r = {}
        var x = 0
        pedidos.forEach(function(p) {
            db.all('SELECT * FROM itens_pedido WHERE pedido_id = ' + p.id, function(err, itens) {
                var qtd = 0
                for (var i = 0; i < itens.length; i++) {
                    qtd = qtd + itens[i].quantidade
                }
                var d = 0
                if (p.tipo == 'vip') {
                    d = Math.round(p.subtotal * 0.1)
                }
                if (p.tipo == 'comum' && p.subtotal >= 500) {
                    d = Math.round(p.subtotal * 0.05)
                }
                if (p.tipo == 'atacado' && qtd >= 10) {
                    d = Math.round(p.subtotal * 0.15)
                }
                if (!r[p.tipo]) {
                    r[p.tipo] = {pedidos: 0, itens: 0, faturamento: 0}
                }
                r[p.tipo].pedidos++
                r[p.tipo].itens += qtd
                r[p.tipo].faturamento += p.subtotal - d + p.frete
                x++
                if (x == pedidos.length) {
                    var geral = {pedidos: 0, itens: 0, faturamento: 0}
                    for (var t in r) {
                        r[t].faturamento = Number(r[t].faturamento.toFixed(2))
                        geral.pedidos += r[t].pedidos
                        geral.itens += r[t].itens
                        geral.faturamento += r[t].faturamento
                    }
                    geral.faturamento = Number(geral.faturamento.toFixed(2))
                    r.geral = geral
                    res.json(r)
                }
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

var porta = process.env.PORTA || 3000
app.listen(porta, function() {
    console.log('Loja rodando na porta ' + porta)
})
