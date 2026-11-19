# Loja API — contexto para agentes

API REST interna de pedidos de uma loja de informática/periféricos.
Node 24 + Express 5 + SQLite (`better-sqlite3`, sem ORM, atrás de repositories `async`), em TypeScript estrito (`strict` + flags extras, sem `allowJs`). Uso interno, **sem autenticação**.

## Rodar e verificar

- `npm install` e `npm start`. O `start` compila antes (`prestart` → `npm run build`, `tsc` para `dist/`) e roda
  `node dist/server.js`; por isso exige as devDependencies instaladas. `dist/` não é versionado.
  Variáveis: `PORTA` (padrão 3000), `DB_PATH` (padrão `./loja.db`).
- Se o arquivo do banco não existe, `abrirBanco` (`src/db`) cria o schema e insere dados de exemplo (produtos e clientes).
  Apagar `loja.db` zera os dados: **pergunte antes de apagar**.
- **Testes:** `npm test` (Vitest + supertest), `npm run typecheck` (`tsc --noEmit` do editor e do build; o Vitest não checa tipos) e
  `npm run test:coverage`. Exigem Node >= 24.11 (o `.nvmrc` atende). Rode `npm test` antes e depois de qualquer mudança.
- **Formatação:** `npm run format` (Prettier: sem ponto e vírgula, aspas simples, `trailingComma: 'all'`, 120
  colunas, só `.ts`/`.mts`/`.mjs`; veja `.prettierignore`) e `npm run format:check`, que deve passar junto com os testes.
- **Sem ESLint, por ora:** o `typescript-eslint` não carrega com o TypeScript 7 (a montagem lado a lado com o TS 6
  foi testada na etapa 7 e tomou o binário `tsc`). Fica adiado até o `typescript-eslint` suportar o TS 7 estável.
  Até lá, "sem `as` nem `any` em `src/`" é conferido por `grep` e revisão.
  - São **testes de caracterização**: registram o comportamento HTTP atual (status, corpo inteiro, efeitos no estoque
    e nos valores gravados). Testam só pelo HTTP. Os `test/*.test.ts` importam só de `./helpers`; não importe `services`,
    `domain` nem `db` neles. Só `test/helpers.ts` e `test/setup.ts` montam o app (`createApp` + `abrirBanco`): cada arquivo roda
    num processo com banco temporário próprio; o `loja.db` não é tocado. Para falhas do banco, `appComBanco(sql)` monta
    um app sobre um banco temporário quebrado de propósito (`DROP TABLE`, trigger com `RAISE(ABORT, ...)`).
  - Testes com nome iniciado por `[atual]` registram bugs ou divergências conhecidos, como são hoje. Corrigir um deles
    é mudança de comportamento: faça numa change própria, alterando o teste junto. Liste-os com `grep -rn "\[atual\]" test`.
  - Lacunas que o HTTP não alcança ficam como `it.todo`.
  - **Testes de domínio** (`test/dominio/*.test.ts`): unitários das funções puras de `src/domain/`, e importam só de lá.
    Complementam os de caracterização, não os substituem.
- Para verificar à mão sem sujar o banco local, use um banco descartável: `DB_PATH=/tmp/loja-teste.db PORTA=3999 npm start`.
- O README é a referência da API para quem a consome (rotas, payloads, respostas, erros, exemplos).
  Em caso de dúvida, a fonte da verdade das rotas continua sendo `src/app.ts` + `src/http/routes/`.

## Mapa

- `src/server.ts`: entrypoint (lê `PORTA`/`DB_PATH`, abre o banco, `listen`).
- `src/app.ts`: `createApp({ db })`: `express.json()`, log e a cadeia `criarRepositorios(db)` → `criarServices(r)` →
  routers (`/produtos`, `/frete`, `/clientes`, `/pedidos`, `/relatorios`). O `db` é sempre injetado: nenhum módulo
  abre conexão sozinho. Só os repositories são injetados; domínio e schemas são importados direto.
- Fluxo: `HTTP → route (validar + controller + falhas) → controller → service → domain / repositories`.
- `src/http/routes/`: um router por recurso, `criarXRouter(services)`; cada rota é `validar(...)` (se houver
  entrada), o controller e, por último, `falhas({ padrao, ...fases })` com as mensagens 500 da rota.
- `src/http/controllers/`: leem a entrada validada (`validado(req, origem, schema)`), chamam o service e respondem
  o sucesso. O *presenter* do resumo (`apresentarResumo`, linhas `R$ x.xx`) fica aqui.
- `src/http/middlewares/`: `validar.ts` (aplica um schema e responde o primeiro problema no formato da rota;
  `validado(req, origem, schema)` reaplica o schema para entregar o valor parseado e tipado ao controller), `erros.ts` (`tratarErros(formato)` → `falhas(mensagens)`: erro
  de domínio → 404/400 com a mensagem do erro; `FalhaDoBanco(fase)` → 500 com a mensagem da fase; outro erro → 500
  com `padrao`) e `log.ts` (`<ISO> <METODO> <URL>`).
