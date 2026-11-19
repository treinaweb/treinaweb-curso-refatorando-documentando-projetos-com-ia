# Tasks

Regra para todo o arquivo: nenhum teste existente (`test/*.test.ts` e `test/dominio/`) é alterado. O
único teste novo é o da task 1.2. Rodar com Node 24 (`.nvmrc`). Ao fim de cada task que mexe em
código, `npm test` e `npm run typecheck` passam. Código novo em TS, com JSDoc em português (entradas,
retorno e erros com status).

## 1. Linha de base e teste do JSON malformado

- [x] 1.1 Rodar `npm test` (163 passando, 1 todo) e `npm run typecheck`. Registrar a saída de `grep -rn "try {" src/routes`, que mostra os `try` a eliminar, e de `git ls-files src/routes src/utils.js`, que lista os arquivos que vão sair.
- [x] 1.2 Acrescentar a `test/pedidos.test.ts` um teste de caracterização: `POST /pedidos` com corpo malformado (`{"cliente_id":`, `content-type: application/json`) → status 400 e `content-type` que não é JSON (`text/html`), usando só `./helpers` (design, Decisão 7). Verificar com `npx vitest run test/pedidos.test.ts`: o teste passa **antes** de qualquer outra mudança, e o total vai para 164.

## 2. Infraestrutura da camada HTTP

- [x] 2.1 Criar `src/domain/erros.ts` (`NaoEncontrado`, `EstoqueInsuficiente`, `TransicaoInvalida`, sem status HTTP), `src/services/erros.ts` (`FalhaDoBanco(fase, causa)`) e `src/domain/pedido.ts` (`StatusPedido`, `podeCancelar`). Acrescentar a `test/dominio/` um teste de `podeCancelar` (`criado` → true; `cancelado` e outro texto → false), importando só de `src/domain/`. Verificar com `npx vitest run test/dominio` e `npm run typecheck`.
- [x] 2.2 Criar `src/http/middlewares/erros.ts`: `tratarErros(formato)` devolve `falhas(mensagens)`, um tratador de 4 argumentos que aplica a tabela da Decisão 2 (`NaoEncontrado` → 404; `EstoqueInsuficiente` e `TransicaoInvalida` → 400; `FalhaDoBanco(fase)` → 500 com `mensagens[fase]`, ou `padrao` se a fase não estiver no mapa; outro erro → 500 com `padrao`; `console.error` da causa nos 500). Verificar com `npm run typecheck`. O uso é testado na task 3.1.
- [x] 2.3 Mudar `src/http/middlewares/validar.ts` para guardar `resultado.data` em `res.locals.validado[origem]` e criar o helper tipado `validado(res, origem, schema)` (Decisão 3). A rejeição não muda. Atualizar o JSDoc (o `validar` não altera `req`, mas o valor parseado passa a ser a fonte da entrada). Verificar com `npm test` sem mudança.
- [x] 2.4 Criar `src/http/middlewares/log.ts` com o log `<ISO> <METODO> <URL>` e usá-lo no `createApp`, na mesma posição do log inline, que sai. Verificar com `npm test` e, no smoke da task 7.2, o mesmo formato de log.
- [x] 2.5 Criar `src/services/index.ts` com `criarServices(repositorios)`, ainda vazio ou só com a estrutura, e montar os services no `createApp` ao lado das factories legadas, que continuam funcionando. Verificar com `npm test` sem mudança.

## 3. Clientes (o primeiro router, que valida o padrão)

- [x] 3.1 Criar `src/services/clientes.ts` (`listar`, `buscar` com `NaoEncontrado('Cliente nao encontrado')`, `criar` devolvendo `{ id, nome, email, cep, tipo: 'comum' }`), o controller e o router `src/http/routes/clientes.ts` (`criarClientesRouter(services)`), com `tratarErros('error')` e as mensagens `Erro ao listar clientes`, `Erro ao buscar cliente` e `Erro ao salvar cliente`. O controller do `POST` lê o corpo validado. Por enquanto, o CEP chega como texto cru, e o service ainda normaliza com `validaCep`; isso sai na task 4.1. Trocar o `/clientes` no `createApp` e `git rm src/routes/clientes.js`. Verificar com `npx vitest run test/clientes.test.ts` e com os casos de clientes dos testes de falha do banco (`{ error }` em 500 e 404), confirmando que o tratador por rota recebe a rejeição do controller (Decisão 2, risco correspondente).

