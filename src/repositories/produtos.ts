/**
 * @file Repository de produtos. Todo SQL parametrizado com `?`, com os
 * tipos dos parametros e da linha no generico do `prepare` (veja index.ts).
 */
import type { Banco } from '../db'
import type { Produto } from '../domain/tipos'

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
        return db.prepare<[string], Produto>('SELECT * FROM produtos WHERE nome LIKE ?').all('%' + busca + '%')
      }
      return db.prepare<[], Produto>('SELECT * FROM produtos').all()
    },

    /**
     * Busca um produto pelo id.
     *
     * @param id Id do produto (o texto do path ou um numero).
     * @returns O produto, ou `undefined` se nao existir.
     */
    async buscar(id: number | string): Promise<Produto | undefined> {
      return db.prepare<[number | string], Produto>('SELECT * FROM produtos WHERE id = ?').get(id)
    },

    /**
     * Busca varios produtos pelos ids (`IN (?, ?, ...)`).
     *
     * @param ids Ids dos produtos (pode repetir).
     * @returns Os produtos encontrados, sem repeticao e em qualquer ordem.
     */
    async buscarVarios(ids: number[]): Promise<Produto[]> {
      const marcadores = ids.map(() => '?').join(', ')
      return db.prepare<number[], Produto>(`SELECT * FROM produtos WHERE id IN (${marcadores})`).all(...ids)
    },
  }
}
