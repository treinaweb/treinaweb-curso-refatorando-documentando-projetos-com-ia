/**
 * @file Casos de uso de pedidos: criar, buscar, resumo e cancelar.
 *
 * A criacao e a fonte canonica das regras de preco (politica `PEDIDO` de
 * src/domain/precos/): os valores calculados aqui sao os gravados.
 */
import { EstoqueInsuficiente, NaoEncontrado, TransicaoInvalida } from '../domain/erros'
import { podeCancelar } from '../domain/pedido'
import * as precos from '../domain/precos'
import type { Repositorios } from '../repositories'
import type { ItemComNome, ItemDetalhado, Pedido, PedidoComCliente } from '../repositories/pedidos'
import type { Produto } from '../repositories/produtos'
import { FalhaDoBanco } from './erros'

/** Item pedido no corpo de `POST /pedidos` (ja validado). */
export interface ItemSolicitado {
  produto_id: number
  quantidade: number
}

/** Pedido a criar (ja validado). */
export interface PedidoSolicitado {
  cliente_id: number
  itens: ItemSolicitado[]
}

/** Pedido criado, como a resposta 201 de `POST /pedidos`. */
export interface PedidoCriado {
  id: number
  cliente_id: number
  subtotal: number
  desconto: number
  frete: number
  total: number
  status: 'criado'
}

/** Pedido gravado com os itens, como em `GET /pedidos/:id`. */
export type PedidoComItens = Pedido & { itens: ItemDetalhado[] }

/** Dados do resumo do pedido, antes da apresentacao. */
export interface ResumoPedido {
  /** Pedido com o nome e o tipo do cliente. */
  pedido: PedidoComCliente
  /** Itens gravados com o nome do produto. */
  itens: ItemComNome[]
  /** Subtotal recalculado dos itens gravados. */
  subtotal: number
  /** Desconto pela politica `RESUMO`. */
  desconto: number
  /** `subtotal - desconto + frete gravado`. */
  total: number
}

/** Pedido cancelado, como a resposta 200 de `POST /pedidos/:id/cancelar`. */
export interface PedidoCancelado {
  id: number
  status: 'cancelado'
}

/**
 * Cria o service de pedidos.
 *
 * @param r Repositories.
 * @returns `criar`, `buscar`, `resumo` e `cancelar`.
 */
