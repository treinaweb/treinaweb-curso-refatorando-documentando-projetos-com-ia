/**
 * @file Services da Loja API: os casos de uso. Montados pelo `createApp` sobre
 * os repositories e entregues aos routers (src/http/routes/).
 *
 * Os services chamam os repositories e o dominio (src/domain/), lancam erros
 * de dominio (src/domain/erros.ts) e, quando a rota tem mais de uma mensagem
 * 500, marcam a fase da falha com `FalhaDoBanco` (src/services/erros.ts). Nao
 * conhecem HTTP.
 */
import type { Repositorios } from '../repositories'
import { criarClientesService } from './clientes'
import { criarFreteService } from './frete'
import { criarPedidosService } from './pedidos'
import { criarProdutosService } from './produtos'
import { criarRelatorioService } from './relatorio'

/** Services entregues aos routers. */
export type Services = ReturnType<typeof criarServices>

/**
 * Cria os services sobre os repositories informados.
 *
 * @param r Repositories (`criarRepositorios`).
 * @returns Os services, um por recurso.
 */
export function criarServices(r: Repositorios) {
  return {
    produtos: criarProdutosService(r),
    clientes: criarClientesService(r),
    frete: criarFreteService(),
    pedidos: criarPedidosService(r),
    relatorio: criarRelatorioService(r),
  }
}
