/**
 * @file Montagem do app Express da Loja API.
 *
 * `createApp({ db })` e o unico jeito de montar o app: o banco e injetado por
 * quem chama (src/server.ts em producao, test/helpers.ts nos testes), e nenhum
 * modulo abre conexao sozinho. Aqui se monta a cadeia
 * repositories (src/repositories/, o unico lugar com SQL) -> services
 * (src/services/, os casos de uso) -> routers (src/http/routes/). O dominio
 * (src/domain/) e os schemas (src/http/schemas/) sao puros e importados direto
 * por quem usa. Nao escuta em porta (veja src/server.ts).
 */
import express from 'express'
import type { Banco } from './db'
import { logRequisicao } from './http/middlewares/log'
import { criarClientesRouter } from './http/routes/clientes'
import { criarFreteRouter } from './http/routes/frete'
import { criarPedidosRouter } from './http/routes/pedidos'
import { criarProdutosRouter } from './http/routes/produtos'
import { criarRelatoriosRouter } from './http/routes/relatorios'
import { criarRepositorios } from './repositories'
import { criarServices } from './services'

/** Dependencias de `createApp`. */
export interface AppDeps {
  /** Conexao aberta com `abrirBanco` (src/db). */
  db: Banco
}

/**
 * Cria o app com o banco informado.
 *
 * Fixa o query parser em `extended` e monta, em ordem: `express.json()`, o
 * log de cada requisicao (`<ISO> <METODO> <URL>`) e os routers `/produtos`,
 * `/frete`, `/clientes`, `/pedidos` e `/relatorios`. As rotas e respostas
 * estao documentadas nos routers e no README.
 *
 * Nao ha tratador de erro no nivel do app: cada rota termina com o seu
 * `falhas(...)` (src/http/middlewares/erros.ts), e erros anteriores as rotas
 * (como o JSON malformado) ficam com o tratador padrao do Express.
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
  app.use(logRequisicao)

  const services = criarServices(criarRepositorios(db))
  app.use('/produtos', criarProdutosRouter(services))
  app.use('/frete', criarFreteRouter(services))
  app.use('/clientes', criarClientesRouter(services))
  app.use('/pedidos', criarPedidosRouter(services))
  app.use('/relatorios', criarRelatoriosRouter(services))
  return app
}
