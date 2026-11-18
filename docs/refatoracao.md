# Roteiro de refatoração

Referência para propor as changes da refatoração da Loja API. Cada etapa abaixo vira uma change
do OpenSpec (`/opsx:propose <change sugerida>`), que cita a etapa, copia o escopo e as decisões para
a proposal e o design, e **atualiza este roteiro na mesma change**: o registro de andamento e qualquer
decisão que tenha mudado.

O roteiro é uma referência, não um contrato fechado: uma etapa pode rever uma decisão, desde que
registre a mudança aqui.

## Objetivo

Melhorar a legibilidade e a manutenção do código sem mudar o comportamento da API:

- separar responsabilidades em camadas e aplicar padrões de projeto;
- trocar callbacks e contadores de callback por `async/await`;
- atualizar dependências (Express 5, driver do SQLite);
- adotar validação de entrada com Zod;
- migrar o código para TypeScript estrito.

## Princípios e invariantes

1. **Os testes de caracterização são a rede de segurança.** Os 88 testes de `test/` (change
   `2026-11-18-add-characterization-tests`) registram o contrato HTTP atual: status, corpo inteiro,
   efeitos no estoque e valores gravados. Cada etapa começa e termina com `npm test` e
   `npm run typecheck` passando.
2. **Só a etapa 3 altera testes de caracterização.** Ela concentra todas as mudanças de comportamento
   da refatoração. Da etapa 2 em diante, na ordem de execução, nenhum teste existente muda: se um teste
   quebrar, a refatoração mudou o comportamento sem querer. Nenhum `*.test.ts` muda fora da etapa 3:
   eles importam só de `test/helpers.ts`. Só a infraestrutura de teste (`helpers.ts` e `setup.ts`) pode
   mudar para acompanhar a estrutura, como na etapa 1 (`createApp` + `abrirBanco`).
3. **Regras de negócio *a confirmar* são preservadas.** Os testes `[atual]` que registram divergências
   de negócio (veja "Fora da refatoração") continuam passando como estão. Mudá-las é decisão do
   negócio e vira change própria.
4. **Uma change por etapa**, pequena o bastante para revisar. Uma etapa grande pode ser dividida
   (por exemplo, a 6 por recurso), desde que cada parte deixe os testes passando.
5. **Testes só pelo HTTP.** Testes unitários novos (por exemplo, do domínio de preços) são permitidos
   e bem-vindos, mas não substituem os de caracterização.
6. **Documentação na mesma change**, como já pede o `AGENTS.md`: README, JSDoc ou TSDoc, OpenAPI e
   `AGENTS.md`, sempre que a etapa mudar rota, regra, comando ou convenção.

## Arquitetura de destino

```
src/
  server.ts            entrypoint: createApp(deps) + listen
  app.ts               createApp({ db }) -> middlewares, rotas, tratador de erro
  http/
    routes/            produtos, clientes, pedidos, frete, relatorios
    controllers/       traduzem HTTP <-> service (status, formato de erro)
    schemas/           schemas Zod de entrada (body, query, params)
    middlewares/       log de requisicao, tratador de erro
  services/            casos de uso: PedidoService, RelatorioService, ...
  domain/
    precos/            Strategy de desconto por tipo + frete (um lugar so)
    pedido.ts          tipos e ciclo de vida (criado -> cancelado)
  repositories/        ProdutoRepo, ClienteRepo, PedidoRepo (SQL parametrizado)
  db/                  conexao, schema, seed

  HTTP --> controller --> service --> domain (puro, sem I/O)
                             |
                             +------> repository --> SQLite
```

Os padrões adotados, cada um porque resolve um problema concreto do código atual:

| Padrão | Problema que resolve |
|---|---|
| **Repository** | SQL espalhado nos handlers, parte dele concatenado |
| **Service layer** (casos de uso) | Handlers que validam, calculam, gravam e respondem ao mesmo tempo (`POST /pedidos`) |
| **Strategy** (desconto por tipo de cliente) | Regra de desconto copiada em 3 lugares. O `desconto_<tipo>` já é uma Strategy informal. |
| **Factory com injeção de dependência** (`createApp({ db })`) | Singleton do `db.js` aberto no `require` |
| **Middleware de erro centralizado** | `console.log(err)` + `res.status(500)` repetido em cada callback |
| **Schemas de validação** (Zod) | Validação manual, incompleta e espalhada |

