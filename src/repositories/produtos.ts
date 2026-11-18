/**
 * @file Repository de produtos. Todo SQL parametrizado com `?`.
 */
import type { Banco } from '../db'

/** Linha de `produtos`. */
export interface Produto {
  id: number
  nome: string
  preco: number
  estoque: number
}

/**
 * Cria o repository de produtos sobre a conexao informada.
 *
 * @param db Conexao aberta (`abrirBanco`).
 * @returns Metodos `async` de leitura de produtos.
 */
export function criarProdutosRepo(db: Banco) {
  return {
    /**
     * Lista os produtos, na ordem de gravacao (sem `ORDER BY`, como sempre foi).
     *
     * @param busca Trecho do nome, usado como parametro de `LIKE '%' || busca || '%'`
     *   (`%` e `_` continuam curingas). Vazio ou ausente lista todos.
     * @returns Os produtos.
     */
    async listar(busca?: string): Promise<Produto[]> {
      if (busca) {
        return db.prepare('SELECT * FROM produtos WHERE nome LIKE ?').all('%' + busca + '%') as Produto[]
      }
      return db.prepare('SELECT * FROM produtos').all() as Produto[]
    },

    /**
     * Busca um produto pelo id.
     *
     * @param id Id do produto (o texto do path ou um numero).
     * @returns O produto, ou `undefined` se nao existir.
     */
    async buscar(id: number | string): Promise<Produto | undefined> {
      return db.prepare('SELECT * FROM produtos WHERE id = ?').get(id) as Produto | undefined
    },

    /**
     * Busca varios produtos pelos ids (`IN (?, ?, ...)`).
     *
     * @param ids Ids dos produtos (pode repetir).
     * @returns Os produtos encontrados, sem repeticao e em qualquer ordem.
     */
    async buscarVarios(ids: number[]): Promise<Produto[]> {
      const marcadores = ids.map(() => '?').join(', ')
      return db.prepare(`SELECT * FROM produtos WHERE id IN (${marcadores})`).all(...ids) as Produto[]
    },
  }
}
