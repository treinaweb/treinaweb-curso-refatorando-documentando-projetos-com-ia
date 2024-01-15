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

module.exports = {
    buscar_cliente: buscar_cliente,
    validaCep
}
