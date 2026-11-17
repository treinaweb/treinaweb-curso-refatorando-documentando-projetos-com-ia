/**
 * @file Utilitarios compartilhados: busca de cliente, validacao de CEP,
 * calculo de frete e formatacao de moeda.
 */

var db = require('./db')

/**
 * @callback BuscarClienteCallback
 * @param {Error|null} err Erro do SQLite, ou `null`.
 * @param {Object} [cliente] Linha completa de `clientes` (`id`, `nome`, `email`,
 *   `cep`, `tipo`), ou `undefined` se nao existir.
 */

/**
 * Busca um cliente pelo id (todas as colunas).
 *
 * Atencao: o `id` e concatenado direto no SQL (codigo legado, nao copie o
 * padrao). Quem chama deve garantir que e um valor numerico.
 *
 * @param {number|string} id Id do cliente.
 * @param {BuscarClienteCallback} cb Chamado com `(err, cliente)`.
 * @returns {void}
 */
function buscar_cliente(id, cb) {
    db.get('SELECT * FROM clientes WHERE id = ' + id, function(err, row) {
        if (err) {
            return cb(err)
        }
        cb(null, row)
    })
}

/**
 * Valida e normaliza um CEP: 8 digitos, com hifen opcional.
 *
 * @example validaCep('01310-100') // '01310100'
 * @example validaCep('123')       // null
 * @param {*} cep Valor recebido (string ou numero).
 * @returns {string|null} O CEP sem hifen, ou `null` se for invalido ou vazio.
 */
function validaCep(cep) {
  if (!cep) return null
  const limpo = String(cep).replace('-', '').trim()
  if (limpo.length !== 8 || isNaN(limpo)) return null
  return limpo
}

/**
 * Calcula o frete a partir do CEP e do subtotal (antes do desconto).
 *
 * - subtotal >= R$ 300: gratis (0);
 * - senao, pelo 1o digito do CEP: 0-3 -> R$ 15, 4-7 -> R$ 30, 8-9 -> R$ 20.
 *
 * Usado hoje so por `GET /frete` (simulacao).
 *
 * @todo Diverge de POST /pedidos: a regra de frete esta duplicada inline em
 *   routes/pedidos.js (que e a que grava o valor cobrado). Hoje as duas copias
 *   produzem o mesmo resultado; ao mudar uma, alinhe a outra.
 * @param {string} cep CEP ja normalizado (8 digitos, sem hifen).
 * @param {number} subtotal Subtotal dos itens em reais, antes do desconto.
 * @returns {number} Valor do frete em reais.
 */
function calcula_frete(cep, subtotal) {
    if (subtotal >= 300) {
        return 0
    }
    var faixa = parseInt(cep.substring(0, 1))
    if (faixa <= 3) {
        return 15
    }
    if (faixa <= 7) {
        return 30
    }
    return 20
}

/**
 * Formata um valor em reais no padrao brasileiro (sem separador de milhar).
 *
 * Sem uso no codigo atual (exportada, mas nenhuma rota a chama).
 *
 * @example formata_moeda(1234.5) // 'R$ 1234,50'
 * @param {number|string} valor Valor em reais.
 * @returns {string} Texto no formato `R$ 0,00`.
 */
function formata_moeda(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',')
}

module.exports = {
    buscar_cliente: buscar_cliente,
    validaCep,
    calcula_frete: calcula_frete,
    formata_moeda: formata_moeda
}
