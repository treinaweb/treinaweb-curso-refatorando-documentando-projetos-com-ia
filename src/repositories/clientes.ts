/**
 * @file Repository de clientes. Todo SQL parametrizado com `?`.
 */
import type { Banco } from '../db'

/** Linha de `clientes`. */
export interface Cliente {
  id: number
  nome: string
  email: string
  cep: string
  tipo: string
}

/** Dados de um cliente novo (o tipo e sempre `comum`). */
export interface NovoCliente {
  nome: string
  email: string
  cep: string
}

/** Colunas publicas devolvidas por `/clientes`. */
const COLUNAS = 'id, nome, email, cep, tipo'

/**
 * Cria o repository de clientes sobre a conexao informada.
 *
 * @param db Conexao aberta (`abrirBanco`).
 * @returns Metodos `async` de leitura e gravacao de clientes.
 */
export function criarClientesRepo(db: Banco) {
  return {
    /**
     * Lista os clientes ordenados por id.
     *
     * @returns Os clientes.
     */
    async listar(): Promise<Cliente[]> {
      return db.prepare(`SELECT ${COLUNAS} FROM clientes ORDER BY id`).all() as Cliente[]
    },

    /**
     * Busca um cliente pelo id (colunas publicas).
     *
     * @param id Id do cliente (o texto do path ou um numero).
     * @returns O cliente, ou `undefined` se nao existir.
     */
    async buscar(id: number | string): Promise<Cliente | undefined> {
      return db.prepare(`SELECT ${COLUNAS} FROM clientes WHERE id = ?`).get(id) as Cliente | undefined
    },

    /**
     * Busca um cliente pelo id com todas as colunas (usado na criacao do pedido).
     *
     * @param id Id do cliente.
     * @returns O cliente, ou `undefined` se nao existir.
     */
    async buscarCompleto(id: number): Promise<Cliente | undefined> {
      return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Cliente | undefined
    },

    /**
     * Cadastra um cliente com o tipo `comum`.
     *
     * @param cliente Nome, email e CEP ja normalizado (sem hifen).
     * @returns O id do cliente criado.
     */
    async criar({ nome, email, cep }: NovoCliente): Promise<number> {
      const resultado = db
        .prepare('INSERT INTO clientes (nome, email, cep, tipo) VALUES (?, ?, ?, ?)')
        .run(nome, email, cep, 'comum')
      return Number(resultado.lastInsertRowid)
    },
  }
}