## 4. CEP e subtotal com transform; produtos e frete

- [x] 4.1 Mover a regra do `validaCep` para `src/http/schemas/cep.ts` (`trim`, `/^\d{5}-?\d{3}$/`, `transform` para o CEP sem espaços e sem hífen) e dar ao `subtotal` de `src/http/schemas/frete.ts` um `transform` (ausente ou vazio → 0; senão `parseFloat`). Atualizar o JSDoc dos dois schemas. O service de clientes passa a usar o CEP já normalizado. Verificar com `npx vitest run test/clientes.test.ts test/frete.test.ts`, inclusive os CEPs com espaços e hífen e o `subtotal` ausente, vazio e `"0"`.
- [x] 4.2 Criar `src/services/produtos.ts` (`listar(busca)`, `buscar(id)` com `NaoEncontrado('Produto nao encontrado')`), o controller e o router `src/http/routes/produtos.ts` montado em `/produtos`, com `Erro ao buscar produtos` e `Erro ao buscar produto`. Criar `src/services/frete.ts` (`simular(cep, subtotal)`) e o router `src/http/routes/frete.ts` montado em `/frete`. Tirar as três rotas do `legado.js` e o `require('../utils')` dele. Verificar com `npx vitest run test/produtos.test.ts test/frete.test.ts` e os casos de produtos dos testes de falha do banco.
- [x] 4.3 Remover `src/utils.js` (`git rm`). Verificar com `grep -rn "utils" src` vazio, `npm test` e `npm run typecheck`.

## 5. Pedidos

- [x] 5.1 Criar `src/services/pedidos.ts` com `buscar(id)` (pedido em `padrao`; itens com `FalhaDoBanco('itens')`; devolve `{ ...pedido, itens }`) e `criar({ cliente_id, itens })` na ordem da Decisão 4: cliente, produtos só se o cliente existe, itens na ordem do corpo, preços por `precos.PEDIDO`, gravação com `FalhaDoBanco('gravacao')`, sem mutar a entrada, com o log `pedido <id> (<tipo>) em <n>ms`. Criar o controller e o router `src/http/routes/pedidos.ts` (`GET /:id` com `{ padrao: 'Erro ao buscar pedido', itens: 'Erro ao buscar itens' }`; `POST /` com `{ padrao: 'Erro interno', gravacao: 'Erro ao salvar pedido' }`), com o comentário do `DELETE` desativado (Decisão 8). Trocar no `createApp` e `git rm src/routes/pedidos.js`. Verificar com `npx vitest run test/pedidos.test.ts` (inclusive o `[atual]` do estoque negativo e a ordem das mensagens) e os casos de pedidos dos testes de falha do banco (as duas fases de cada rota).
- [x] 5.2 Acrescentar ao service `resumo(id)` (política `RESUMO`) e `cancelar(id)` (`podeCancelar`, `TransicaoInvalida('Pedido nao pode ser cancelado (status <status>)')`). Criar o *presenter* das linhas do resumo no controller e as rotas `GET /:id/resumo` (`Erro ao gerar resumo`) e `POST /:id/cancelar` (`Erro ao cancelar pedido`) no router de pedidos. Copiar para o JSDoc o `@todo Diverge de POST /pedidos ... (a confirmar)` do resumo. Tirar as duas rotas do `legado.js`. Verificar com `npx vitest run test/resumo.test.ts test/cancelar.test.ts`, inclusive o `[atual]` do `comum` com R$ 500 e o rollback do cancelamento.

## 6. Relatório, remoção do legado e documentação

