# Loja API — contexto para agentes

API REST interna de pedidos de uma loja de informática/periféricos.
Node 22 + Express 4 + SQLite3 (callbacks, sem ORM), em transição de JS para TypeScript. Uso interno, **sem autenticação**.

## Rodar e verificar

- `npm install` e `npm start`. O `start` compila antes (`prestart` → `npm run build`, `tsc` para `dist/`) e roda
  `node dist/server.js`; por isso exige as devDependencies instaladas. `dist/` não é versionado.
  Variáveis: `PORTA` (padrão 3000), `DB_PATH` (padrão `./loja.db`).
- Se o arquivo do banco não existe, `abrirBanco` (`src/db`) cria o schema e insere dados de exemplo (produtos e clientes).
  Apagar `loja.db` zera os dados: **pergunte antes de apagar**.
- **Testes:** `npm test` (Vitest + supertest), `npm run typecheck` (`tsc --noEmit` do editor e do build; o Vitest não checa tipos) e
  `npm run test:coverage`. Exigem Node >= 22.12 (o `.nvmrc` atende). Rode `npm test` antes e depois de qualquer mudança.
  - São **testes de caracterização**: registram o comportamento HTTP atual (status, corpo inteiro, efeitos no estoque
    e nos valores gravados). Testam só pelo HTTP. Os `*.test.ts` importam só de `./helpers`; não importe `utils`, `descontos`
    nem `db` neles. Só `test/helpers.ts` e `test/setup.ts` montam o app (`createApp` + `abrirBanco`): cada arquivo roda
    num processo com banco temporário próprio; o `loja.db` não é tocado.
  - Testes com nome iniciado por `[atual]` registram bugs ou divergências conhecidos, como são hoje. Corrigir um deles
    é mudança de comportamento: faça numa change própria, alterando o teste junto. Liste-os com `grep -rn "\[atual\]" test`.
  - Lacunas que o HTTP não alcança ficam como `it.todo`.
- Para verificar à mão sem sujar o banco local, use um banco descartável: `DB_PATH=/tmp/loja-teste.db PORTA=3999 npm start`.
- O README é a referência da API para quem a consome (rotas, payloads, respostas, erros, exemplos).
  Em caso de dúvida, a fonte da verdade das rotas continua sendo `src/app.ts` + `src/routes/`.

## Mapa

- `src/server.ts`: entrypoint (lê `PORTA`/`DB_PATH`, abre o banco, `listen`).
- `src/app.ts`: `createApp({ db })`, middlewares (`express.json()`, log) e montagem dos routers. O `db` é sempre
  injetado: nenhum módulo abre conexão sozinho; os routers são factories `createXRouter(db)`.
- `src/routes/legado.js`: rotas de produtos, `/frete`, `/pedidos/:id/resumo`, `/relatorios/vendas`, `/pedidos/:id/cancelar`.
- `src/routes/clientes.js`, `src/routes/pedidos.js`: rotas já migradas para router por recurso.
- `src/descontos.js`: desconto por tipo de cliente (`desconto_<tipo>`, despacho dinâmico).
- `src/utils.js`: validação de CEP, `calcula_frete`, `buscar_cliente(db, id, cb)`.
- `src/db/index.js`: `abrirBanco(arquivo)`: conexão, schema e seed.
- `docs/openapi.yaml`: contrato OpenAPI 3.0.3 das rotas (escrito à mão, estático; não é servido pela API).
- `docs/refatoracao.md`: roteiro da refatoração (etapas, ordem, decisões tomadas e em aberto, registro de andamento).
- `test/`: testes de caracterização em TypeScript (`*.test.ts`, um arquivo por área), `setup.ts` e `helpers.ts`.
  Configuração em `vitest.config.mts`, `tsconfig.json` (editor e typecheck de `src/` + `test/`) e `tsconfig.build.json`
  (build de `src/` para `dist/`, `allowJs`: o código legado é JS e os módulos novos nascem em `.ts`).

## Regras de negócio

A fonte canônica é a criação de pedido (`POST /pedidos`, em `src/routes/pedidos.js`): é ela que grava
o valor cobrado. Itens marcados *a confirmar* ainda não foram validados com o negócio; **pergunte antes de alterá-los**.

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
- CEP: 8 dígitos, hífen opcional, armazenado sem hífen.

## Armadilhas

- **Regras de preço duplicadas.** O desconto é recalculado em `POST /pedidos`, `GET /pedidos/:id/resumo`
  e `GET /relatorios/vendas` (em vez de ler `pedidos.desconto`); o frete existe em `src/routes/pedidos.js`
  e em `utils.calcula_frete`. As cópias já divergiram. Ao mudar uma regra, alinhe todas ou pergunte.
- **SQL concatenado** em código legado (busca de produtos, resumo, `buscar_cliente`, `POST /pedidos`).
  Não copie esse padrão.
- **Sem transação** na criação/cancelamento de pedido; operações em loop com contador de callbacks.
- Formato de erro inconsistente: `{erro}` no código legado, `{error}` em `src/routes/clientes.js`.

## Convenções

- Domínio e mensagens em português (sem acentos nas mensagens de erro).
- Código novo: em TypeScript, no estilo de `src/routes/clientes.js` (`const`, arrow functions, `express.Router`) e
  **SQL sempre parametrizado com `?`**.
- Rotas novas vão em `src/routes/`, como factory que recebe o `db`; não abra conexão fora de `src/server.ts` e dos testes.
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