- `src/http/schemas/`: schemas Zod da entrada (corpo, query e `:id`), com as mensagens de erro do projeto. A regra
  única de CEP está em `cep.ts` (saída sem espaços e sem hífen); o `subtotal` do `/frete` sai como número.
- `src/services/`: casos de uso (`criarServices(r)`): `produtos`, `clientes`, `frete`, `pedidos` (criar, buscar,
  resumo, cancelar) e `relatorio`. Não conhecem HTTP. `erros.ts`: `FalhaDoBanco(fase, causa)`.
- `src/repositories/`: `produtos`, `clientes` e `pedidos` (`criarRepositorios(db)`), o único lugar com SQL além do
  schema. Métodos `async`; `pedidos.criar` e `pedidos.cancelar` são transacionais. Cada consulta tipa parâmetros e
  linha no genérico do `better-sqlite3` (`db.prepare<[parametros], Linha>(sql)`), sem `as`; quem garante a linha é o
  schema de `src/db/`.
- `src/domain/tipos.ts`: tipos de domínio (`Produto`, `Cliente`, `Pedido`, `ItemPedido`), com `tipo` e `status` como
  `string` (o banco aceita qualquer texto); `TipoConhecido` só confere os literais de `REGRAS`/`TIPOS_RELATORIO`. Os
  tipos de consulta (`PedidoComCliente`...) e de gravação (`NovoPedido`...) ficam nos repositories.
- `src/domain/precos/`: domínio de preços, puro (sem I/O): `arred2` (2 casas, como `toFixed(2)`), `frete`, `subtotal`,
  `total` e o desconto. As regras de cada tipo são dados (`REGRAS`), e as políticas `PEDIDO` (canônica), `RESUMO`
  e `RELATORIO` combinam regras e arredondamento (`desconto(politica, tipo, subtotal, quantidade)`).
- `src/domain/pedido.ts`: ciclo de vida (`StatusPedido`, `podeCancelar`). `src/domain/erros.ts`: `NaoEncontrado`,
  `EstoqueInsuficiente`, `TransicaoInvalida` (só a mensagem; o status fica no tratador HTTP).
- `src/db/index.ts`: `abrirBanco(arquivo)`: conexão (`better-sqlite3`), schema e seed (só em banco novo).
- `docs/openapi.yaml`: contrato OpenAPI 3.0.3 das rotas (escrito à mão, estático; não é servido pela API).
- `docs/refatoracao.md`: roteiro da refatoração (etapas, ordem, decisões tomadas e em aberto, registro de andamento).
- `test/`: testes de caracterização em TypeScript (`*.test.ts`, um arquivo por área), `setup.ts` e `helpers.ts`;
  `test/dominio/`: testes unitários do domínio.
  Configuração em `vitest.config.mts`, `tsconfig.json` (editor e typecheck de `src/` + `test/`) e `tsconfig.build.json`
  (build de `src/` para `dist/`). Os dois têm `strict` e os flags extras (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`/`Parameters`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`); sem `allowJs`: só `.ts` em `src/`.

## Regras de negócio

A fonte canônica é a criação de pedido (`POST /pedidos`, com a política `PEDIDO` de `src/domain/precos/`): é ela que
grava o valor cobrado. Itens marcados *a confirmar* ainda não foram validados com o negócio; **pergunte antes de alterá-los**.

- **Preço:** `total = subtotal - desconto + frete`. O preço do produto é copiado para
  `itens_pedido.preco_unitario` na criação; pedidos antigos não mudam se o preço mudar.
- **Desconto por `clientes.tipo`:**
  - `comum`: 5% se subtotal >= R$ 500 *(a confirmar: o resumo do pedido usa > R$ 500)*
  - `vip`: 10% sobre qualquer valor *(a confirmar: um comentário antigo fala em "só acima de R$ 200")*
  - `atacado`: 15% se a soma das quantidades dos itens for >= 10
  - outros tipos: sem desconto
- **Frete** (calculado sobre o subtotal **antes** do desconto, acordo com o comercial, não alterar):
  - subtotal >= R$ 300: grátis
  - senão, pelo 1º dígito do CEP **do cadastro do cliente**: 0-3 → R$ 15, 4-7 → R$ 30, 8-9 → R$ 20
- **Estoque:** baixado na criação do pedido; devolvido ao cancelar. Pedido sem estoque suficiente → 400.
- **Ciclo de vida:** `criado` → `cancelado` (só a partir de `criado`). Não existem outros status.
- **Pedidos são cancelados, nunca excluídos.** O `DELETE` foi desativado de propósito; não reative.
- Cliente cadastrado via API é sempre `comum`; não há endpoint para mudar o tipo.
- CEP: texto com 5 dígitos, hífen opcional e 3 dígitos (espaços nas pontas ignorados), armazenado sem hífen.

## Armadilhas

- **Políticas de preço divergentes.** O desconto é recalculado em `GET /pedidos/:id/resumo` e
  `GET /relatorios/vendas` (em vez de ler `pedidos.desconto`), com políticas próprias em `src/domain/precos/descontos.ts`:
  `RESUMO` (`comum` só com `> 500`) e `RELATORIO` (`Math.round` e só os tipos de `TIPOS_RELATORIO`). Para mudar uma
  regra, mude `REGRAS` (vale para as três); não unifique nem "conserte" uma política sem decisão do negócio.
