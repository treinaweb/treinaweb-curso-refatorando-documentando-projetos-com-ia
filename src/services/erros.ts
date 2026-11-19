/**
 * @file Erros dos services que nao sao de dominio.
 */

/**
 * Falha do banco numa fase com nome de um caso de uso. Usada so quando a rota
 * tem mais de uma mensagem 500 (por exemplo, `itens` em `GET /pedidos/:id` e
 * `gravacao` em `POST /pedidos`): a rota escolhe a mensagem pela fase. Nas
 * demais, o erro do repository segue cru e a rota usa a mensagem padrao.
 */
export class FalhaDoBanco extends Error {
  /** Nome da fase que falhou (chave do mapa de mensagens 500 da rota). */
  readonly fase: string

  /**
   * @param fase Nome da fase que falhou.
   * @param causa Erro original do repository (logado pelo tratador).
   */
  constructor(fase: string, causa: unknown) {
    super(`Falha do banco na fase ${fase}`, { cause: causa })
    this.name = 'FalhaDoBanco'
    this.fase = fase
  }
}
