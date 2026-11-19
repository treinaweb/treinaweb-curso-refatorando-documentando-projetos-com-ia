/**
 * @file Repositories da Loja API: o unico lugar (alem do schema em src/db/)
 * com SQL. Montados pelo `createApp` e entregues aos services (src/services/).
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
