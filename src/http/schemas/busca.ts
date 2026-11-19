/**
 * @file Schema da query de `GET /produtos`.
 *
 * `busca` e opcional e, quando informada, e um unico texto. Repetida
 * (`?busca=a&busca=b`, que o Express transforma em lista) ou em forma de
 * objeto (`?busca[x]=...`) da `400 { erro: 'Busca invalida' }`. O texto e
 * usado como parametro do `LIKE` (veja src/repositories/produtos.ts): `%` e `_`
 * continuam sendo curingas.
 */
import { z } from 'zod'
import { objetoOuVazio } from './comum'

/** Query de `GET /produtos`. */
export const buscaSchema = objetoOuVazio(
  z.object({
    busca: z.optional(z.string({ error: 'Busca invalida' })),
  }),
)
