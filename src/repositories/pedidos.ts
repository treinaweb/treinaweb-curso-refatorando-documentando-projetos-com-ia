/**
 * @file Repository de pedidos. Todo SQL parametrizado com `?`.
 *
 * `criar` e `cancelar` sao transacionais (`db.transaction`): ou tudo e
 * gravado, ou nada. As regras (estoque suficiente, status `criado`) e os
 * calculos de preco ficam em quem chama.
 */
import type { Banco } from '../db'

/** Linha de `pedidos`. */
export interface Pedido {
  id: number
  cliente_id: number
  subtotal: number
  desconto: number
  frete: number
  total: number
  status: string
  criado_em: string
}

/** Linha de `itens_pedido`. */
export interface ItemPedido {
  id: number
  pedido_id: number
  produto_id: number
  quantidade: number
  preco_unitario: number
}

/** Item como aparece em `GET /pedidos/:id`. */
export interface ItemDetalhado {
  produto_id: number
  nome: string
  quantidade: number
  preco_unitario: number
}

/** Pedido com o nome e o tipo do cliente (resumo). */
export type PedidoComCliente = Pedido & { nome: string; tipo: string }

/** Item com o nome do produto (resumo). */
export type ItemComNome = ItemPedido & { nome: string }

/** Pedido nao cancelado com o tipo do cliente (relatorio). */
export type PedidoComTipo = Pedido & { tipo: string }

/** Dados de um pedido novo, ja calculados por quem chama. */
export interface NovoPedido {
  cliente_id: number
  subtotal: number
  desconto: number
  frete: number
  total: number
  criado_em: string
  itens: { produto_id: number; quantidade: number; preco_unitario: number }[]
}

/**
 * Cria o repository de pedidos sobre a conexao informada.
 *
 * @param db Conexao aberta (`abrirBanco`).
 * @returns Metodos `async` de leitura e gravacao de pedidos.
 */
export function criarPedidosRepo(db: Banco) {
  /** Grava o pedido, os itens e a baixa de estoque; devolve o id. */
  const gravarPedido = db.transaction((dados: NovoPedido): number => {
    const pedido = db
      .prepare(
        "INSERT INTO pedidos (cliente_id, subtotal, desconto, frete, total, status, criado_em) VALUES (?, ?, ?, ?, ?, 'criado', ?)",
      )
      .run(dados.cliente_id, dados.subtotal, dados.desconto, dados.frete, dados.total, dados.criado_em)
    const pedidoId = Number(pedido.lastInsertRowid)
    const item = db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)')
    const baixa = db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?')
    for (const i of dados.itens) {
      item.run(pedidoId, i.produto_id, i.quantidade, i.preco_unitario)
      baixa.run(i.quantidade, i.produto_id)
    }
    return pedidoId
  })

  /** Muda o status para `cancelado` e devolve o estoque de cada item. */
  const gravarCancelamento = db.transaction((id: number): void => {
    db.prepare("UPDATE pedidos SET status = 'cancelado' WHERE id = ?").run(id)
    const itens = db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ?').all(id) as ItemPedido[]
    const devolucao = db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?')
    for (const i of itens) devolucao.run(i.quantidade, i.produto_id)
  })

  return {
    /**
     * Busca um pedido pelo id, com os valores gravados.
     *
     * @param id Id do pedido (o texto do path ou um numero).
     * @returns O pedido, ou `undefined` se nao existir.
     */
    async buscar(id: number | string): Promise<Pedido | undefined> {
      return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as Pedido | undefined
    },

    /**
     * Itens de um pedido como em `GET /pedidos/:id`.
     *
     * @param id Id do pedido.
     * @returns `[{ produto_id, nome, quantidade, preco_unitario }]`.
     */
    async itensDoPedido(id: number): Promise<ItemDetalhado[]> {
      return db
        .prepare(
          'SELECT i.produto_id, p.nome, i.quantidade, i.preco_unitario FROM itens_pedido i JOIN produtos p ON p.id = i.produto_id WHERE i.pedido_id = ?',
        )
        .all(id) as ItemDetalhado[]
    },

    /**
     * Pedido com o nome e o tipo do cliente, para o resumo.
     *
     * @param id Id do pedido (o texto do path).
     * @returns O pedido, ou `undefined` se nao existir.
     */
    async buscarParaResumo(id: number | string): Promise<PedidoComCliente | undefined> {
      return db
        .prepare('SELECT p.*, c.nome, c.tipo FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ?')
        .get(id) as PedidoComCliente | undefined
    },

    /**
     * Itens de um pedido com o nome do produto, para o resumo.
     *
     * @param id Id do pedido.
     * @returns Os itens.
     */
    async itensParaResumo(id: number): Promise<ItemComNome[]> {
      return db
        .prepare('SELECT i.*, pr.nome FROM itens_pedido i JOIN produtos pr ON pr.id = i.produto_id WHERE i.pedido_id = ?')
        .all(id) as ItemComNome[]
    },

    /**
     * Pedidos nao cancelados com o tipo do cliente, para o relatorio.
     *
     * @returns Os pedidos.
     */
    async listarAtivosComTipo(): Promise<PedidoComTipo[]> {
      return db
        .prepare("SELECT p.*, c.tipo FROM pedidos p, clientes c WHERE c.id = p.cliente_id AND p.status != 'cancelado'")
        .all() as PedidoComTipo[]
    },

    /**
     * Itens gravados de um pedido.
     *
     * @param id Id do pedido.
     * @returns Os itens.
     */
    async itensDe(id: number): Promise<ItemPedido[]> {
      return db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ?').all(id) as ItemPedido[]
    },

    /**
     * Grava um pedido com status `criado`, os itens e a baixa de estoque, numa
     * transacao: se qualquer parte falhar, nada fica gravado e a promise e
     * rejeitada com o erro do banco.
     *
     * @param dados Valores ja calculados e itens com o preco unitario copiado.
     * @returns O id do pedido criado.
     */
    async criar(dados: NovoPedido): Promise<number> {
      return gravarPedido(dados)
    },

    /**
     * Cancela um pedido e devolve o estoque de cada item, numa transacao: se
     * qualquer parte falhar, o status e o estoque ficam como estavam e a
     * promise e rejeitada. Quem chama confere antes se o status e `criado`.
     *
     * @param id Id do pedido.
     */
    async cancelar(id: number): Promise<void> {
      gravarCancelamento(id)
    },
  }
}
