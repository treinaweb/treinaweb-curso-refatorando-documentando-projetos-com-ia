# Tasks

Regra para todo o arquivo: cada mudança de resposta tem antes um teste que registra o comportamento
atual (grupo 2); ao mudar o código, esse teste é atualizado no mesmo passo. `npm test` e
`npm run typecheck` passando ao fim de cada grupo. Rodar com Node 22 (`.nvmrc`).

## 1. Linha de base e dependência

- [x] 1.1 Rodar `npm test` (88 passando, 8 todo) e `npm run typecheck` antes de qualquer mudança e verificar que estão limpos
- [x] 1.2 Instalar `zod@4` como dependência de produção e verificar com `npm ls zod` (4.x) e `npm test` sem mudança

## 2. Caracterização do comportamento atual (sem mudar código)

Os testes são escritos como o comportamento é hoje. Use `[atual]` para bug ou divergência. Todos
devem passar antes do grupo 3.

- [x] 2.1 `test/pedidos.test.ts`, `cliente_id` inválido. Registrar:
  - `0`, `""` e `false` → 400 `cliente_id obrigatorio`;
  - `1.5` → 404 `Cliente nao encontrado`;
  - `-3` → 404;
  - `"1"` → 201, com o pedido criado.

  Verificar com `npm test`.
- [x] 2.2 `test/pedidos.test.ts`, itens. Registrar:
  - `produto_id: 0` → 400 `produto_id obrigatorio no item 1`;
  - `produto_id: "1"` → 201;
  - `itens: [5]` → 400 `produto_id obrigatorio no item 1`;
  - `itens: [null]` → 500, com o corpo e o content-type atuais (`[atual]`).

  Verificar com `npm test`.
- [x] 2.3 `test/clientes.test.ts`, nome e email. Registrar:
  - `nome: 123` → 201, gravado com `nome: 123` (`[atual]`);
  - `email: true` → 201 (`[atual]`);
  - `{ email: true }` sem nome → 400 `Nome e email sao obrigatorios`.

  Verificar com `npm test`.
- [x] 2.4 Ids no path. Registrar:
  - `GET /produtos/1.0`, `/produtos/1e0` e `/produtos/%201` → 200, produto 1 (`[atual]`);
  - `GET /produtos/01` → 200;
  - `GET /clientes/1.0` → 200 (`[atual]`);
  - `GET /pedidos/1.0` e `POST /pedidos/abc/cancelar` → 404, com um pedido criado.

  Cada caso vai no arquivo da sua área. Verificar com `npm test`.
- [x] 2.5 `test/frete.test.ts`. Registrar:
  - `subtotal` `-10` → 200 com `subtotal: -10` e frete cobrado (`[atual]`);
  - `1e3` → `subtotal: 1000`;
  - `.5` → `0.5`;
  - `100,50` → `100`;
  - `?subtotal=` → 0;
  - `cep=0131-0100` → 200 (`[atual]`);
  - `cep=123&subtotal=abc` → 400 `CEP invalido`.

  Verificar com `npm test`.
- [x] 2.6 `test/produtos.test.ts`. Registrar:
  - `?busca=a&busca=b` → 200 `[]` (`[atual]`);
  - `?busca[x]=cabo` → o comportamento atual (`[atual]`);
  - `?busca=Cabo_HDMI` → 200 com "Cabo HDMI 2m" (curinga `_`; teste normal, que não muda).

  Verificar com `npm test`.

## 3. Middleware `validar` e ids no path

- [x] 3.1 Criar `src/http/middlewares/validar.ts`:
  - `validar({ schema, origem, formato, status })`, como na Decisão 2 do design (primeiro problema,
    mensagem do schema, marcador `{item}`);
  - JSDoc em português.

  Verificar com `npm run typecheck`.
- [x] 3.2 Criar `src/http/schemas/id.ts` (só dígitos) e mudar as factories para receber os
  validadores: `createLegadoRouter(db, v)`, `createClientesRouter(db, v)`,
  `createPedidosRouter(db, v)`. Montar em `src/app.ts` `idProduto`, `idCliente` e `idPedido` (404, no
  formato de cada rota). Aplicar nas cinco rotas com id e atualizar o JSDoc das factories.
- [x] 3.3 Atualizar os testes do grupo 2.4 para 404 com a mensagem da rota (o `/produtos/01` continua
  200) e o `[atual] id nao numerico` do resumo para 404 `Pedido nao encontrado`, sem o prefixo.
  Verificar com `npm test`.
- [x] 3.4 Documentar os ids do path: `pattern: '^\d+$'` nos parâmetros `id` do `docs/openapi.yaml`,
  e uma nota no README de que um id que não é só dígitos responde 404 como um id inexistente.
  Verificar que o YAML continua válido (`node -e` com um parser, ou `npx @redocly/cli lint`, se já
  estiver disponível).

## 4. `POST /pedidos`

- [x] 4.1 Criar `src/http/schemas/pedido.ts` (Decisão 3: `cliente_id`, `itens`, item, mensagens
  obrigatório e inválido, item não-objeto, ordem das chaves) e injetar `criarPedido` em
  `createPedidosRouter`.
