# Tasks

Regra para todo o arquivo: nenhum teste existente é alterado. Os testes novos entram em duas fases:
caracterização antes da troca (grupo 2) e comportamento novo depois (grupo 4). Rodar com Node 24
(`.nvmrc`). `npm test` e `npm run typecheck` passando ao fim de cada grupo.

## 1. Linha de base

- [x] 1.1 Rodar `npm test` (111 passando, 8 todo), `npm run typecheck` e `npm audit` (esperado: 13, todas do `sqlite3`)

## 2. Caracterização das falhas do banco (driver atual, sem mudar código de produção)

- [x] 2.1 Criar em `test/helpers.ts` o `appComBanco(preparar)` (Decisão 6): banco temporário próprio, `abrirBanco`, `exec` do SQL de preparo e `() => supertest(createApp({ db }))`, registrando o banco para o `test/setup.ts` fechar e apagar no `afterAll`. Verificar com um uso trivial (`appComBanco('')` respondendo `GET /produtos` 200) e nenhum `loja-test-*.db` sobrando no tmpdir.
- [x] 2.2 Caracterizar, no arquivo de cada área e no lugar do `it.todo` correspondente:
  - produtos: `Erro ao buscar produtos` e `Erro ao buscar produto` (`DROP TABLE produtos`);
  - clientes: `Erro ao listar clientes`, `Erro ao buscar cliente` e `Erro ao salvar cliente`, no formato `{ error }` (`DROP TABLE clientes`).

  Verificar com `npm test`.
- [x] 2.3 Caracterizar em `test/pedidos.test.ts`:
  - `Erro ao buscar pedido` (`DROP TABLE pedidos`);
  - `Erro ao buscar itens` (`INSERT` de um pedido + `DROP TABLE itens_pedido`);
  - `Erro interno` na leitura do cliente (`DROP TABLE clientes`) e na dos produtos (`DROP TABLE produtos`);
  - `Erro ao salvar pedido` (`DROP TABLE pedidos`, com cliente e produtos válidos).

  Manter o `it.todo` de "Pedido criado com erros" até o grupo 4. Verificar com `npm test`.
- [x] 2.4 Caracterizar:
  - resumo: `Erro ao gerar resumo` na leitura do pedido (`DROP TABLE pedidos`) e na dos itens (`INSERT` de um pedido + `DROP TABLE itens_pedido`);
  - relatório: `Erro ao gerar relatorio` na consulta principal (`DROP TABLE pedidos`);
  - cancelamento: `Erro ao cancelar pedido` na leitura do pedido (`DROP TABLE pedidos`) e no `UPDATE` do status (trigger `BEFORE UPDATE ON pedidos` com `RAISE(ABORT)`).

  Verificar com `npm test`: 111 existentes + 15 novos passando e nenhum teste existente alterado (`git diff -- test/*.test.ts` só com adições e troca de `it.todo`).

## 3. Driver, repositories e handlers (em bloco: os testes passam no fim do grupo)

- [x] 3.1 Trocar as dependências: remover o `sqlite3` e a entrada dele em `allowScripts`, adicionar `better-sqlite3@13` (versão exata) e `@types/better-sqlite3` (dev). Verificar com `npm ls better-sqlite3` e `npm ls sqlite3` vazio.
- [x] 3.2 `git mv src/db/index.js src/db/index.ts` e reescrever o `abrirBanco` sobre o `better-sqlite3` (Decisão 5): mesmo schema, mesmo seed, só em arquivo novo, seed numa transação, com JSDoc.
- [x] 3.3 Criar `src/repositories/produtos.ts`, `clientes.ts`, `pedidos.ts` e `index.ts` (`criarRepositorios`), como na Decisão 2:
  - métodos `async` e SQL só com `?`;
  - `pedidos.criar` e `pedidos.cancelar` com `db.transaction`;
  - tipos das linhas (`Produto`, `Cliente`, `Pedido`, `ItemPedido`);
  - JSDoc em português.
- [x] 3.4 Mudar o `createApp` para criar os repositories e injetá-los (`createXRouter(r, v)`), e reescrever os handlers de `src/routes/clientes.js` como `async`, com `try/catch` e a mesma mensagem 500 (Decisão 4).
- [x] 3.5 Reescrever os handlers de `src/routes/pedidos.js` (`GET /:id`, `POST /`) e remover o `buscar_cliente` de `src/utils.js`:
  - `POST /` sem contador de callback, com `r.pedidos.criar`;
  - as mensagens `Erro interno` e `Erro ao salvar pedido` ligadas às mesmas operações de hoje;
  - JSDoc sem "Pedido criado com erros" e com a nota de transação.
