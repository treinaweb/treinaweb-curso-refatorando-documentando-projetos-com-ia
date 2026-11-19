/**
 * @file Log de cada requisicao no console.
 */
import type { RequestHandler } from 'express'

/**
 * Escreve `<ISO> <METODO> <URL>` com `console.log` e segue para o proximo
 * middleware. Registrado no `createApp` logo depois do `express.json()`.
 *
 * @example 2026-11-19T12:00:00.000Z GET /produtos?busca=mouse
 */
export const logRequisicao: RequestHandler = (req, _res, next) => {
  console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url)
  next()
}