## Ordem de execução

As etapas mantêm a numeração usada no planejamento. A ordem de execução é:

```
[0] --> [1] --> [3] --> [2] --> [4] --> [5] --> [6] --> [7] --> [8]
                 ^
                 unica etapa que altera testes de caracterizacao
```

A etapa 3 vem antes da 2 porque os schemas Zod já tratam o `req.body` ausente. Com isso, o upgrade
para o Express 5 não muda nenhuma resposta. A etapa 3 depende da 1 para os schemas já nascerem em TS,
no lugar definitivo.

Legenda das decisões: **Decidido** foi confirmado no planejamento. **Padrão proposto** é uma sugestão
ainda não confirmada, a confirmar na etapa. **Em aberto** é decidido na própria etapa; as opções e a
recomendação estão listadas.

---

## Etapa 0: Testes de caracterização (concluída)

- **Change sugerida:** `add-characterization-tests` (arquivada em `2026-11-18-add-characterization-tests`)
- **Depende de:** nada.
- **Objetivo:** registrar o comportamento HTTP atual antes de qualquer refatoração.
- **Escopo:** Vitest 5 + supertest, testes em TS, um banco temporário por arquivo, `app.js` exportando
  o `app`, convenção `[atual]`, lacunas como `it.todo`.
- **Fora de escopo:** corrigir bugs, testes unitários de funções internas.
- **Decisões tomadas:** testes de caracterização (comportamento atual, inclusive bugs); em processo,
  com supertest; Vitest; testes em `.test.ts`.
- **Decisões em aberto:** nenhuma.
- **Riscos:** nenhum pendente.
- **Pronto quando:** feito. São 88 testes e 8 `it.todo`, com 88% de cobertura de linhas.

## Etapa 1: Fundação (concluída)

- **Change sugerida:** `refactor-foundation` (arquivada em `2026-11-18-refactor-foundation`)
- **Depende de:** etapa 0.
- **Objetivo:** criar a estrutura onde as demais etapas acontecem, sem mudar nenhuma lógica.
- **Escopo:**
  - pasta `src/` e mudança dos módulos atuais para ela com `git mv`, para preservar o histórico;
  - `createApp({ db })` + `server.ts` (entrypoint com `listen`); o `db` passa a ser injetado, e o
    singleton aberto no `require` deixa de existir;
  - o `tsconfig` passa a cobrir `src/` com `allowJs`, e os módulos novos já nascem em `.ts`;
  - a pipeline para rodar e empacotar (veja as decisões em aberto) e os scripts `start`, `test`,
    `typecheck` ajustados;
  - o `test/setup.ts` e o `test/helpers.ts` passam a usar `createApp` com um banco temporário. Nenhum
    `*.test.ts` muda.
- **Fora de escopo:** reescrever a lógica, trocar callbacks por `async/await`, atualizar dependências
  de produção.
- **Decisões tomadas:**
  - `createApp` com injeção de dependência; TS com `allowJs` durante a transição.
  - **Injeção por factories:** os routers são `createXRouter(db)`, `buscar_cliente` recebe o `db` e
    `db.js` virou `abrirBanco(arquivo)` (seed só em banco novo). As rotas que estavam no `app.js` ficam
    juntas em `src/routes/legado.js` até a etapa 6.
  - **Como rodar o TS:** compilar com `tsc` para `dist/` (`tsconfig.build.json`, `module: nodenext`) e
    rodar `node dist/server.js`; o `npm start` compila antes (`prestart`). A remoção de tipos nativa
    foi descartada por ora: exigiria Node >= 22.18 e imports com `.ts`.
  - **Node 24:** adiado. A pipeline escolhida não depende dele; a decisão volta na etapa 2.
    `.nvmrc` e `engines` não mudaram. (Entrou na etapa 2.)
  - **Histórico:** os movimentos foram para um commit próprio, antes das factories. Envolver o corpo
    dos módulos numa função reindenta tudo, e o Git deixa de detectar o rename num commit só (mesmo
    com `-w`).
