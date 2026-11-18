/**
 * @file Montagem do app Express da Loja API.
 *
 * `createApp({ db })` e o unico jeito de montar o app: o banco e injetado por
 * quem chama (src/server.ts em producao, test/helpers.ts nos testes), e nenhum
 * modulo abre conexao sozinho. Nao escuta em porta (veja src/server.ts).
 */
import express, { type NextFunction, type Request, type Response } from 'express'
import type { Database } from 'sqlite3'
import createClientesRouter = require('./routes/clientes')
import createLegadoRouter = require('./routes/legado')
import createPedidosRouter = require('./routes/pedidos')
import { validar } from './http/middlewares/validar'
import { buscaSchema } from './http/schemas/busca'
import { idSchema } from './http/schemas/id'
import { criarClienteSchema } from './http/schemas/cliente'
import { freteSchema } from './http/schemas/frete'
import { criarPedidoSchema } from './http/schemas/pedido'

/** Dependencias de `createApp`. */
export interface AppDeps {
  /** Conexao aberta com `abrirBanco` (src/db). */
  db: Database
}

/**
 * Cria o app com o banco informado.
 *
 * Monta, em ordem: `express.json()`, o log de cada requisicao no console
 * (`<ISO> <METODO> <URL>`), as rotas legadas (produtos, `/frete`, resumo,
 * relatorio e cancelamento, em src/routes/legado.js), `/clientes` e
 * `/pedidos`. As rotas e respostas estao documentadas nos routers e no README.
 *
 * Os validadores de entrada (src/http/) sao montados aqui e injetados nas
 * factories junto com o `db`: um id no path que nao e so digitos responde o
 * 404 da propria rota.
 *
 * @param deps Dependencias do app (veja {@link AppDeps}).
 * @returns O app Express, pronto para `listen` ou para o supertest.
 */
export function createApp({ db }: AppDeps): express.Express {
  const app = express()
  app.use(express.json())
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url)
    next()
  })
  const idPedido = validar({ schema: idSchema, origem: 'params', formato: 'erro', status: 404, mensagem: 'Pedido nao encontrado' })
  const idProduto = validar({ schema: idSchema, origem: 'params', formato: 'erro', status: 404, mensagem: 'Produto nao encontrado' })
  const idCliente = validar({ schema: idSchema, origem: 'params', formato: 'error', status: 404, mensagem: 'Cliente nao encontrado' })
  const criarPedido = validar({ schema: criarPedidoSchema, origem: 'body', formato: 'erro' })
  const criarCliente = validar({ schema: criarClienteSchema, origem: 'body', formato: 'error' })
  const frete = validar({ schema: freteSchema, origem: 'query', formato: 'erro' })
  const busca = validar({ schema: buscaSchema, origem: 'query', formato: 'erro' })

  app.use(createLegadoRouter(db, { busca, idProduto, idPedido, frete }))
  app.use('/clientes', createClientesRouter(db, { idCliente, criarCliente }))
  app.use('/pedidos', createPedidosRouter(db, { idPedido, criarPedido }))
  return app
}
