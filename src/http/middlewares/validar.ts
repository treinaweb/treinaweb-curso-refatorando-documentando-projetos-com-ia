/**
 * @file Middleware generico de validacao de entrada com schemas Zod.
 *
 * Os schemas ficam em src/http/schemas/ e definem as mensagens do projeto no
 * `error` de cada campo; este middleware nunca devolve mensagens do Zod.
 * O `validar` so confere e responde; `req` nao e alterado (no Express 5,
 * `req.query` nem pode ser reatribuido). O controller obtem o valor parseado
 * (com os `transform` dos schemas, como o CEP sem hifen) com {@link validado},
 * que reaplica o mesmo schema: assim a entrada sai tipada pelo schema, sem
 * `any` (os `locals` da resposta do Express sao `Record<string, any>`) e sem
 * `as`.
 */
import type { Request, RequestHandler } from 'express'
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
 * - Valido: chama `next()`, sem alterar a requisicao.
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
    const texto = mensagem ?? (problema && resolverMensagem(problema.message, problema.path))
    if (texto === undefined) {
      // Inalcancavel: um safeParse que falha sempre traz ao menos um problema.
      // Se acontecer, vira o 500 da rota (o `falhas(...)` no fim da pilha).
      throw new Error('Validacao falhou sem problemas')
    }
    res.status(status).json({ [formato]: texto })
  }
}

/**
 * Valor parseado da entrada de uma rota, com o tipo de saida do schema.
 *
 * Reaplica o schema que o {@link validar} da rota ja conferiu: o parse e puro
 * (os `transform` nao tem efeito colateral), entao o resultado e o mesmo.
 *
 * @param req Requisicao.
 * @param origem Parte da requisicao validada.
 * @param schema O mesmo schema usado pelo `validar` da rota.
 * @returns O valor parseado.
 * @throws {ZodError} Se a entrada for invalida, o que so acontece se a rota
 *   nao rodou o `validar` dessa origem antes (erro de montagem; vira o 500 da
 *   rota).
 */
export function validado<S extends ZodType>(req: Request, origem: Origem, schema: S): z.output<S> {
  return schema.parse(req[origem])
}
