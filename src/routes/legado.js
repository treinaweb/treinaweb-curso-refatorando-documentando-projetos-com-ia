/**
 * @file Rotas legadas que ainda nao foram para um router por recurso:
 * produtos, `/frete`, `/pedidos/:id/resumo`, `/relatorios/vendas` e
 * `/pedidos/:id/cancelar`. Vieram de app.js; o bootstrap (middlewares,
 * `/clientes`, `/pedidos`, `listen`) esta em src/app.ts e src/server.ts.
 *
 * Sem autenticacao (uso interno). Erros neste arquivo usam `{ erro: '...' }`.
 */

var express = require('express')
var utils = require('../utils')

/**
 * Cria o router das rotas legadas sobre os repositories e o dominio de precos
 * informados.
 *
 * Os handlers sao `async`; toda chamada a repository fica num `try` que
 * responde a mensagem 500 da rota (sem ele, o Express 5 responderia 500 em
 * HTML).
 *
 * @param {import('../repositories').Repositorios} r Repositories (src/repositories/).
 * @param {Object} v Validadores de entrada (middlewares montados em src/app.ts
 *   a partir de src/http/schemas/).
 * @param {import('express').RequestHandler} v.busca Query de `GET /produtos`
 *   (src/http/schemas/busca.ts; 400 `Busca invalida`).
 * @param {import('express').RequestHandler} v.idProduto `:id` de produto (404 `Produto nao encontrado`).
 * @param {import('express').RequestHandler} v.idPedido `:id` de pedido (404 `Pedido nao encontrado`).
 * @param {import('express').RequestHandler} v.frete Query de `GET /frete`
 *   (src/http/schemas/frete.ts; 400 `CEP invalido` ou `Subtotal invalido`).
 * @param {typeof import('../domain/precos')} precos Dominio de precos
 *   (src/domain/precos/): frete, subtotal, total e as politicas de desconto
 *   `RESUMO` e `RELATORIO`.
 * @returns {import('express').Router} Router montado na raiz por `createApp`.
 */
