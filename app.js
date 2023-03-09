var express = require('express')
var db = require('./db')

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

app.listen(3000, function() {
    console.log('Loja rodando na porta 3000')
})