- **Decisões em aberto:** nenhuma.
- **Observações:**
  - O `tsc` reescreve o JS legado em `dist/` com `"use strict"`, então o código que roda em produção não
    é o que os testes exercitam. A suíte foi rodada uma vez contra o `dist/` (88 passando) e o smoke
    passa a ser critério das etapas 3 a 6, até a etapa 7 eliminar o JS.
  - A cobertura de linhas passou de 88% para 86% sem nenhum teste a menos: o JS legado agora é carregado
    com `require` nativo a partir do `app.ts`, e o v8 mede de forma mais grosseira que no arquivo
    importado pelo Vite. O `src/server.ts` (só `listen`) fica fora da cobertura.
- **Riscos:**
  - Mover arquivos quebra imports → `git mv` e `npm test` depois de cada movimento.
  - O seed do `db.js` depende de o arquivo não existir → manter a mesma semântica no `createApp`
    (seed só em banco novo).
- **Pronto quando:** `npm start` sobe a API pelo entrypoint novo com o mesmo log; `npm test` (88 e 8
  todo) e `npm run typecheck` passam; nenhuma lógica de rota mudou (o commit dos movimentos mostra
  só renames; o seguinte, com `git diff -w`, só a ligação das factories e do `createApp`).

## Etapa 3: Validação com Zod e correções explícitas (concluída)

- **Change sugerida:** `validation-and-explicit-fixes` (arquivada em `2026-11-18-validation-and-explicit-fixes`)
- **Depende de:** etapa 1.
- **Objetivo:** fixar o contrato de entrada com Zod e corrigir, **de forma explícita**, os
  comportamentos que são efeitos colaterais da implementação legada. É a única etapa que altera testes
  de caracterização.
- **Escopo:**
  1. **Primeiro**, adicionar testes de caracterização para os casos ainda não cobertos que esta etapa
     vai mudar: ids em texto (`"1"`), `nome: 123` / `email: true`, busca repetida. Eles registram o
     comportamento atual antes da mudança.
  2. Schemas Zod 4 em `src/http/schemas/`, aplicados por `validar()` (`src/http/middlewares/`) e
     injetados nas factories dos routers legados agora; usados direto pelos controllers na etapa 6.
  3. As correções da tabela abaixo e a política de tipos estrita.
  4. Atualizar os testes afetados (os `[atual]` corrigidos viram testes normais), o README, o
     `docs/openapi.yaml`, o JSDoc e o `AGENTS.md`.
- **Fora de escopo:** as regras de negócio *a confirmar* (veja "Fora da refatoração"), unificar o
  formato de erro, transações (etapa 4).
