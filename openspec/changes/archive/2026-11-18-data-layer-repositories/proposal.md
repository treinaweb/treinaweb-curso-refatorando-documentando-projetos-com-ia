# Proposal

## Why

Esta change implementa a **etapa 4 (Camada de dados)** de `docs/refatoracao.md`. Hoje há 22 chamadas
ao banco espalhadas nos handlers, 6 delas com SQL concatenado, e a criação e o cancelamento de pedido
gravam passo a passo, com contadores de callback e sem transação. O resultado:
- uma falha no meio grava o pedido pela metade (`500 Pedido criado com erros`);
- uma falha na leitura dos itens do relatório ou do cancelamento **derruba o processo**: o erro é
  ignorado no callback e vira `TypeError` fora do Express;
- todas as 13 vulnerabilidades do `npm audit` vêm do driver `sqlite3` 5.

Nenhuma das 17 respostas 500 tem teste.

## What Changes

- **Driver:** `sqlite3` 5 → **`better-sqlite3` 13**. Ele é estável, carrega nesta máquina (glibc 2.35)
  e tem transação nativa. O `sqlite3` 6 exige GLIBC 2.38 no binário pronto e ainda traz 5
  vulnerabilidades altas; o `node:sqlite` é *release candidate*. `src/db/index.js` vira `index.ts`,
  com o mesmo schema e o mesmo seed (só em banco novo).
- **Repositories em TS**, com interface `Promise`, em `src/repositories/` (produtos, clientes,
  pedidos), com todo o SQL parametrizado com `?`. O `createApp` cria os repositories a partir do `db`
  e os **injeta nas factories**, como já faz com os validadores, porque o JS legado não importa `.ts`
  sob o Vitest. `utils.buscar_cliente` sai.
- **Handlers legados `async`:** trocam os callbacks e os contadores por `await` nos repositories, com
  `try/catch` que mantém a mensagem 500 de cada rota. Cálculos e regras não mudam (etapa 5).
- **Transações:**
  - **criação do pedido** (pedido + itens + baixa de estoque): qualquer falha na gravação faz rollback
    e responde `500 Erro ao salvar pedido`, sem nada gravado. **BREAKING (contrato de erro):**
    `500 Pedido criado com erros` deixa de existir.
  - **cancelamento** (status + devolução de estoque): qualquer falha faz rollback (o pedido continua
    `criado` e o estoque não muda) e responde `500 Erro ao cancelar pedido`.
- **Falhas que hoje derrubam o processo** (itens no relatório e no cancelamento) e devoluções de
  estoque que hoje ignoram o erro passam a responder 500 em JSON, com a mensagem da rota.
- **Testes de falha do banco**, só pelo HTTP: um helper monta um app com um banco temporário quebrado
  de propósito (`DROP TABLE` ou trigger com `RAISE`).
  - **Antes** da troca do driver, caracterizam as 15 mensagens 500 que não mudam.
  - **Depois**, testam a atomicidade e os caminhos que hoje derrubam o processo.

  Nenhum teste existente muda. Os `it.todo` de falha do banco viram testes, e o de "pedido sem itens
  nunca responde" ganha o texto atualizado.
- **Dependências:** sai o `sqlite3` (e a entrada dele em `allowScripts`); entra o `better-sqlite3`. O
  `npm audit` deve ficar sem vulnerabilidades.
- **Docs:** README e `docs/openapi.yaml` (as respostas 500 do `POST /pedidos` e a nota de transação),
  JSDoc, `AGENTS.md` (Mapa, Armadilhas sem "SQL concatenado" e "Sem transação", convenção de
  repositories) e `docs/refatoracao.md`.

## Capabilities

### New Capabilities

- `gravacao-pedidos`: atomicidade da criação e do cancelamento de pedido. Uma falha durante a
  gravação não deixa pedido, itens, status ou estoque alterados pela metade.
- `falhas-do-banco`: como cada rota responde a uma falha do banco: status 500, corpo JSON no formato
  de erro da rota, com a mensagem da rota, sem página HTML e sem derrubar o processo.

### Modified Capabilities

Nenhuma. `validacao-entrada` e `busca-produtos` não mudam. A busca continua com `LIKE ?`, agora dentro
do repository.

## Impact

- **API:**
  - `500 Pedido criado com erros` sai;
  - falhas que derrubavam o processo viram `500` em JSON;
  - o cancelamento com falha deixa de devolver o estoque em parte.

  As demais respostas não mudam.
- **Código:**
  - novos `src/repositories/*.ts`;
  - `src/db/index.ts`;
  - `src/app.ts` (criação e injeção dos repositories);
  - `src/routes/*.js` (handlers `async`, sem SQL);
  - `src/utils.js` (sai o `buscar_cliente`).
- **Testes:** novos testes de falha do banco e um helper novo em `test/helpers.ts`; `test/setup.ts`
  fecha também os bancos extras. Os 111 testes existentes não mudam.
- **Dependências:** `better-sqlite3` (produção) no lugar do `sqlite3`.
- **Fora de escopo:** índices (o `TODO` do schema), mudanças de schema, regras de preço e as
  divergências *a confirmar* (inclusive o estoque negativo com produto repetido), services e
  middleware de erro centralizado (etapa 6).