- **Rota sem `falhas(...)` no fim**: no Express 5, a rejeição do controller vai para o próximo tratador de erro; sem o
  `falhas(...)` da rota, vira a página HTML de 500 do Express, em vez do JSON da rota (spec `falhas-do-banco`).
  Não há tratador no nível do app de propósito: o JSON malformado continua com o 400 em HTML do Express (há teste).
- Formato de erro inconsistente: `{erro}` em todas as rotas, menos `/clientes`, que usa `{error}`. Cada router
  escolhe o seu com `tratarErros('erro' | 'error')` e o mesmo formato nos `validar(...)`.
- **Query parser fixado em `extended`** em `src/app.ts` (`app.set('query parser', 'extended')`). O padrão do
  Express 5 (`simple`) não entende colchetes e faria `?busca[x]=` listar todos os produtos em vez de
  `400 Busca invalida`. Não remova sem uma change de contrato.

## Convenções

- Domínio e mensagens em português (sem acentos nas mensagens de erro).
- Código novo: em TypeScript (`const`, arrow functions, factories `criarX(...)` que devolvem objetos, sem classes
  além dos erros) e **SQL sempre parametrizado com `?`**.
- **Sem `as` nem `any` em `src/`** (nem o `any` que vem de biblioteca usado como valor): tipe pelo genérico, pelo
  schema (`z.output`) ou estreite um `unknown`. Enquanto o ESLint está adiado, confira com
  `grep -rnE " as [A-Z(]|: any|as any" src`.
- **Camadas:** route → controller → service. Rotas novas vão em `src/http/routes/` (`criarXRouter(services)`), com o
  controller em `src/http/controllers/` e o caso de uso em `src/services/`, registrado em `criarServices`. Não abra
  conexão fora de `src/server.ts` e dos testes.
  - **Controller só chama service**: sem `try`, sem cálculo, sem repository; lê a entrada com `validado(...)` e
    responde o sucesso. Toda rota termina com `falhas({ padrao: '<mensagem 500>' })`.
  - **Service lança erros tipados** (`src/domain/erros.ts`) para 404/400 e deixa a falha do banco seguir crua (vira
    `padrao`). Só quando a rota tem mais de uma mensagem 500, o service envolve a fase com
    `throw new FalhaDoBanco('<fase>', erro)`, e a rota mapeia a fase (`falhas({ padrao, itens: '...' })`).
- **Regra de preço só em `src/domain/precos/`** (funções puras, sem I/O nem Express), importada pelos services.
  Controllers e services não calculam desconto nem frete e não arredondam à mão (o texto `R$ x.xx` das linhas do
  resumo é apresentação, no controller); uma divergência é uma política com nome. Regras de ciclo de vida ficam em
  `src/domain/pedido.ts`.
- **SQL só em `src/repositories/`** (e o schema em `src/db/`), sempre com `?`. Só os services chamam os repositories.
  Gravações com mais de um comando vão numa `db.transaction` dentro do repository (a função da transação do
  `better-sqlite3` é síncrona).
- **Validação de entrada só por schema Zod** em `src/http/schemas/`, aplicada com `validar()` no router. O controller
  usa a saída do parse (`validado(req, origem, schema)`, que reaplica o schema), com os `transform` do schema (CEP normalizado, `subtotal`
  numérico); ids do path continuam texto. Controllers e services não validam entrada à mão; os services ficam com as
  regras que dependem do banco. A resposta usa só o primeiro problema, com mensagem do projeto (nunca do
  Zod) no formato da rota. Ausente/`null` → "obrigatorio"; tipo ou formato errado → "invalido"; ids no path só com
  dígitos, senão o 404 da rota. Campos extras são ignorados. No Zod 4, `z.unknown().refine()` torna a chave
  obrigatória: envolva com `z.optional`.
- **JSDoc em português** (`/** ... */`, sem acentos, como os demais comentários) em toda função e rota nova:
  entradas, resposta de sucesso e erros com status. Divergências entre cópias de regras são marcadas com
  `@todo Diverge de <fonte canônica>: ...` (e `(a confirmar)` quando dependem do negócio);
  liste-as com `grep -rn "Diverge de" --include='*.js' --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist .`.
- Mudanças de comportamento passam pelo OpenSpec: `/opsx:explore` → `/opsx:propose` → `/opsx:apply`.
  Specs (quando existirem) ficam em `openspec/specs/`.
- **Refatoração:** as changes de refatoração seguem `docs/refatoracao.md`. Cada uma cita a etapa, respeita o escopo
  e as decisões registradas (só a etapa 3 altera testes de caracterização) e, na mesma change, atualiza o roteiro:
  o registro de andamento e qualquer decisão que tenha mudado.
- **Mantenha este arquivo atualizado:** ao mudar regras de negócio, comandos ou convenções, atualize o `AGENTS.md` na mesma mudança.
- Ao mudar uma regra ou rota, atualize também o `README.md`, o JSDoc afetado e o `docs/openapi.yaml` na mesma mudança.
