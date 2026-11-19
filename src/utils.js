/**
 * @file Utilitarios compartilhados: validacao de CEP. As regras de preco
 * (frete inclusive) ficam em src/domain/precos/.
 */

/** CEP aceito, depois do `trim`: 5 digitos, hifen opcional, 3 digitos. */
const FORMATO_CEP = /^\d{5}-?\d{3}$/

/**
 * Valida e normaliza um CEP: texto com 5 digitos, hifen opcional e 3 digitos,
 * ignorando espacos nas pontas. E a unica regra de CEP do projeto: os schemas
 * de src/http/schemas/cep.ts a reaproveitam.
 *
 * @example validaCep(' 01310-100 ') // '01310100'
 * @example validaCep('0131-0100')   // null (hifen fora do lugar)
 * @example validaCep(20040020)      // null (so texto)
 * @param {*} cep Valor recebido.
 * @returns {string|null} O CEP sem hifen, ou `null` se for invalido, vazio ou nao for texto.
 */
function validaCep(cep) {
  if (typeof cep !== 'string') return null
  const limpo = cep.trim()
  if (!FORMATO_CEP.test(limpo)) return null
  return limpo.replace('-', '')
}

module.exports = {
    validaCep
}
