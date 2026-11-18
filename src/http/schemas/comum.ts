/**
 * @file Pecas compartilhadas pelos schemas de entrada.
 *
 * As mensagens sao sempre as do projeto (passadas por quem usa as pecas);
 * nenhuma mensagem do Zod chega a resposta.
 */
import { z } from 'zod'

/**
 * Valor ausente para as regras de "obrigatorio": `undefined` (campo nao
 * enviado) ou `null`.
 *
 * @param valor Valor recebido.
 * @returns `true` se o valor conta como ausente.
 */
export const ausente = (valor: unknown): boolean => valor === undefined || valor === null

/**
 * Troca o que nao e objeto simples (ausente, numero, texto, lista) por `{}`,
 * para que os campos caiam nas mensagens de "obrigatorio" em vez de um erro de
 * tipo do objeto inteiro (por exemplo, sem corpo ou com um item `null`).
 *
 * @param schema Schema do objeto.
 * @returns O schema com o pre-processamento.
 */
export const objetoOuVazio = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (valor) => (typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor : {}),
    schema,
  )

/**
 * Inteiro positivo vindo do corpo (JSON), sem coercao: texto, booleano,
 * decimal, zero e negativo sao invalidos.
 *
 * @param obrigatorio Mensagem para valor ausente (`undefined` ou `null`).
 * @param invalido Mensagem para qualquer outro valor que nao seja inteiro positivo.
 * @returns Schema do campo.
 */
export const inteiroPositivo = (obrigatorio: string, invalido: string) =>
  z
    .number({ error: (problema) => (ausente(problema.input) ? obrigatorio : invalido) })
    .int({ error: invalido })
    .positive({ error: invalido })
