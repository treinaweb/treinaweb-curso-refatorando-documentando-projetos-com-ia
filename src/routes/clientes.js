/**
 * @file Rotas de clientes, montadas em `/clientes` (src/app.ts).
 *
 * Erros neste router usam o formato `{ error: '...' }` (diferente do
 * `{ erro: '...' }` do codigo legado).
 */

const express = require('express')
const { validaCep } = require('../utils')

/**
 * Cria o router de clientes sobre a conexao informada.
 *
 * @param {import('sqlite3').Database} db Conexao aberta (`abrirBanco`).
 * @returns {import('express').Router} Router com `GET /`, `GET /:id` e `POST /`.
 */
const createClientesRouter = (db) => {
  const router = express.Router()

  /**
   * `GET /clientes`: lista todos os clientes ordenados por id.
   *
   * - 200: `[{ id, nome, email, cep, tipo }]`
   * - 500: `{ error: 'Erro ao listar clientes' }`
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  function listarClientes(req, res) {
    db.all('SELECT id, nome, email, cep, tipo FROM clientes ORDER BY id', [], (err, rows) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'Erro ao listar clientes' })
      }
      res.json(rows)
    })
  }

  /**
   * `GET /clientes/:id`: detalhe de um cliente.
   *
   * - 200: `{ id, nome, email, cep, tipo }`
   * - 404: `{ error: 'Cliente nao encontrado' }`
   * - 500: `{ error: 'Erro ao buscar cliente' }`
   *
   * @param {import('express').Request} req `req.params.id`: id do cliente.
   * @param {import('express').Response} res
   */
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

  /**
   * `POST /clientes`: cadastra um cliente.
   *
   * Body: `{ nome, email, cep }`. O CEP aceita hifen e e gravado sem ele.
   * O tipo e sempre `comum` (nao ha endpoint para mudar o tipo).
   *
   * - 201: `{ id, nome, email, cep, tipo: 'comum' }`
   * - 400: `{ error: 'Nome e email sao obrigatorios' }` ou `{ error: 'CEP invalido' }`
   * - 500: `{ error: 'Erro ao salvar cliente' }`
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
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

  return router
}

module.exports = createClientesRouter