- **Decisões tomadas:**
  - **Correções explícitas:**

    | # | Hoje (`[atual]`) | Passa a ser |
    |---|---|---|
    | 1 | `GET /produtos?busca='` → 500 | 200, com a aspa tratada como caractere comum (`[]` no seed). `%` e `_` continuam como curingas. |
    | 2 | `POST /pedidos` com `produto_id: "abc"` → 500 `Erro interno` | 400 `produto_id invalido no item N` |
    | 3 | `POST /pedidos` com `cliente_id: "abc"` → 500 `Erro interno` | 400 `cliente_id invalido` |
    | 4 | `GET /pedidos/abc/resumo` → 500 | 404 `Pedido nao encontrado` (igual a `GET /pedidos/abc`) |
    | 5 | `Body vazio` inalcançável; sem corpo → `cliente_id obrigatorio` | Mantém `cliente_id obrigatorio` e remove o ramo morto |
    | 6 | `validaCep` aceita `0131-0100` e `1.310100` | Estrito: `/^\d{5}-?\d{3}$/` depois do `trim` |

  - **Zod nesta etapa**, e não na 6: adotar Zod é uma decisão de comportamento (o que é aceito e o
    que é rejeitado), e a validação é definida uma única vez, no lugar definitivo.
  - **Política de tipos estrita em tudo** (API interna, sem clientes externos): ids do corpo só como
    `number` inteiro positivo (`"1"` → 400); `quantidade` inteiro de verdade (como hoje); `nome` e
    `email` como string não vazia (`nome: 123` → 400); `email` sem validação de formato (seria regra
    nova, não correção).
  - **Mensagens:** usar `safeParse` e converter **o primeiro problema** encontrado na mensagem atual,
    no formato atual da rota (`{erro}` ou `{error}`). Mensagens do próprio Zod nunca aparecem na
    resposta. A ordem do `shape` reproduz a ordem atual: `cliente_id` → itens → item a item
    (`produto_id` antes de `quantidade`); `nome`/`email` antes do CEP.
  - **Obrigatório x inválido:** ausente (`undefined`/`null`) gera a mensagem de obrigatório, que é a
    atual (`cliente_id obrigatorio`, `produto_id obrigatorio no item N`). Tipo ou formato errado gera
    a de inválido. Isso muda os valores *falsy*: `0`, `""` e `false` em `cliente_id`/`produto_id`
    davam "obrigatorio" e passam a "invalido"; `cliente_id: 1.5` dava 404 e passa a 400.
  - **Validadores injetados nas factories:** o JS legado não consegue importar `.ts` sob o Vitest
    (`require` nativo), então o `createApp` monta os middlewares e os passa às factories junto com o
    `db` (`createPedidosRouter(db, { idPedido, criarPedido })`). Descartados: middlewares montados no
    `createApp` (caminho duplicado) e converter os handlers para TS (invade as etapas 6 e 7).
  - **Nome e email:** ausente, `null` ou `""` → `Nome e email sao obrigatorios` (como hoje); valor
    que não é texto → as mensagens novas `Nome invalido` / `Email invalido`. Só espaços continua
    aceito.
  - **Ids no path em todas as rotas** (não só no resumo): só dígitos; senão, o 404 da rota. Muda
    `/produtos/1.0`, `/1e0`, `/%201`, `/clientes/1.0` e `/<id>.0` de pedido, resumo e cancelamento, que
    encontravam o registro pela afinidade INTEGER do SQLite. `/produtos/01` continua 200.
  - **Item do pedido que não é objeto** (`null`, `5`) → `produto_id obrigatorio no item N`. `null`
    dava 500 em HTML.
  - **Correção 6 também vale para `GET /frete`**, porque o `validaCep` é compartilhado. Ele é a regra
    única de CEP, reaproveitada pelos schemas.
  - **Padrões confirmados:**
    - `cep` numérico no `POST /clientes` → 400 `CEP invalido`.
    - `GET /frete`: `subtotal` ausente ou vazio vale 0; fora de `^\d+(\.\d+)?$` (inclusive negativo,
      `1e3`, `.5`, `100,50`, `350reais` e repetido) → 400 `Subtotal invalido`. O CEP é conferido antes.
    - Busca repetida ou em forma de objeto → 400 `Busca invalida`.
    - Campos extras no corpo continuam **ignorados** (sem `z.strictObject`), inclusive `tipo: 'vip'`
      no `POST /clientes`.
- **Decisões em aberto:** nenhuma.
- **Observações:**
  - A ordem dos problemas do Zod 4 seguiu a ordem das chaves e dos itens; não foi preciso validar em
    fases.
  - No Zod 4, `z.unknown().refine()` torna a chave obrigatória, com a mensagem do próprio Zod: os
    campos opcionais usam `z.optional(...)`. Ficou registrado na convenção do `AGENTS.md`.
  - O SQL concatenado que sobrou (resumo, `buscar_cliente`, ids do `POST /pedidos`) só recebe inteiros
    validados; a etapa 4 o parametriza.
- **Riscos:**
  - A ordem dos problemas do Zod pode não reproduzir a ordem atual → os testes de ordem já existem;
    se for preciso, validar em duas fases (topo, depois itens).
  - O `subtotal` com `parseFloat` não tem equivalente direto no `z.coerce.number()` → usar um
    `preprocess` próprio.
  - Clientes já gravados com CEP fora do padrão → continuam funcionando, porque o frete só lê o
    primeiro dígito e a validação só roda no cadastro. Conferir o `loja.db` de produção antes.
