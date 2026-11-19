/**
 * @file Repositories da Loja API: o unico lugar (alem do schema em src/db/)
 * com SQL. Montados pelo `createApp` e entregues aos services (src/services/).
 *
 * Cada consulta declara os tipos dos parametros e da linha no generico do
 * `better-sqlite3` (`db.prepare<[parametros], Linha>(sql)`), sem `as`. O tipo da
 * linha nao e conferido em tempo de execucao: quem o garante e o schema de
 * src/db/ (e os tipos de src/domain/tipos.ts precisam acompanha-lo).
 */
import type { Banco } from '../db'
import { criarClientesRepo } from './clientes'
import { criarPedidosRepo } from './pedidos'
import { criarProdutosRepo } from './produtos'

/** Repositories entregues aos services. */
export type Repositorios = ReturnType<typeof criarRepositorios>

/**
 * Cria os repositories sobre a conexao informada.
 *
 * @param db Conexao aberta (`abrirBanco`).
 * @returns `{ produtos, clientes, pedidos }`.
 */
export function criarRepositorios(db: Banco) {
  return {
    produtos: criarProdutosRepo(db),
    clientes: criarClientesRepo(db),
    pedidos: criarPedidosRepo(db),
  }
}
