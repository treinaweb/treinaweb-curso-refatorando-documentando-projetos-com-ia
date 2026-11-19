/**
 * Testes unitarios do ciclo de vida do pedido (src/domain/pedido.ts).
 *
 * Como os de precos, importam direto do dominio, e so dele.
 */
import { describe, expect, it } from 'vitest'
import { podeCancelar } from '../../src/domain/pedido'

describe('podeCancelar', () => {
  it('so pedido criado pode ser cancelado', () => {
    expect(podeCancelar('criado')).toBe(true)
  })

  it('pedido cancelado ou com outro status nao pode ser cancelado', () => {
    for (const status of ['cancelado', 'Criado', 'pago', '']) {
      expect(podeCancelar(status), status).toBe(false)
    }
  })
})
