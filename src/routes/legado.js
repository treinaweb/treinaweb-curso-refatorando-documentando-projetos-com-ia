/**
 * @file Rotas legadas que ainda nao foram para um router por recurso:
 * produtos, `/frete`, `/pedidos/:id/resumo`, `/relatorios/vendas` e
 * `/pedidos/:id/cancelar`. Vieram de app.js; o bootstrap (middlewares,
 * `/clientes`, `/pedidos`, `listen`) esta em src/app.ts e src/server.ts.
 *
 * Sem autenticacao (uso interno). Erros neste arquivo usam `{ erro: '...' }`.
 */

var express = require('express')
var descontos = require('../descontos')
var utils = require('../utils')

/**
 * Cria o router das rotas legadas sobre a conexao informada.
 *
 * @param {import('sqlite3').Database} db Conexao aberta (`abrirBanco`).
 * @param {Object} v Validadores de entrada (middlewares montados em src/app.ts
 *   a partir de src/http/schemas/).
 * @param {import('express').RequestHandler} v.busca Query de `GET /produtos`
 *   (src/http/schemas/busca.ts; 400 `Busca invalida`).
 * @param {import('express').RequestHandler} v.idProduto `:id` de produto (404 `Produto nao encontrado`).
 * @param {import('express').RequestHandler} v.idPedido `:id` de pedido (404 `Pedido nao encontrado`).
 * @param {import('express').RequestHandler} v.frete Query de `GET /frete`
 *   (src/http/schemas/frete.ts; 400 `CEP invalido` ou `Subtotal invalido`).
 * @returns {import('express').Router} Router montado na raiz por `createApp`.
 */
function createLegadoRouter(db, v) {
    var router = express.Router()

    /**
     * `GET /produtos`: lista os produtos.
     *
     * Query opcional `busca`, validada antes pelo `v.busca`
     * (src/http/schemas/busca.ts): um unico texto. Filtra por
     * `nome LIKE '%' || busca || '%'`, com a busca como parametro: aspas e
     * demais caracteres casam literalmente, e `%` e `_` continuam curingas.
     * Nao diferencia maiusculas de minusculas para letras ASCII. Vazia lista
     * todos.
     *
     * - 200: `[{ id, nome, preco, estoque }]`
     * - 400: `{ erro: 'Busca invalida' }` (busca repetida ou objeto)
     * - 500: `{ erro: 'Erro ao buscar produtos' }`
     */
    router.get('/produtos', v.busca, function(req, res) {
        var sql = 'SELECT * FROM produtos'
        var params = []
        if (req.query.busca) {
            sql = sql + ' WHERE nome LIKE ?'
            params.push('%' + req.query.busca + '%')
        }
        db.all(sql, params, function(err, rows) {
            if (err) {
                console.log(err)
                return res.status(500).json({erro: 'Erro ao buscar produtos'})
            }
            res.json(rows)
        })
    })

    /**
     * `GET /produtos/:id`: detalhe de um produto.
     *
     * - 200: `{ id, nome, preco, estoque }`
     * - 404: `{ erro: 'Produto nao encontrado' }`
     * - 500: `{ erro: 'Erro ao buscar produto' }`
     */
    router.get('/produtos/:id', v.idProduto, function(req, res) {
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

    /**
     * `GET /frete?cep=&subtotal=`: simula o frete (usa `utils.calcula_frete`).
     *
     * E uma simulacao: usa o CEP informado na query, enquanto `POST /pedidos`
     * usa o CEP do cadastro do cliente. A query e validada antes pelo `v.frete`
     * (src/http/schemas/frete.ts): `subtotal` ausente ou vazio vale 0; senao,
     * so digitos com decimal opcional apos ponto.
     *
     * - 200: `{ cep, subtotal, frete }` (cep sem hifen)
     * - 400 (validacao, CEP antes do subtotal): `{ erro: 'CEP invalido' }` ou
     *   `{ erro: 'Subtotal invalido' }`
     */
    router.get('/frete', v.frete, function(req, res) {
        var cep = utils.validaCep(req.query.cep)
        var subtotal = parseFloat(req.query.subtotal) || 0
        res.json({cep: cep, subtotal: subtotal, frete: utils.calcula_frete(cep, subtotal)})
    })

    /**
     * `GET /pedidos/:id/resumo`: resumo legivel do pedido.
     *
     * Recalcula subtotal e desconto a partir dos itens gravados (nao le
     * `pedidos.desconto`/`pedidos.total`); o frete vem do valor gravado.
     * O desconto `vip` e os demais tipos usam descontos.js.
     *
     * - 200: `{ pedido, cliente, tipo_cliente, itens: ['2x Mouse sem fio - R$ 100.00', ...],
     *   subtotal, desconto, frete, total, status }`
     * - 404: `{ erro: 'Pedido nao encontrado' }`
     * - 500: `{ erro: 'Erro ao gerar resumo' }`
     *
     * Atencao: o `id` e concatenado no SQL (codigo legado, nao copie o padrao).
     *
     * @todo Diverge de POST /pedidos: aplica 5% ao cliente `comum` so com
     *   subtotal > 500 (la e >= 500). Num pedido `comum` de exatamente R$ 500,00,
     *   o resumo mostra desconto 0 e um total diferente do cobrado (a confirmar).
     */
    router.get('/pedidos/:id/resumo', v.idPedido, function(req, res) {
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

    /**
     * `GET /relatorios/vendas`: totais de vendas por tipo de cliente, ignorando
     * pedidos cancelados.
     *
     * - 200 (sem pedidos): `{ geral: { pedidos: 0, itens: 0, faturamento: 0 } }`
     * - 200: `{ <tipo>: { pedidos, itens, faturamento }, ..., geral: {...} }`, em
     *   que `itens` e a soma das quantidades e `faturamento` = subtotal - desconto + frete
     * - 500: `{ erro: 'Erro ao gerar relatorio' }`
     *
     * Nao usa descontos.js: tem uma copia propria das regras (vip 10%,
     * comum 5% se >= 500, atacado 15% se quantidade >= 10). Um tipo novo em
     * descontos.js nao tem desconto aqui.
     *
     * @todo Diverge de POST /pedidos: recalcula o desconto em vez de ler
     *   `pedidos.desconto`, arredondando com `Math.round` para reais inteiros
     *   (la sao 2 casas). O faturamento pode nao bater com a soma de `pedidos.total`.
     */
    router.get('/relatorios/vendas', function(req, res) {
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

    /**
     * `POST /pedidos/:id/cancelar`: cancela um pedido e devolve o estoque.
     *
     * So pedidos com status `criado` podem ser cancelados (`criado` -> `cancelado`).
     * Muda o status e soma de volta ao estoque a quantidade de cada item.
     * Sem transacao: os updates de estoque rodam em loop apos o update do status.
     *
     * - 200: `{ id, status: 'cancelado' }`
     * - 400: `{ erro: 'Pedido nao pode ser cancelado (status <status>)' }`
     * - 404: `{ erro: 'Pedido nao encontrado' }`
     * - 500: `{ erro: 'Erro ao cancelar pedido' }`
     */
    router.post('/pedidos/:id/cancelar', v.idPedido, function(req, res) {
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

    // DELETE /pedidos/:id desativado de proposito: pedidos sao cancelados
    // (POST /pedidos/:id/cancelar), nunca excluidos. Nao reative.
    /*
    router.delete('/pedidos/:id', function(req, res) {
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

    return router
}

module.exports = createLegadoRouter
