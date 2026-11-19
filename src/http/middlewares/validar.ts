/**
 * @file Middleware generico de validacao de entrada com schemas Zod.
 *
 * Os schemas ficam em src/http/schemas/ e definem as mensagens do projeto no
 * `error` de cada campo; este middleware nunca devolve mensagens do Zod.
 * O valor parseado (com os `transform` dos schemas, como o CEP sem hifen) fica
 * em `res.locals.validado[origem]` e e lido pelos controllers com
 * {@link validado}; `req` nao e alterado (no Express 5, `req.query` nem pode
 * ser reatribuido).
 */
import type { RequestHandler, Response } from 'express'
import type { z, ZodType } from 'zod'

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
 * - Valido: guarda o valor parseado em `res.locals.validado[origem]` e chama
 *   `next()`, sem alterar a requisicao.
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
      res.locals.validado = { ...res.locals.validado, [origem]: resultado.data }
      next()
      return
    }
    const problema = resultado.error.issues[0]
    const texto = mensagem ?? resolverMensagem(problema.message, problema.path)
    res.status(status).json({ [formato]: texto })
  }
}

/**
 * Le o valor parseado por um {@link validar} que ja rodou na rota, com o tipo
 * de saida do schema.
 *
 * @param res Resposta da requisicao (o `validar` guarda o valor em `res.locals`).
 * @param origem Parte da requisicao validada.
 * @param _schema Schema usado pelo `validar` da rota (so para o tipo).
 * @returns O valor parseado.
 * @throws {Error} Se nenhum `validar` dessa origem rodou antes (erro de
 *   montagem da rota; vira o 500 da rota).
 */
export function validado<S extends ZodType>(res: Response, origem: Origem, _schema: S): z.output<S> {
  const valores: Partial<Record<Origem, z.output<S>>> | undefined = res.locals.validado
  const valor = valores?.[origem]
  if (valor === undefined) {
    throw new Error(`Entrada nao validada: ${origem}`)
  }
  return valor
}
