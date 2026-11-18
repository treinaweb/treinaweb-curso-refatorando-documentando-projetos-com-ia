/**
 * @file Entrypoint da Loja API (`npm start`, que roda `node dist/server.js`).
 *
 * - Porta: variavel de ambiente `PORTA` (padrao 3000).
 * - Banco: variavel de ambiente `DB_PATH` (padrao `./loja.db`); se o arquivo
 *   nao existe, `abrirBanco` cria o schema e os dados de exemplo.
 *
 * Abre o banco, monta o app com `createApp` e escuta na porta.
 */
import { createApp } from './app'
import { abrirBanco } from './db'

const porta = process.env.PORTA || 3000
const db = abrirBanco(process.env.DB_PATH || './loja.db')

createApp({ db }).listen(porta, () => {
  console.log('Loja rodando na porta ' + porta)
})
