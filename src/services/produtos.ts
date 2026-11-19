/**
 * @file Casos de uso de produtos (so leitura).
 */
import { NaoEncontrado } from '../domain/erros'
import type { Repositorios } from '../repositories'
import type { Produto } from '../domain/tipos'

/**
 * Cria o service de produtos.
 *
 * @param r Repositories.
 * @returns `listar` e `buscar`.
 */
export function criarProdutosService(r: Repositorios) {
  return {
    /**
     * Lista os produtos, filtrando pelo nome quando ha busca (`%` e `_`
     * continuam curingas; o resto casa literalmente). Busca vazia lista todos.
     *
     * @param busca Texto da busca (opcional).
     * @returns `[{ id, nome, preco, estoque }]`.
     */
    async listar(busca?: string): Promise<Produto[]> {
      return r.produtos.listar(busca)
    },

    /**
     * Busca um produto pelo id.
     *
     * @param id Id do produto (o texto do path, so digitos).
     * @returns O produto.
     * @throws {NaoEncontrado} `Produto nao encontrado` (404).
     */
    async buscar(id: string): Promise<Produto> {
      const produto = await r.produtos.buscar(id)
      if (!produto) throw new NaoEncontrado('Produto nao encontrado')
      return produto
    },
  }
}
