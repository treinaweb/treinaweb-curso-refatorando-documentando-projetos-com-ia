/**
 * @file Tipos de dominio compartilhados pelas camadas (repositories, services
 * e HTTP). Descrevem as linhas das tabelas (schema em src/db/).
 *
 * `tipo` do cliente e `status` do pedido sao `string`: o banco aceita qualquer
 * texto e as regras dependem disso (tipo sem regra nao tem desconto; a politica
 * `RELATORIO` so conhece os tipos de `TIPOS_RELATORIO`). Os tipos de consulta
 * (por exemplo, pedido com o nome do cliente) ficam nos repositories.
 */

/**
 * Tipos de cliente com regra de desconto. So confere os literais de `REGRAS`
 * e de `TIPOS_RELATORIO` (src/domain/precos/descontos.ts); o `tipo` lido do
 * banco continua `string`.
 */
export type TipoConhecido = 'comum' | 'vip' | 'atacado'

/** Produto (linha de `produtos`). */
export interface Produto {
  id: number
  nome: string
  /** Preco atual, em reais. */
  preco: number
  estoque: number
}

/** Cliente (linha de `clientes`). */
export interface Cliente {
  id: number
  nome: string
  email: string
  /** CEP sem hifen (8 digitos). */
  cep: string
  /** Tipo do cliente; os de {@link TipoConhecido} tem regra de desconto. */
  tipo: string
}

/** Pedido (linha de `pedidos`), com os valores gravados na criacao. */
export interface Pedido {
  id: number
  cliente_id: number
  subtotal: number
  desconto: number
  frete: number
  total: number
  /** `criado` ou `cancelado` (veja src/domain/pedido.ts). */
  status: string
  /** Data de criacao em ISO 8601. */
  criado_em: string
}

/** Item de um pedido (linha de `itens_pedido`). */
export interface ItemPedido {
  id: number
  pedido_id: number
  produto_id: number
  quantidade: number
  /** Preco do produto copiado na criacao do pedido, em reais. */
  preco_unitario: number
}
