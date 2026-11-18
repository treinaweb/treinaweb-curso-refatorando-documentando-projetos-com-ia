/**
 * @file Middleware generico de validacao de entrada com schemas Zod.
 *
 * Os schemas ficam em src/http/schemas/ e definem as mensagens do projeto no
 * `error` de cada campo; este middleware nunca devolve mensagens do Zod.
 * Os validadores sao montados em src/app.ts e injetados nas factories dos
 * routers (o JS legado nao consegue importar `.ts` sob o Vitest).
 */
import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

/** Parte da requisicao validada. */
export type Origem = 'body' | 'query' | 'params'

/** Chave do objeto de erro: `erro` (rotas legadas) ou `error` (`/clientes`). */
export type Formato = 'erro' | 'error'

/** Opcoes de {@link validar}. */
export interface OpcoesValidar {
  /** Schema aplicado a `req[origem]`. */
  schema: ZodType
  /** Parte da requisicao validada. */
  origem: Origem
  /** Chave do objeto de erro da rota. */
  formato: Formato
  /** Status da rejeicao (padrao 400). */
  status?: number
  /**
   * Mensagem fixa da rejeicao. Sem ela, vale a mensagem do primeiro problema,
   * definida no schema.
   */
  mensagem?: string
}

/** Marcador trocado pela posicao (base 1) do item com problema. */
const MARCADOR_ITEM = '{item}'

/**
 * Troca `{item}` pela posicao (base 1) do primeiro indice numerico do caminho
 * do problema (por exemplo, `['itens', 1, 'produto_id']` -> `2`).
 *
 * @param mensagem Mensagem definida no schema.
 * @param caminho Caminho do problema no valor validado.
 * @returns A mensagem final.
 */
export function resolverMensagem(mensagem: string, caminho: readonly PropertyKey[]): string {
  if (!mensagem.includes(MARCADOR_ITEM)) return mensagem
  const indice = caminho.find((parte): parte is number => typeof parte === 'number')
  return mensagem.replace(MARCADOR_ITEM, String((indice ?? 0) + 1))
}

/**
 * Cria o middleware que valida `req[origem]` com o schema.
 *
 * - Valido: chama `next()` sem alterar a requisicao (o handler continua
 *   lendo `req.body`/`req.query`/`req.params` como chegaram).
 * - Invalido: responde `status` (padrao 400) com `{ [formato]: mensagem }`,
 *   usando so o primeiro problema encontrado.
 *
 * @param opcoes Schema, origem, formato de erro, status e mensagem fixa.
 * @returns Middleware do Express.
 */
export function validar({ schema, origem, formato, status = 400, mensagem }: OpcoesValidar): RequestHandler {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[origem])
    if (resultado.success) {
      next()
      return
    }
    const problema = resultado.error.issues[0]
    const texto = mensagem ?? resolverMensagem(problema.message, problema.path)
    res.status(status).json({ [formato]: texto })
  }
}
