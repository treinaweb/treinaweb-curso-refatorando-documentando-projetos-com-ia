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
  app.use(createLegadoRouter(db))
  app.use('/clientes', createClientesRouter(db))
  app.use('/pedidos', createPedidosRouter(db))
  return app
}