export function criarPedidosService(r: Repositorios) {
  return {
    /**
     * Cria um pedido, na ordem (que e contrato):
     * 1. le o cliente; inexistente -> `NaoEncontrado('Cliente nao encontrado')`;
     * 2. le os produtos dos itens (so se o cliente existe);
     * 3. confere item a item, na ordem do corpo, e o primeiro problema vence:
     *    produto inexistente -> `NaoEncontrado('Produto <id> nao encontrado')`;
     *    estoque menor que a quantidade -> `EstoqueInsuficiente`;
     * 4. copia o preco atual de cada produto para o item e calcula subtotal,
     *    desconto (politica `PEDIDO`, pelo tipo do cliente), frete (subtotal
     *    ANTES do desconto, CEP do cadastro do cliente) e total;
     * 5. grava pedido, itens e baixa de estoque numa transacao.
     *
     * O estoque e conferido por item, sem somar itens do mesmo produto.
     *
     * @param solicitado Cliente e itens ja validados.
     * @returns O pedido criado, com status `criado`.
     * @throws {NaoEncontrado} Cliente ou produto inexistente (404).
     * @throws {EstoqueInsuficiente} `Estoque insuficiente para <produto>` (400).
     * @throws {FalhaDoBanco} Fase `gravacao`, se a gravacao falhar (nada fica
     *   gravado). Falhas na leitura seguem cruas (mensagem padrao da rota).
     */
    async criar({ cliente_id, itens }: PedidoSolicitado): Promise<PedidoCriado> {
      const inicio = Date.now()
      const cliente = await r.clientes.buscarCompleto(cliente_id)
      if (!cliente) throw new NaoEncontrado('Cliente nao encontrado')
      const produtos = await r.produtos.buscarVarios(itens.map((item) => item.produto_id))

      const porId = new Map<number, Produto>(produtos.map((produto) => [produto.id, produto]))
      const comPreco = itens.map((item) => {
        const produto = porId.get(item.produto_id)
        if (!produto) throw new NaoEncontrado('Produto ' + item.produto_id + ' nao encontrado')
        if (produto.estoque < item.quantidade) throw new EstoqueInsuficiente('Estoque insuficiente para ' + produto.nome)
        return { produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario: produto.preco }
      })

      const subtotal = precos.subtotal(comPreco)
      const desconto = precos.desconto(precos.PEDIDO, cliente.tipo, subtotal, precos.quantidadeTotal(comPreco))
      // nao mexer: frete gratis olha o subtotal, combinado com o comercial
      const frete = precos.frete(cliente.cep, subtotal)
      const total = precos.total(subtotal, desconto, frete)

      let id: number
      try {
        id = await r.pedidos.criar({
          cliente_id: cliente.id,
          subtotal,
          desconto,
          frete,
          total,
          criado_em: new Date().toISOString(),
          itens: comPreco,
        })
      } catch (erro) {
        throw new FalhaDoBanco('gravacao', erro)
      }
      console.log('pedido ' + id + ' (' + cliente.tipo + ') em ' + (Date.now() - inicio) + 'ms')
      return { id, cliente_id: cliente.id, subtotal, desconto, frete, total, status: 'criado' }
    },

    /**
     * Busca um pedido com os itens, com os valores gravados na criacao (nao
     * recalcula nada).
     *
     * @param id Id do pedido (o texto do path, so digitos).
     * @returns As colunas do pedido e, por ultimo, `itens`.
     * @throws {NaoEncontrado} `Pedido nao encontrado` (404).
     * @throws {FalhaDoBanco} Fase `itens`, se so a leitura dos itens falhar.
     */
    async buscar(id: string): Promise<PedidoComItens> {
      const pedido = await r.pedidos.buscar(id)
      if (!pedido) throw new NaoEncontrado('Pedido nao encontrado')
      let itens: ItemDetalhado[]
      try {
        itens = await r.pedidos.itensDoPedido(pedido.id)
      } catch (erro) {
        throw new FalhaDoBanco('itens', erro)
      }
      return { ...pedido, itens }
    },

    /**
     * Dados do resumo: recalcula subtotal e desconto a partir dos itens
     * gravados (nao le `pedidos.desconto`/`pedidos.total`); o frete e o
     * gravado. O desconto usa a politica `precos.RESUMO`.
     *
     * @todo Diverge de POST /pedidos: a politica `RESUMO` so da desconto ao
     *   cliente `comum` com subtotal > 500 (la e >= 500). Num pedido `comum` de
     *   exatamente R$ 500,00, o resumo mostra desconto 0 e um total diferente do
     *   cobrado (a confirmar).
     * @param id Id do pedido (o texto do path, so digitos).
     * @returns Pedido, itens, subtotal, desconto e total.
     * @throws {NaoEncontrado} `Pedido nao encontrado` (404).
     */
    async resumo(id: string): Promise<ResumoPedido> {
      const pedido = await r.pedidos.buscarParaResumo(id)
      if (!pedido) throw new NaoEncontrado('Pedido nao encontrado')
      const itens = await r.pedidos.itensParaResumo(pedido.id)
      const subtotal = precos.subtotal(itens)
      const desconto = precos.desconto(precos.RESUMO, pedido.tipo, subtotal, precos.quantidadeTotal(itens))
      return { pedido, itens, subtotal, desconto, total: precos.total(subtotal, desconto, pedido.frete) }
    },

    /**
     * Cancela um pedido e devolve o estoque, numa transacao: se qualquer parte
     * falhar, o pedido continua `criado` e o estoque nao muda.
     *
     * @param id Id do pedido (o texto do path, so digitos).
     * @returns `{ id, status: 'cancelado' }`.
     * @throws {NaoEncontrado} `Pedido nao encontrado` (404).
     * @throws {TransicaoInvalida} `Pedido nao pode ser cancelado (status <status>)`
     *   (400), se o status nao for `criado`.
     */
    async cancelar(id: string): Promise<PedidoCancelado> {
      const pedido = await r.pedidos.buscar(id)
      if (!pedido) throw new NaoEncontrado('Pedido nao encontrado')
      if (!podeCancelar(pedido.status)) {
        throw new TransicaoInvalida('Pedido nao pode ser cancelado (status ' + pedido.status + ')')
      }
      await r.pedidos.cancelar(pedido.id)
      return { id: pedido.id, status: 'cancelado' }
    },
  }
}
