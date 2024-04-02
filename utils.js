var db = require('./db')

function buscar_cliente(id, cb) {
    db.get('SELECT * FROM clientes WHERE id = ' + id, function(err, row) {
        if (err) {
            return cb(err)
        }
        cb(null, row)
    })
}

function validaCep(cep) {
  if (!cep) return null
  const limpo = String(cep).replace('-', '').trim()
  if (limpo.length !== 8 || isNaN(limpo)) return null
  return limpo
}

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

module.exports = {
    buscar_cliente: buscar_cliente,
    validaCep,
    calcula_frete: calcula_frete
}