- **Pronto quando:** cada mudança de comportamento tem o teste antigo atualizado e citado na change;
  `grep -rn "\[atual\]" test` lista só as divergências de negócio; README, OpenAPI e `AGENTS.md` estão
  atualizados; `npm test` e `npm run typecheck` passam.
  Smoke do `dist/`: `npm start` num banco descartável e as rotas principais respondendo como os
  testes atualizados descrevem.

## Etapa 2: Express 5 (concluída)

- **Change sugerida:** `upgrade-express-5` (arquivada em `2026-11-18-upgrade-express-5`)
- **Depende de:** etapa 3.
- **Objetivo:** ganhar o tratamento nativo de promises rejeitadas nos handlers, pré-requisito para o
  `async/await` das etapas 4 a 6.
- **Escopo:** `express@5` + `@types/express@5` (hoje na 4, entrou na etapa 1); ajustar o que o
  Express 5 muda, preservando as respostas. Rever a decisão do Node 24 (adiada na etapa 1).
- **Fora de escopo:** reescrever handlers em `async` (etapa 6).
- **Decisões tomadas:**
  - Preservar todas as respostas. Nenhum teste mudou.
  - **Query parser `extended`**, fixado no `createApp`. Com o `simple`, um teste falhava:
    `?busca[x]=cabo` virava a chave literal `busca[x]` e respondia 200 com todos os produtos, em vez
    do `400 Busca invalida` do spec `validacao-entrada`. Trocar para o `simple` é uma change própria
    de contrato.
  - **Node 24 nesta etapa** (decisão do usuário, junto com o Express 5): `.nvmrc` 24,
    `engines.node` `>=24.11.0` e `@types/node` 24. O `express` fica fixado em versão exata (`5.3.0`),
    como antes.
- **Decisões em aberto:** nenhuma.
- **Observações:** o `npm audit` foi de 14 para 13 vulnerabilidades (saiu a moderada do Express 4).
  As 13 restantes vêm todas do `sqlite3` 5 e saem na etapa 4.
- **Riscos:**
  - Sem corpo, o `req.body` passa a ser `undefined` → já tratado pelos schemas da etapa 3; conferir
    as rotas sem schema.
  - Mudanças na sintaxe de rotas do `path-to-regexp` → as rotas atuais (`/:id`, `/:id/resumo`) são
    simples; os testes de 404 do `DELETE /pedidos/:id` cobrem o roteamento.
- **Pronto quando:** `express` 5 instalado, `npm test` sem nenhuma mudança nos testes, `npm audit`
  sem vulnerabilidades novas.
  Smoke do `dist/`: `npm start` num banco descartável e as rotas principais respondendo como antes.

## Etapa 4: Camada de dados (concluída)

- **Change sugerida:** `data-layer-repositories`
- **Depende de:** etapa 2.
- **Objetivo:** tirar o SQL dos handlers, parametrizar tudo e dar atomicidade às operações de pedido.
- **Escopo:**
  - `ProdutoRepo`, `ClienteRepo` e `PedidoRepo` com interface `Promise`, todo o SQL parametrizado
    com `?`;
  - **transações** na criação de pedido (pedido + itens + baixa de estoque) e no cancelamento
    (status + devolução);
  - troca ou upgrade do driver (veja as decisões em aberto) e o schema e o seed em `src/db/`.
- **Fora de escopo:** mudar o schema das tabelas, criar índices (o `TODO` do schema em `src/db/` vira
  change própria, se for desejado), regras de preço.
