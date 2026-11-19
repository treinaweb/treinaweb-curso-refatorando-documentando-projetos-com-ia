/**
 * @file Casos de uso de clientes.
 */
import { NaoEncontrado } from '../domain/erros'
import type { Repositorios } from '../repositories'
import type { Cliente, NovoCliente } from '../repositories/clientes'

/**
 * Cria o service de clientes.
 *
 * @param r Repositories.
 * @returns `listar`, `buscar` e `criar`.
 */
export function criarClientesService(r: Repositorios) {
  return {
    /**
     * Lista todos os clientes ordenados por id.
     *
     * @returns `[{ id, nome, email, cep, tipo }]`.
     */
    async listar(): Promise<Cliente[]> {
      return r.clientes.listar()
    },

    /**
     * Busca um cliente pelo id.
     *
     * @param id Id do cliente (o texto do path, so digitos).
     * @returns O cliente.
     * @throws {NaoEncontrado} `Cliente nao encontrado` (404).
     */
    async buscar(id: string): Promise<Cliente> {
      const cliente = await r.clientes.buscar(id)
      if (!cliente) throw new NaoEncontrado('Cliente nao encontrado')
      return cliente
    },

    /**
     * Cadastra um cliente, sempre com o tipo `comum` (nao ha como mudar o tipo
     * pela API).
     *
     * @param dados Nome, email e CEP ja validados (CEP normalizado pelo schema,
     *   sem hifen).
     * @returns `{ id, nome, email, cep, tipo: 'comum' }`.
     */
    async criar({ nome, email, cep }: NovoCliente): Promise<Cliente> {
      const id = await r.clientes.criar({ nome, email, cep })
      return { id, nome, email, cep, tipo: 'comum' }
    },
  }
}
