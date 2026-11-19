/**
 * @file Tratamento centralizado dos erros das rotas.
 *
 * Os controllers nao tem `try`: quando um service rejeita, o Express 5 repassa
 * o erro ao proximo tratador de 4 argumentos da pilha da rota, que e o
 * `falhas(...)` colocado no fim de cada rota. Ele converte o erro no status e
 * na mensagem, no formato de erro da rota (`{ erro }` ou `{ error }`).
 *
 * Nao ha tratador no nivel do app: erros anteriores as rotas (como o JSON
 * malformado do `express.json()`) continuam no tratador padrao do Express.
 */
import type { ErrorRequestHandler } from 'express'
import { ErroDeDominio, EstoqueInsuficiente, NaoEncontrado, TransicaoInvalida } from '../../domain/erros'
import { FalhaDoBanco } from '../../services/erros'
import type { Formato } from './validar'

/**
 * Mensagens 500 de uma rota: `padrao` para qualquer falha e, opcionalmente,
 * uma mensagem por fase de {@link FalhaDoBanco}.
 */
export type MensagensFalha = { padrao: string } & Record<string, string>

/**
 * Status de um erro de dominio, ou `undefined` se a classe nao tiver status
 * (e entao vira 500).
 *
 * @param erro Erro de dominio recebido.
 * @returns 404, 400 ou `undefined`.
 */
const statusDeDominio = (erro: ErroDeDominio): number | undefined => {
  if (erro instanceof NaoEncontrado) return 404
  if (erro instanceof EstoqueInsuficiente || erro instanceof TransicaoInvalida) return 400
  return undefined
}

/**
 * Cria a fabrica de tratadores de erro de um router, no formato de erro dele.
 *
 * O tratador devolvido por `falhas(mensagens)` responde:
 * - `NaoEncontrado`: 404 com a mensagem do erro;
 * - `EstoqueInsuficiente`, `TransicaoInvalida`: 400 com a mensagem do erro;
 * - `FalhaDoBanco(fase)`: 500 com `mensagens[fase]` (ou `mensagens.padrao`, se
 *   a fase nao estiver no mapa);
 * - qualquer outro erro: 500 com `mensagens.padrao`.
 *
 * Nos 500, a causa e logada com `console.error`.
 *
 * @example
 * const falhas = tratarErros('erro')
 * router.get('/:id', idPedido, buscar, falhas({ padrao: 'Erro ao buscar pedido', itens: 'Erro ao buscar itens' }))
 * @param formato Chave do objeto de erro da rota.
 * @returns `falhas(mensagens)`, que cria o tratador de uma rota.
 */
export const tratarErros =
  (formato: Formato) =>
  (mensagens: MensagensFalha): ErrorRequestHandler =>
  (erro: unknown, _req, res, _next) => {
    if (erro instanceof ErroDeDominio) {
      const status = statusDeDominio(erro)
      if (status !== undefined) {
        res.status(status).json({ [formato]: erro.message })
        return
      }
    }
    const mensagem = erro instanceof FalhaDoBanco ? (mensagens[erro.fase] ?? mensagens.padrao) : mensagens.padrao
    console.error(erro instanceof FalhaDoBanco ? erro.cause : erro)
    res.status(500).json({ [formato]: mensagem })
  }