- [x] 4.2 Remover a validação manual do handler, incluindo o ramo `Body vazio`. O handler fica com
  cliente e produto inexistentes, estoque e cálculo. Atualizar o JSDoc da rota com as mensagens novas.
- [x] 4.3 Atualizar os testes:
  - 2.1 e 2.2 para as respostas novas (`cliente_id invalido`, `produto_id invalido no item N`,
    `produto_id obrigatorio no item 1` para `[null]`);
  - os `[atual]` de `produto_id`/`cliente_id` não numéricos → 400 inválido;
  - o `[atual] sem corpo...` perde o prefixo.

  Verificar com `npm test`, incluindo os testes de ordem já existentes.
- [x] 4.4 Atualizar a seção de `POST /pedidos` no README e no `docs/openapi.yaml` com as mensagens de
  400. Verificar que todas as mensagens do schema aparecem nos dois
  (`grep -c "invalido no item" README.md docs/openapi.yaml`).

## 5. CEP, `POST /clientes` e `GET /frete`

- [x] 5.1 Tornar o `validaCep` estrito (Decisão 4) e atualizar o JSDoc. Criar `src/http/schemas/cep.ts`
  reaproveitando o `validaCep`.
- [x] 5.2 Criar `src/http/schemas/cliente.ts` (nome, email, cep) e injetar `criarCliente` (formato
  `error`). Remover a validação manual do `criarCliente`; a normalização do CEP continua no handler
  via `validaCep`.
- [x] 5.3 Criar `src/http/schemas/frete.ts` (cep, subtotal) e injetar `frete` no legado. Remover a
  validação manual do CEP no handler; o `parseFloat` continua lendo o subtotal já validado.
- [x] 5.4 Atualizar os testes:
  - 2.3 → `Nome invalido` / `Email invalido`, nenhum cliente gravado;
  - `aceita CEP numerico...` → o numérico passa a dar 400 `CEP invalido` (os espaços continuam 201);
  - `[atual] validaCep aceita hifen...` → 400, sem o prefixo;
  - 2.5 → `Subtotal invalido` (o `?subtotal=` continua 0) e `CEP invalido` para `0131-0100`;
  - `subtotal ausente ou invalido vale 0` e `subtotal com sufixo...` → o ausente continua 0, e `abc`
    e `350reais` dão 400.

  Verificar com `npm test`.
- [x] 5.5 Atualizar a seção de `POST /clientes` e de `GET /frete` no README e no `docs/openapi.yaml`:
  - as mensagens novas;
  - CEP só texto;
  - o formato do subtotal.

  Verificar com `grep -n "Subtotal invalido\|Nome invalido\|Email invalido" README.md docs/openapi.yaml`.

## 6. Busca de produtos

- [x] 6.1 Criar `src/http/schemas/busca.ts` e injetar `busca` em `GET /produtos`; trocar a
  concatenação por `LIKE ?` com `'%' + busca + '%'` (Decisão 5) e atualizar o JSDoc (sai o aviso de
  SQL concatenado).
- [x] 6.2 Atualizar os testes:
  - `[atual] aspa simples...` → 200 `[]`, sem o prefixo;
  - 2.6 → 400 `Busca invalida` para o repetido e o objeto;
  - o curinga `_` continua igual.

  Verificar com `npm test`.
- [x] 6.3 Atualizar `GET /produtos` no README e no `docs/openapi.yaml`:
  - `Busca invalida`;
  - `%` e `_` como curingas;
  - aspa aceita.

## 7. Convenções, roteiro e verificação final

- [x] 7.1 Atualizar o `AGENTS.md`:
  - Convenção: validação de entrada só por schema Zod em `src/http/schemas/`, aplicada por
    `validar()` e injetada nas factories, porque o JS legado não importa TS;
  - Armadilhas: a busca e o resumo saem do "SQL concatenado";
  - Mapa: `src/http/`.

  Verificar com `grep -n "src/http" AGENTS.md`.
- [x] 7.2 Atualizar o `docs/refatoracao.md`:
  - etapa 3 com as decisões tomadas: injeção, mensagens de nome e email, ids do path em todas as
    rotas, valores falsy, item não-objeto, detalhes de P2, efeito do CEP estrito no frete;
  - os padrões propostos viram decididos;
  - registro de andamento.
- [x] 7.3 Verificar:
  - `grep -rn "\[atual\]" test` lista só as divergências de negócio (estoque negativo, resumo
    `> 500`, relatório `Math.round`);
  - `npm test`, `npm run typecheck` e `npm run test:coverage` passam.
- [x] 7.4 Smoke do `dist/`: `DB_PATH=/tmp/loja-teste.db PORTA=3999 npm start`, conferindo:
  - um caso novo de cada grupo (`/produtos/1.0` → 404, `cliente_id: "1"` → 400, `nome: 123` → 400,
    `subtotal=abc` → 400, `busca='` → 200);
  - uma resposta inalterada (`POST /pedidos` válido → 201).

  Apagar o banco descartável no fim.
