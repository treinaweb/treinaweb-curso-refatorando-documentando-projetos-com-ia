/**
 * @file Montagem do app Express da Loja API.
 *
 * `createApp({ db })` e o unico jeito de montar o app: o banco e injetado por
 * quem chama (src/server.ts em producao, test/helpers.ts nos testes), e nenhum
 * modulo abre conexao sozinho. Os repositories (src/repositories/, o unico
 * lugar com SQL) sao criados aqui e injetados nas factories dos routers, assim
 * como o dominio de precos (src/domain/precos/, o unico lugar com regras de
 * preco). Nao escuta em porta (veja src/server.ts).
 */
import express, { type NextFunction, type Request, type Response } from 'express'
import type { Banco } from './db'
import { criarRepositorios } from './repositories'
import * as precos from './domain/precos'
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
  db: Banco
}

/**
 * Cria o app com o banco informado.
 *
 * Fixa o query parser em `extended` e monta, em ordem: `express.json()`, o
 * log de cada requisicao no console
 * (`<ISO> <METODO> <URL>`), as rotas legadas (produtos, `/frete`, resumo,
 * relatorio e cancelamento, em src/routes/legado.js), `/clientes` e
 * `/pedidos`. As rotas e respostas estao documentadas nos routers e no README.
 *
 * Os validadores de entrada (src/http/) sao montados aqui e injetados nas
 * factories junto com os repositories: um id no path que nao e so digitos
 * responde o 404 da propria rota. As factories que calculam preco (legado e
 * pedidos) recebem tambem o dominio de precos, como terceiro argumento.
 *
 * @param deps Dependencias do app (veja {@link AppDeps}).
 * @returns O app Express, pronto para `listen` ou para o supertest.
 */
export function createApp({ db }: AppDeps): express.Express {
  const app = express()
  // Query parser `extended` (qs), o padrao do Express 4. O padrao do Express 5
  // (`simple`, node:querystring) nao entende colchetes: `?busca[x]=cabo` viraria
  // a chave literal `busca[x]` e a rota devolveria todos os produtos, em vez do
  // `400 Busca invalida` do spec validacao-entrada. Nao remova sem uma change
  // de contrato.
  app.set('query parser', 'extended')
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

  const r = criarRepositorios(db)
  app.use(createLegadoRouter(r, { busca, idProduto, idPedido, frete }, precos))
  app.use('/clientes', createClientesRouter(r, { idCliente, criarCliente }))
  app.use('/pedidos', createPedidosRouter(r, { idPedido, criarPedido }, precos))
  return app
}