function createLegadoRouter(r, v, precos) {
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
    router.get('/produtos', v.busca, async function(req, res) {
        var rows
        try {
            rows = await r.produtos.listar(req.query.busca)
        } catch (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar produtos'})
        }
        res.json(rows)
    })

    /**
     * `GET /produtos/:id`: detalhe de um produto.
     *
     * - 200: `{ id, nome, preco, estoque }`
     * - 404: `{ erro: 'Produto nao encontrado' }`
     * - 500: `{ erro: 'Erro ao buscar produto' }`
     */
    router.get('/produtos/:id', v.idProduto, async function(req, res) {
        var row
        try {
            row = await r.produtos.buscar(req.params.id)
        } catch (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao buscar produto'})
        }
        if (!row) {
            return res.status(404).json({erro: 'Produto nao encontrado'})
        }
        res.json(row)
    })

    /**
     * `GET /frete?cep=&subtotal=`: simula o frete (usa `precos.frete`, a mesma
     * regra de `POST /pedidos`).
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
        res.json({cep: cep, subtotal: subtotal, frete: precos.frete(cep, subtotal)})
    })

    /**
     * `GET /pedidos/:id/resumo`: resumo legivel do pedido.
     *
     * Recalcula subtotal e desconto a partir dos itens gravados (nao le
     * `pedidos.desconto`/`pedidos.total`); o frete vem do valor gravado. O
     * desconto usa a politica `precos.RESUMO` (src/domain/precos/descontos.ts).
     *
     * - 200: `{ pedido, cliente, tipo_cliente, itens: ['2x Mouse sem fio - R$ 100.00', ...],
     *   subtotal, desconto, frete, total, status }`
     * - 404: `{ erro: 'Pedido nao encontrado' }`
     * - 500: `{ erro: 'Erro ao gerar resumo' }`
     *
     * @todo Diverge de POST /pedidos: a politica `RESUMO` so da desconto ao
     *   cliente `comum` com subtotal > 500 (la e >= 500). Num pedido `comum` de
     *   exatamente R$ 500,00, o resumo mostra desconto 0 e um total diferente do
     *   cobrado (a confirmar).
     */
    router.get('/pedidos/:id/resumo', v.idPedido, async function(req, res) {
        var ped
        var itens
        try {
            ped = await r.pedidos.buscarParaResumo(req.params.id)
            if (ped) {
                itens = await r.pedidos.itensParaResumo(ped.id)
            }
        } catch (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao gerar resumo'})
        }
        if (!ped) {
            return res.status(404).json({erro: 'Pedido nao encontrado'})
        }
        var linhas = itens.map(function(i) {
            return i.quantidade + 'x ' + i.nome + ' - R$ ' + (i.quantidade * i.preco_unitario).toFixed(2)
        })
        var sub = precos.subtotal(itens)
        var desc = precos.desconto(precos.RESUMO, ped.tipo, sub, precos.quantidadeTotal(itens))
        res.json({
            pedido: ped.id,
            cliente: ped.nome,
            tipo_cliente: ped.tipo,
            itens: linhas,
            subtotal: sub,
            desconto: desc,
            frete: ped.frete,
            total: precos.total(sub, desc, ped.frete),
            status: ped.status
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
     * O desconto usa a politica `precos.RELATORIO`
     * (src/domain/precos/descontos.ts), que so conhece os tipos de
     * `TIPOS_RELATORIO`: um tipo novo nas regras nao tem desconto aqui.
     *
     * @todo Diverge de POST /pedidos: recalcula o desconto em vez de ler
     *   `pedidos.desconto`, e a politica `RELATORIO` arredonda com `Math.round`
     *   para reais inteiros (la sao 2 casas). O faturamento pode nao bater com a
     *   soma de `pedidos.total` (a confirmar).
     */
    router.get('/relatorios/vendas', async function(req, res) {
        var pedidos
        var itensPorPedido = []
        try {
            pedidos = await r.pedidos.listarAtivosComTipo()
            for (var k = 0; k < pedidos.length; k++) {
                itensPorPedido.push(await r.pedidos.itensDe(pedidos[k].id))
            }
        } catch (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao gerar relatorio'})
        }
        if (pedidos.length == 0) {
            return res.json({geral: {pedidos: 0, itens: 0, faturamento: 0}})
        }
        var r2 = {}
        pedidos.forEach(function(p, indice) {
            var itens = itensPorPedido[indice]
            var qtd = 0
            for (var i = 0; i < itens.length; i++) {
                qtd = qtd + itens[i].quantidade
            }
            var d = precos.desconto(precos.RELATORIO, p.tipo, p.subtotal, qtd)
            if (!r2[p.tipo]) {
                r2[p.tipo] = {pedidos: 0, itens: 0, faturamento: 0}
            }
            r2[p.tipo].pedidos++
            r2[p.tipo].itens += qtd
            r2[p.tipo].faturamento += p.subtotal - d + p.frete
        })
        var geral = {pedidos: 0, itens: 0, faturamento: 0}
        for (var t in r2) {
            r2[t].faturamento = precos.arred2(r2[t].faturamento)
            geral.pedidos += r2[t].pedidos
            geral.itens += r2[t].itens
            geral.faturamento += r2[t].faturamento
        }
        geral.faturamento = precos.arred2(geral.faturamento)
        r2.geral = geral
        res.json(r2)
    })

    // TODO: mover o resto pra routes/ depois

    /**
     * `POST /pedidos/:id/cancelar`: cancela um pedido e devolve o estoque.
     *
     * So pedidos com status `criado` podem ser cancelados (`criado` -> `cancelado`).
     * Muda o status e soma de volta ao estoque a quantidade de cada item, numa
     * transacao (`r.pedidos.cancelar`): se qualquer parte falhar, o pedido
     * continua `criado`, o estoque nao muda e a resposta e 500.
     *
     * - 200: `{ id, status: 'cancelado' }`
     * - 400: `{ erro: 'Pedido nao pode ser cancelado (status <status>)' }`
     * - 404: `{ erro: 'Pedido nao encontrado' }`
     * - 500: `{ erro: 'Erro ao cancelar pedido' }`
     */
    router.post('/pedidos/:id/cancelar', v.idPedido, async function(req, res) {
        var p
        try {
            p = await r.pedidos.buscar(req.params.id)
        } catch (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao cancelar pedido'})
        }
        if (!p) {
            return res.status(404).json({erro: 'Pedido nao encontrado'})
        }
        if (p.status != 'criado') {
            return res.status(400).json({erro: 'Pedido nao pode ser cancelado (status ' + p.status + ')'})
        }
        try {
            await r.pedidos.cancelar(p.id)
        } catch (err) {
            console.log(err)
            return res.status(500).json({erro: 'Erro ao cancelar pedido'})
        }
        res.json({id: p.id, status: 'cancelado'})
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
