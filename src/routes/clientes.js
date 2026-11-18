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
 * @param {Object} v Validadores de entrada (middlewares montados em src/app.ts
 *   a partir de src/http/schemas/).
 * @param {import('express').RequestHandler} v.idCliente `:id` de cliente (404 `Cliente nao encontrado`).
 * @param {import('express').RequestHandler} v.criarCliente Corpo de `POST /clientes`
 *   (src/http/schemas/cliente.ts; 400 `{ error }` com a mensagem do primeiro problema).
 * @returns {import('express').Router} Router com `GET /`, `GET /:id` e `POST /`.
 */
const createClientesRouter = (db, v) => {
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
   * Body: `{ nome, email, cep }`, validado antes pelo `v.criarCliente`
   * (src/http/schemas/cliente.ts). O CEP aceita hifen e espacos nas pontas e
   * e gravado sem eles. O tipo e sempre `comum` (nao ha endpoint para mudar o
   * tipo).
   *
   * - 201: `{ id, nome, email, cep, tipo: 'comum' }`
   * - 400 (validacao, so o primeiro problema, na ordem nome, email, cep):
   *   `{ error: 'Nome e email sao obrigatorios' }`, `{ error: 'Nome invalido' }`,
   *   `{ error: 'Email invalido' }` ou `{ error: 'CEP invalido' }`
   * - 500: `{ error: 'Erro ao salvar cliente' }`
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  function criarCliente(req, res) {
    const { nome, email } = req.body
    const cep = validaCep(req.body.cep)
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
  router.get('/:id', v.idCliente, buscarCliente)
  router.post('/', v.criarCliente, criarCliente)

  return router
}

module.exports = createClientesRouter
