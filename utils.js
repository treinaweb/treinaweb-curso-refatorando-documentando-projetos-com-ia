var db = require('./db')

function buscar_cliente(id, cb) {
    db.get('SELECT * FROM clientes WHERE id = ' + id, function(err, row) {
        if (err) {
            return cb(err)
        }
        cb(null, row)
    })
}

module.exports = {
    buscar_cliente: buscar_cliente
}