- **Decisões tomadas:**
  - Repositories com interface `Promise`, mesmo que o driver seja síncrono, para poder trocá-lo.
  - **Driver: `better-sqlite3` 13** (`db.transaction()` nativo). O `sqlite3` 6.0.1 foi descartado: o
    binário pronto exige GLIBC 2.38 (a máquina de desenvolvimento tem 2.35) e ele ainda traz 5
    vulnerabilidades altas (`node-gyp` → `tinyglobby` → `picomatch`). O `node:sqlite` foi descartado por
    ser *release candidate* (estabilidade 1.2, fora do semver), embora não emita mais
    `ExperimentalWarning` no Node 24.18.
  - **Repositories em TS injetados nas factories** (`createXRouter(repositorios, validadores)`), pelo
    mesmo motivo dos validadores: o JS legado não importa `.ts` sob o Vitest.
  - **Handlers `async` já nesta etapa**, com `try/catch` que mantém a mensagem 500 de cada rota.
    Trocar callback por `await` é o próprio trabalho de tirar o SQL do handler; fazer callback →
    síncrono agora e síncrono → `async` na etapa 6 mexeria duas vezes nos mesmos handlers. Os
    callbacks de banco e os contadores de callback já saem aqui.
  - **Transações e mensagens:** na criação, qualquer falha na gravação faz rollback e responde
    `500 Erro ao salvar pedido` (a resposta de pedido gravado pela metade deixou de existir); no
    cancelamento, o rollback mantém o pedido `criado` e o estoque, e responde `500 Erro ao cancelar
    pedido`. Specs `gravacao-pedidos` e `falhas-do-banco`.
  - **Testes de falha do banco** (helper `appComBanco`, banco temporário quebrado com `DROP TABLE`
    ou trigger com `RAISE`): as 15 mensagens 500 que não mudam foram caracterizadas no `sqlite3` 5
    antes da troca; a atomicidade e as falhas que derrubavam o processo (itens do relatório e do
    cancelamento) foram testadas depois. Nenhum teste existente mudou.
- **Decisões em aberto:** nenhuma.
- **Observações:**
  - Duas falhas do banco derrubavam o processo (o erro era ignorado no callback e virava `TypeError`
    fora do Express): a leitura dos itens no relatório e no cancelamento. As devoluções de estoque do
    cancelamento ignoravam o erro e respondiam 200.
  - A troca foi feita em bloco (driver, repositories e handlers), não handler a handler: a função da
    transação do `better-sqlite3` é síncrona, e um adaptador provisório do `sqlite3` obrigaria a
    escrever as transações duas vezes.
  - O bloco comentado do `DELETE /pedidos/:id` em `src/routes/legado.js` ainda tem SQL: é o aviso de
    que pedidos não são excluídos, e sua remoção fica para a etapa 8.
- **Riscos:**
  - O driver síncrono deixa a interface `Promise` "artificial" → é aceito, em troca de poder trocar
    de driver.
  - Formato de números (`REAL`) e ordem das linhas sem `ORDER BY` diferentes entre drivers → os testes
    comparam o JSON inteiro e a ordem da listagem.
  - O pedido com produto repetido (estoque negativo) precisa continuar igual → há teste `[atual]`.
- **Pronto quando:** nenhum SQL fora de `src/repositories/` e `src/db/`;
  `grep -rn "' +\|+ '" src/repositories` não encontra SQL concatenado; `npm test` sem mudança nos
  testes; `npm audit` sem as vulnerabilidades do `sqlite3` 5.
  Smoke do `dist/`: `npm start` num banco descartável e as rotas principais respondendo como antes.

## Etapa 5: Domínio de preços

- **Change sugerida:** `pricing-domain`
- **Depende de:** etapa 4.
- **Objetivo:** concentrar as regras de preço (desconto e frete) num módulo de domínio puro, sem
  I/O, e deixar as divergências **explícitas** em vez de escondidas em cópias.
- **Escopo:**
  - Strategy de desconto por tipo de cliente (`comum`, `vip`, `atacado`; tipo desconhecido → 0);
  - um único cálculo de frete, sobre o subtotal antes do desconto, pelo CEP;
  - as divergências viram **políticas com nome**, usadas por quem hoje tem a cópia divergente:
    `POST /pedidos` usa a regra canônica, o resumo usa `comum > 500`, o relatório usa desconto com
    `Math.round` e não conhece tipos novos;
  - a precisão (`toFixed(2)`) centralizada num helper de dinheiro, reproduzindo exatamente os
    arredondamentos atuais.
- **Fora de escopo:** **corrigir** as divergências (veja "Fora da refatoração").
- **Decisões tomadas:** as divergências continuam, só que com nome e documentadas no código
  (`@todo Diverge de ...`).
