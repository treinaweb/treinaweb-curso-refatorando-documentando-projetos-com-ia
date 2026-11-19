/**
 * @file Erros de dominio lancados pelos services (src/services/).
 *
 * Nao conhecem HTTP: carregam so a mensagem, que e a resposta da API. O
 * tratador de erros da camada HTTP (src/http/middlewares/erros.ts) converte
 * cada classe no status da resposta e usa o formato de erro da rota.
 */

/** Base dos erros de dominio: a mensagem e a da resposta da API. */
export class ErroDeDominio extends Error {
  /**
   * @param mensagem Mensagem da resposta (sem acentos, como as demais).
   */
  constructor(mensagem: string) {
    super(mensagem)
    this.name = new.target.name
  }
}

/**
 * Registro inexistente (respondido com 404), por exemplo
 * `Pedido nao encontrado` ou `Produto 5 nao encontrado`.
 */
export class NaoEncontrado extends ErroDeDominio {}

/**
 * Produto sem estoque para a quantidade pedida (respondido com 400):
 * `Estoque insuficiente para <produto>`.
 */
export class EstoqueInsuficiente extends ErroDeDominio {}

/**
 * Transicao do ciclo de vida do pedido que nao e permitida (respondido com
 * 400): `Pedido nao pode ser cancelado (status <status>)`.
 */
export class TransicaoInvalida extends ErroDeDominio {}
