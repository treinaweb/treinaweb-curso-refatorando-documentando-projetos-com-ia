/**
 * Helpers compartilhados pelos testes de caracterizacao.
 *
 * Os testes so falam com a API por HTTP (supertest sobre o app) e importam
 * apenas deste arquivo; nao importam modulos internos (utils, descontos, db).
 * Este arquivo e o test/setup.ts sao os unicos que montam o app e mexem no
 * banco: cada arquivo de teste roda num processo proprio, com um banco
 * temporario novo (o `abrirBanco` cria o schema e o seed nele), fechado e
 * apagado pelo setup. `appComBanco` monta apps extras com bancos quebrados de
 * proposito para as respostas a falhas do banco.
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import supertest from 'supertest'
import { expect } from 'vitest'
import { createApp } from '../src/app'
import { abrirBanco } from '../src/db'

type Banco = ReturnType<typeof abrirBanco>

/** Bancos temporarios abertos por este arquivo de teste (fechados pelo setup). */
const bancos: { db: Banco; arquivo: string }[] = []

/**
 * Abre um banco temporario novo (schema + seed) e o registra para
 * {@link fecharBancos}.
 *
 * @returns A conexao aberta.
 */
const abrirTemporario = (): Banco => {
  const arquivo = path.join(os.tmpdir(), `loja-test-${process.pid}-${randomUUID()}.db`)
  const db = abrirBanco(arquivo)
  bancos.push({ db, arquivo })
  return db
}

const app = createApp({ db: abrirTemporario() })

/** Cliente HTTP sobre o app (porta efemera aberta e fechada pelo supertest). */
export const api = () => supertest(app)

/**
 * App proprio sobre um banco temporario quebrado de proposito, para testar as
 * respostas a falhas do banco so pelo HTTP. `preparar` e SQL executado depois
 * do seed (por exemplo `DROP TABLE produtos` ou um trigger com
 * `RAISE(ABORT, ...)`); vazio, o banco fica intacto.
 *
 * @param preparar SQL de preparo (um ou mais comandos).
 * @returns Cliente HTTP sobre esse app.
 */
export const appComBanco = async (preparar: string) => {
  const db = abrirTemporario()
  if (preparar) db.exec(preparar)
  const appQuebrado = createApp({ db })
  return () => supertest(appQuebrado)
}

/** Fecha e apaga todos os bancos temporarios deste arquivo de teste. */
export const fecharBancos = async () => {
  for (const { db, arquivo } of bancos.splice(0)) {
    db.close()
    fs.rmSync(arquivo, { force: true })
  }
}

/** Produtos do seed (src/db), na ordem de insercao: `id` = posicao + 1. */
export const SEED_PRODUTOS = [
  { id: 1, nome: 'Mouse sem fio', preco: 50, estoque: 40 },
  { id: 2, nome: 'Teclado mecânico', preco: 250, estoque: 15 },
  { id: 3, nome: 'Cabo USB-C 1m', preco: 29.9, estoque: 100 },
  { id: 4, nome: 'Cabo HDMI 2m', preco: 34.7, estoque: 60 },
  { id: 5, nome: 'Hub USB 4 portas', preco: 61.7, estoque: 25 },
  { id: 6, nome: 'Monitor 24 polegadas', preco: 899, estoque: 8 },
  { id: 7, nome: 'Headset gamer', preco: 320, estoque: 10 },
  { id: 8, nome: 'Webcam HD', preco: 100, estoque: 20 },
  { id: 9, nome: 'Suporte para notebook', preco: 299.9, estoque: 3 },
  { id: 10, nome: 'Mousepad grande', preco: 39.9, estoque: 50 },
  { id: 11, nome: 'Notebook 14 polegadas', preco: 3299, estoque: 5 },
  { id: 12, nome: 'SSD 480GB', preco: 219.9, estoque: 30 },
  { id: 13, nome: 'Memória RAM 8GB', preco: 159.9, estoque: 25 },
  { id: 14, nome: 'Cabo de rede 5m', preco: 24.9, estoque: 80 },
  { id: 15, nome: 'Adaptador HDMI para VGA', preco: 45, estoque: 18 },
  { id: 16, nome: 'Caixa de som Bluetooth', preco: 189, estoque: 12 },
  { id: 17, nome: 'Carregador USB-C 65W', preco: 149.9, estoque: 22 },
]

/** Clientes do seed (src/db), na ordem de insercao: `id` = posicao + 1. */
export const SEED_CLIENTES = [
  { id: 1, nome: 'Maria Silva', email: 'maria.silva@example.com', cep: '01310100', tipo: 'comum' },
  { id: 2, nome: 'João Pereira', email: 'joao.pereira@example.com', cep: '20040020', tipo: 'vip' },
  { id: 3, nome: 'Pedro Santos', email: 'pedro.santos@example.com', cep: '30130000', tipo: 'comum' },
  { id: 4, nome: 'Carla Oliveira', email: 'carla.oliveira@example.com', cep: '40020000', tipo: 'comum' },
  { id: 5, nome: 'Distribuidora Ramos Ltda', email: 'compras@ramos.example.com', cep: '50030230', tipo: 'atacado' },
  { id: 6, nome: 'Lucas Almeida', email: 'lucas.almeida@example.com', cep: '60060100', tipo: 'comum' },
  { id: 7, nome: 'Fernanda Costa', email: 'fernanda.costa@example.com', cep: '70040010', tipo: 'vip' },
  { id: 8, nome: 'Rafael Gomes', email: 'rafael.gomes@example.com', cep: '80010000', tipo: 'comum' },
  { id: 9, nome: 'Juliana Rocha', email: 'juliana.rocha@example.com', cep: '90010000', tipo: 'comum' },
  { id: 10, nome: 'Tiago Martins', email: 'tiago.martins@example.com', cep: '13010000', tipo: 'comum' },
]

/** Ids de clientes do seed por tipo e faixa de CEP (1o digito). */
export const CLIENTE = {
  comumCep0: 1, // Maria Silva, CEP 0... (faixa 0-3: R$ 15)
  vipCep2: 2, // Joao Pereira, CEP 2... (faixa 0-3: R$ 15)
  comumCep4: 4, // Carla Oliveira, CEP 4... (faixa 4-7: R$ 30)
  atacadoCep5: 5, // Distribuidora Ramos, CEP 5... (faixa 4-7: R$ 30)
  vipCep7: 7, // Fernanda Costa, CEP 7... (faixa 4-7: R$ 30)
  comumCep8: 8, // Rafael Gomes, CEP 8... (faixa 8-9: R$ 20)
  comumCep9: 9, // Juliana Rocha, CEP 9... (faixa 8-9: R$ 20)
}

/** Item do corpo de `POST /pedidos`. */
export type ItemPedido = { produto_id: unknown; quantidade: unknown }

/** `POST /pedidos` com o corpo informado; devolve a resposta crua. */
export const postPedido = (cliente_id: unknown, itens: ItemPedido[]) =>
  api().post('/pedidos').send({ cliente_id, itens })

/** Cria um pedido e exige 201; devolve o corpo da resposta. */
export const criarPedido = async (cliente_id: number, itens: ItemPedido[]) => {
  const res = await postPedido(cliente_id, itens)
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body
}

/** Estoque atual de um produto, lido por `GET /produtos/:id`. */
export const estoqueDe = async (produto_id: number): Promise<number> => {
  const res = await api().get(`/produtos/${produto_id}`)
  expect(res.status).toBe(200)
  return res.body.estoque
}

/** Formato ISO 8601 de `criado_em` (`new Date().toISOString()`). */
export const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