- [x] 3.6 Reescrever os handlers de `src/routes/legado.js` (produtos, frete, resumo, relatório, cancelamento):
  - sem contadores;
  - com `r.pedidos.cancelar`;
  - o JSDoc de cancelamento e relatório sem "sem transação".
- [x] 3.7 Ajustar a infraestrutura de teste ao driver novo (`exec` e `close` síncronos no `appComBanco` e no `setup.ts`, sem mudar a assinatura do helper). Verificar:
  - `npm test`: 126 passando, os mesmos de antes do grupo;
  - `npm run typecheck` limpo;
  - `grep -rnE "db\.(run|get|all|exec|prepare)" src/routes src/utils.js` vazio;
  - `grep -rn "' +\|+ '" src/repositories` sem SQL concatenado;
  - `grep -rn "await r\." src/routes` com cada ocorrência dentro de um `try`.

## 4. Comportamento novo (testes depois da troca)

- [x] 4.1 Em `test/pedidos.test.ts`, trocar o `it.todo` de "Pedido criado com erros" pelos cenários de `gravacao-pedidos`:
  - falha ao gravar um item (trigger `BEFORE INSERT ON itens_pedido`): 500 `Erro ao salvar pedido`, o pedido não existe e o estoque não muda;
  - falha ao baixar o estoque (trigger `BEFORE UPDATE ON produtos`): idem, com dois itens.

  Verificar com `npm test`.
- [x] 4.2 Em `test/cancelar.test.ts`, os cenários de cancelamento atômico:
  - falha na devolução do estoque (trigger `BEFORE UPDATE ON produtos`, com o pedido criado antes do trigger): 500, o pedido continua `criado` e o estoque não muda;
  - falha na leitura dos itens (`DROP TABLE itens_pedido` depois de criar o pedido): 500, o pedido continua `criado`.

  Atualizar o texto do `it.todo` de "pedido sem itens nunca responde" (o travamento saiu; o caso continua inalcançável pela API). Verificar com `npm test`.
- [x] 4.3 Em `test/relatorio.test.ts`: falha nos itens do relatório (pedido criado + `DROP TABLE itens_pedido`) → 500 `Erro ao gerar relatorio`, e, no mesmo app, `GET /produtos` → 200 (o processo continua atendendo). Verificar com `npm test` e `grep -rn "it.todo" test`, que deve listar só o caso inalcançável.

## 5. Documentação e roteiro

- [x] 5.1 README e `docs/openapi.yaml`:
  - `POST /pedidos` sem `500 Pedido criado com erros` e com a nota de que a criação é atômica;
  - cancelamento atômico;
  - stack com `better-sqlite3`.

  Verificar com `grep -rn "Pedido criado com erros" README.md docs/ src/ test/` vazio.
- [x] 5.2 `AGENTS.md`:
  - Mapa com `src/repositories/` e `src/db/index.ts`;
  - Armadilhas sem "SQL concatenado" e "Sem transação";
  - convenção: "SQL só em `src/repositories/` (e o schema em `src/db/`), injetado nas factories; handlers não acessam o banco; todo `await` de repository dentro de `try` com a mensagem 500 da rota";
  - o novo helper `appComBanco` na seção de testes.

  Verificar com `grep -n "SQL concatenado\|Sem transa" AGENTS.md` vazio.
- [x] 5.3 `docs/refatoracao.md`:
  - etapa 4 concluída, com o driver decidido e o motivo (o `sqlite3` 6 exige GLIBC 2.38 e traz 5 vulnerabilidades altas; o `node:sqlite` é release candidate);
  - handlers `async` já nesta etapa, e na etapa 6 o critério "sem callbacks de banco" passa a "já cumprido na etapa 4";
  - testes de falha do banco;
  - as mensagens da transação;
  - correção dos fatos verificados sobre o `sqlite3` 6;
  - registro de andamento.

## 6. Verificação final

- [x] 6.1 Rodar `npm test` (todos passando; o único `it.todo` é o inalcançável), `npm run typecheck`, `npm run test:coverage` e `npm audit` (esperado: 0 vulnerabilidades), e conferir que nenhum SQL existe fora de `src/repositories/` e `src/db/` (`grep -rnE "SELECT|INSERT|UPDATE|DELETE" src --include=*.js --include=*.ts`, ignorando JSDoc e o bloco comentado do `DELETE`).
- [x] 6.2 Smoke do `dist/` com o `loja.db` existente copiado para `/tmp` e com um banco novo:
  - `npm start` sobe;
  - `GET /produtos`, `GET /relatorios/vendas`, `POST /pedidos` → 201 (o estoque cai);
  - `POST /pedidos/<id>/cancelar` → 200 (o estoque volta).

  Apagar as cópias no fim.
