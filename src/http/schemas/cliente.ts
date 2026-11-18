/**
 * @file Schema do corpo de `POST /clientes`.
 *
 * Ordem de avaliacao (a resposta usa so o primeiro problema): `nome`,
 * `email`, `cep`. Mensagens (formato `{ error }`, status 400):
 * - `Nome e email sao obrigatorios`: `nome` ou `email` ausente, `null` ou `""`;
 * - `Nome invalido` / `Email invalido`: valor que nao e texto;
 * - `CEP invalido`: veja src/http/schemas/cep.ts.
 *
 * Texto so com espacos e aceito, e o formato do e-mail nao e validado.
 * Campos extras (inclusive `tipo`) sao ignorados: o cliente cadastrado pela
 * API e sempre `comum`.
 */
import { z } from 'zod'
import { cepSchema } from './cep'
import { ausente, objetoOuVazio } from './comum'

const OBRIGATORIOS = 'Nome e email sao obrigatorios'

/**
 * Campo de texto obrigatorio e nao vazio.
 *
 * @param invalido Mensagem para valor que nao e texto.
 * @returns Schema do campo.
 */
const textoObrigatorio = (invalido: string) =>
  z.string({ error: (problema) => (ausente(problema.input) ? OBRIGATORIOS : invalido) }).min(1, { error: OBRIGATORIOS })

/** Corpo de `POST /clientes` (sem corpo conta como `{}`). */
export const criarClienteSchema = objetoOuVazio(
  z.object({
    nome: textoObrigatorio('Nome invalido'),
    email: textoObrigatorio('Email invalido'),
    cep: cepSchema,
  }),
)