- **Decisões em aberto:** acrescentar testes unitários do domínio, além dos de HTTP. Recomendação:
  sim, porque as funções puras são baratas de testar e documentam as regras.
- **Riscos:**
  - Mudar a ordem das operações de ponto flutuante muda centavos (por exemplo, `46.945.toFixed(2)`)
    → os testes comparam os valores exatos; reproduzir a mesma sequência de cálculo.
  - "Unificar sem querer" a divergência do resumo ou do relatório → há testes `[atual]` para as duas.
- **Pronto quando:** `grep -rn "0.05\|0.1\b\|0.15\|>= 300" src` só encontra o módulo de preços;
  `npm test` sem mudança nos testes.
  Smoke do `dist/`: `npm start` num banco descartável e as rotas principais respondendo como antes.

## Etapa 6: Camada HTTP e services

- **Change sugerida:** `http-layer-services`. Pode ser dividida em `http-layer-catalogo` (produtos,
  clientes, frete) e `http-layer-pedidos` (pedidos, resumo, cancelamento, relatório).
- **Depende de:** etapa 5.
- **Objetivo:** separar as responsabilidades em routes → controllers → services, com `async/await`
  de ponta a ponta.
- **Escopo:**
  - services por caso de uso (`criarPedido`, `cancelarPedido`, `resumoPedido`, `relatorioVendas`,
    ...);
  - controllers finos: validação (schemas da etapa 3), chamada do service, resposta;
  - middleware de erro centralizado, preservando os formatos `{erro}` e `{error}` por rota e as
    mensagens atuais;
  - erros de domínio tipados (por exemplo, `NaoEncontrado`, `EstoqueInsuficiente`) convertidos em
    status no middleware;
  - o log de requisição como middleware próprio;
  - a remoção de `app.js` e `routes/` legados.
- **Fora de escopo:** unificar o formato de erro, autenticação, rotas novas.
- **Decisões tomadas:** `async/await` em tudo; o Express 5 repassa as rejeições ao middleware de erro,
  sem wrappers.
- **Decisões em aberto:** dividir a etapa em duas. Recomendação: dividir, se a change passar de
  algumas centenas de linhas.
- **Riscos:**
  - É a maior etapa → divisão por recurso.
  - O formato de erro (`{error}` só em clientes) se perder na centralização → o middleware recebe o
    formato da rota; os testes comparam o corpo inteiro.
- **Pronto quando:** os `try/catch` por rota foram trocados pelo middleware de erro centralizado (os
  callbacks de banco e os contadores de callback já saíram na etapa 4); os handlers legados de
  `src/routes/` foram removidos; `npm test` sem mudança nos testes (inclusive os de falha do banco da
  etapa 4).
  Smoke do `dist/`: `npm start` num banco descartável e as rotas principais respondendo como antes.

## Etapa 7: TypeScript estrito

- **Change sugerida:** `typescript-strict`
- **Depende de:** etapa 6.
- **Objetivo:** concluir a migração.
- **Escopo:** remover o `allowJs`; `strict` total; sem `any` implícito ou explícito no código de
  produção; tipos de domínio compartilhados (`Produto`, `Cliente`, `Pedido`, `TipoCliente`); tipos de
  entrada inferidos dos schemas Zod (`z.infer`).
- **Fora de escopo:** mudança de lógica.
- **Decisões tomadas:** os módulos novos das etapas 1 a 6 já nascem em TS; esta etapa só fecha a
  porta.
- **Decisões em aberto:** adotar lint (ESLint com `typescript-eslint`) e formatação (Prettier).
  Recomendação: decidir aqui, porque ajuda a manter o estrito.
- **Riscos:** tipos "forçados" com `as` escondendo erros → revisar todo `as` na change.
- **Pronto quando:** nenhum `.js` em `src/`; `npm run typecheck` passa com `strict`;
  `grep -rn ": any\|as any" src` vazio; `npm test` sem mudança nos testes.

## Etapa 8: Limpeza final