- [x] 6.1 Criar `src/services/relatorio.ts` (`vendas()`, com a agregação e o arredondamento na sequência da Decisão 4 e a política `RELATORIO`), o controller e o router `src/http/routes/relatorios.ts` montado em `/relatorios`, com `Erro ao gerar relatorio`. Copiar para o JSDoc o `@todo Diverge de POST /pedidos ... (a confirmar)`. Remover `src/routes/legado.js` e a pasta `src/routes/` (`git rm`). Verificar com `npx vitest run test/relatorio.test.ts` (inclusive o `[atual]` do `Math.round`, sem pedidos e com falha nos itens) e com `ls src/routes` inexistente.
- [x] 6.2 Deixar o `createApp` só com: query parser `extended` (com o comentário), `express.json()`, log, `criarRepositorios`, `criarServices` e os cinco routers. Atualizar o JSDoc do `createApp` e do `@file`. Verificar com:
  - `npm test` (164 + o de `podeCancelar`, 1 todo) e `npm run typecheck`;
  - `git diff main -- test/` mostrando só os testes acrescentados nas tasks 1.2 e 2.1;
  - `grep -rn "try {" src/http` vazio;
  - `grep -rn "repositor" src/http/controllers` vazio;
  - `find src -name '*.js'` vazio;
  - toda rota de `src/http/routes/` terminando com `falhas(...)` (conferir com `grep -c "falhas(" src/http/routes/*.ts` contra o número de rotas).
- [x] 6.3 Atualizar o `AGENTS.md`:
  - Mapa: `src/http/routes/`, `controllers/`, `middlewares/` (`validar`, `erros`, `log`), `src/services/`, `src/domain/erros.ts` e `pedido.ts`; saem `src/routes/` e `src/utils.js` (a regra do CEP agora está em `src/http/schemas/cep.ts`); `createApp` injetando só os repositories e montando os services;
  - Armadilhas: a do "`await` de repository fora de `try`" vira "rota sem `falhas(...)` responde 500 em HTML"; o formato de erro inconsistente aponta para `tratarErros('erro' | 'error')`;
  - Convenções: route → controller → service; o controller só chama service, sem `try` e sem cálculo; o service lança erros tipados e marca a fase com `FalhaDoBanco` só quando a rota tem mais de uma mensagem 500; a entrada vem de `validado(...)`; rotas novas em `src/http/routes/`; sai a convenção dos validadores injetados nas factories; os testes de domínio cobrem também `src/domain/pedido.ts`.

  Verificar com `grep -n "src/routes\|utils.js\|legado" AGENTS.md` vazio.
- [x] 6.4 Atualizar o `docs/refatoracao.md`:
  - etapa 5 com "(concluída)" no cabeçalho e o archive na "Change sugerida";
  - etapa 6 concluída, com as decisões: uma change só (decisão do usuário), erros tipados e `FalhaDoBanco(fase)` com tratador por rota, saída do parse em `res.locals` (revendo a decisão da etapa 3), service para tudo, domínio e schemas importados direto, o bug de programação passando a JSON 500, o teste do JSON malformado e o aviso do `DELETE` como comentário;
  - etapa 8 sem o bloco comentado do `DELETE`, que já saiu;
  - registro de andamento.

  Atualizar a linha de origem do `docs/openapi.yaml` (`src/routes/` → `src/http/routes/`). Verificar com `grep -n "http-layer-services" docs/refatoracao.md` e `grep -rn "src/routes" docs README.md` vazio. O README não muda.

## 7. Verificação final

- [x] 7.1 Rodar `npm test`, `npm run typecheck` e `npm run test:coverage` (services e middlewares cobertos pelos testes de caracterização), e `grep -rn "Diverge de" --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist .`, que deve listar as divergências no domínio, no service ou no router do resumo e no do relatório.
- [x] 7.2 Smoke do `dist/` com um banco descartável (`DB_PATH` em `/tmp`, porta 3999):
  - `npm start` sobe, e o log de requisição tem o formato `<ISO> <METODO> <URL>`;
  - `GET /produtos?busca=mouse`, `GET /clientes/1`, `GET /frete?cep=01310-100&subtotal=100` → 200 (frete 15);
  - `POST /clientes` com CEP `" 01310-100 "` → 201, com CEP `01310100`;
  - `POST /pedidos` → 201; `GET /pedidos/<id>` e `GET /pedidos/<id>/resumo` → 200; `POST /pedidos/<id>/cancelar` → 200 e, repetido, 400;
  - `GET /relatorios/vendas` → 200; `GET /clientes/999` → 404 `{ error }`.

  Parar o servidor pelo PID (`ss -ltnp`) e apagar o banco descartável.
