const express = require('express')
const db = require('../db')
const { validaCep } = require('../utils')

const router = express.Router()

function listarClientes(req, res) {
  db.all('SELECT id, nome, email, cep, tipo FROM clientes ORDER BY id', [], (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Erro ao listar clientes' })
    }
    res.json(rows)
  })
}

function buscarCliente(req, res) {
  db.get('SELECT id, nome, email, cep, tipo FROM clientes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Erro ao buscar cliente' })
    }
    if (!row) {
      return res.status(404).json({ error: 'Cliente nao encontrado' })
    }
    res.json(row)
  })
}

function criarCliente(req, res) {
  const { nome, email } = req.body
  const cep = validaCep(req.body.cep)
  if (!nome || !email) {
    return res.status(400).json({ error: 'Nome e email sao obrigatorios' })
  }
  if (!cep) {
    return res.status(400).json({ error: 'CEP invalido' })
  }
  const sql = 'INSERT INTO clientes (nome, email, cep, tipo) VALUES (?, ?, ?, ?)'
  db.run(sql, [nome, email, cep, 'comum'], function (err) {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Erro ao salvar cliente' })
    }
    res.status(201).json({ id: this.lastID, nome, email, cep, tipo: 'comum' })
  })
}

router.get('/', listarClientes)
router.get('/:id', buscarCliente)
router.post('/', criarCliente)

module.exports = router