- **Change sugerida:** `refactor-cleanup`
- **Depende de:** etapa 7.
- **Objetivo:** deixar o projeto coerente com a arquitetura nova.
- **Escopo:** remover o código morto (`formata_moeda`, o comentário do `DELETE`, se ele não for mais
  necessário como aviso); revisar dependências e scripts; `AGENTS.md` (Mapa, Armadilhas e Convenções)
  refletindo a arquitetura nova; o README com os comandos atuais; este roteiro marcado como concluído.
- **Fora de escopo:** mudança de comportamento.
- **Decisões tomadas:** nenhuma.
- **Decisões em aberto:** manter este roteiro como registro histórico ou movê-lo para um archive.
- **Riscos:** remover um aviso que ainda protege (por exemplo, o de que pedidos não são excluídos) →
  ele passa para o `AGENTS.md` ou para o código, se for removido daqui.
- **Pronto quando:** `AGENTS.md` sem armadilhas que já não existem; `npm test`, `npm run typecheck` e
  `npm audit` limpos.

---

## Fora da refatoração

São regras de negócio *a confirmar*, registradas por testes `[atual]`. A refatoração as **preserva**.
Cada uma vira uma change própria, quando o negócio decidir, em qualquer momento depois da etapa 5
(que as deixa explícitas):

- **Estoque negativo** com o mesmo produto em dois itens do pedido (`pedidos.test.ts`).
- **Resumo do `comum` com `> 500`**, enquanto a cobrança usa `>= 500` (`resumo.test.ts`).
- **Relatório com `Math.round`** no desconto, faturamento diferente da soma de `pedidos.total`
  (`relatorio.test.ts`).
- **Regra antiga do VIP** ("só acima de R$ 200", num comentário em `descontos.js`): hoje são 10% sobre
  qualquer valor.
- **Unificação do formato de erro** (`{erro}` x `{error}`): muda o contrato, então precisa de change
  própria.

## Fatos verificados

Verificados em 2026-11-18. A etapa correspondente deve revalidar antes de decidir.

- **Express 5** (documentação do projeto): `req.body` não é mais inicializado como `{}` sem corpo; o
  *query parser* padrão passa a ser `simple`; promises rejeitadas em handlers e middlewares vão para o
  middleware de erro. Versão atual: 5.3.0 (`@types/express` 5.0.6).
- **SQLite:** `sqlite3` 6.0.1 (Node >= 20.17); revisto na etapa 4: não corrige o `npm audit` (5 altas
  pela cadeia `node-gyp`) e o binário pronto exige GLIBC 2.38; `better-sqlite3` 13.2.0 (Node >= 22); `node:sqlite` disponível no Node 22.15 e no 24.18,
  mas com `ExperimentalWarning` nos dois.
- **Zod:** 4.6.7.
- **`sqlite3` 5.1.7 no Node 24.18** (Linux x64): instala por binário pronto e funciona sem recompilar
  (usa N-API). Verificado na etapa 2.
- **Vitest 5** exige Node `^22.12.0 || ^24 || >=26`. TypeScript 7.0.2 funciona com `allowJs` no
  `typecheck`.
- **Comportamento atual que vai mudar na etapa 3** (verificado no código): ids em texto (`"1"`)
  funcionam em `POST /pedidos`, porque são concatenados no SQL e as chaves de objeto em JS são strings;
  `nome: 123` é gravado em `POST /clientes`, porque só se confere se o valor é *truthy*.

## Registro de andamento

| Etapa | Change | Status |
|---|---|---|
| 0. Testes de caracterização | `add-characterization-tests` | concluída (`2026-11-18-add-characterization-tests`) |
| 1. Fundação | `refactor-foundation` | concluída (`2026-11-18-refactor-foundation`) |
| 3. Validação com Zod e correções explícitas | `validation-and-explicit-fixes` | concluída (`2026-11-18-validation-and-explicit-fixes`) |
| 2. Express 5 | `upgrade-express-5` | concluída (`2026-11-18-upgrade-express-5`) |
| 4. Camada de dados | `data-layer-repositories` | concluída (`data-layer-repositories`) |
| 5. Domínio de preços | `pricing-domain` | pendente |
| 6. Camada HTTP e services | `http-layer-services` | pendente |
| 7. TypeScript estrito | `typescript-strict` | pendente |
| 8. Limpeza final | `refactor-cleanup` | pendente |
