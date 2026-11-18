# Design

## Context

Etapa 1 de `docs/refatoracao.md` (veja proposal.md - Why). Estado atual relevante:

```
              db.js  (singleton: le DB_PATH, abre e semeia no require)
       +--------+---------+------------------+
       |        |         |                  |
    app.js  utils.js  routes/clientes.js  routes/pedidos.js
    (bootstrap + rotas    (buscar_cliente)     (usa utils.buscar_cliente)
     legadas + listen)
```

- `app.js` monta `express.json()`, o log `<ISO> <METODO> <URL>`, as rotas de produtos e `/frete`, os
  routers `/clientes` e `/pedidos`, e depois resumo, relatório e cancelamento. Só escuta quando é o
  `require.main`.
- Os testes escolhem o banco com `DB_PATH` no `test/setup.ts` e fecham a conexão pegando o singleton do
  cache do `require` (`createRequire`). Só `test/helpers.ts` importa o app; os `*.test.ts` importam de
  `./helpers`.
- `tsconfig.json` (`module: preserve`, `noEmit`) só cobre `test/` e o `vitest.config.mts`.
- Ferramentas: TypeScript 7.0.2, Vitest 5, Node 22.

Um spike (fora do repositório) confirmou que o TS 7 com `module: nodenext` + `allowJs` compila `.ts`
que importam JS CommonJS (`import x = require(...)`) e emite os `.js` legados em `dist/`; o
`node dist/server.js` sobe e responde; o Vitest importa o `src/app.ts` direto, sem build.

## Goals / Non-Goals

**Goals:**
- `createApp({ db })` como único jeito de montar o app; nenhum módulo abre o banco sozinho.
- O código de produção inteiro em `src/`, com histórico preservado.
- `npm start`, `npm test`, `npm run typecheck` funcionando na estrutura nova.

**Non-Goals:**
- Reorganizar as rotas por recurso ou nas camadas `http/` do destino (etapa 6). As rotas legadas
  ficam juntas em `src/routes/legado.js`.
- Converter módulos legados para TS, trocar `var`/callbacks, corrigir o SQL concatenado.
- Node 24, Express 5, troca do driver.

## Decisions

### 1. Injeção do `db` por factories

Cada módulo que usa o banco passa a exportar uma função que recebe o `db`:

| Módulo | Antes | Depois |
|---|---|---|
| `src/routes/clientes.js` | `module.exports = router` | `module.exports = (db) => { ...; return router }` |
| `src/routes/pedidos.js` | `module.exports = router` | `module.exports = function (db) { ...; return router }` |
| `src/routes/legado.js` (era `app.js`) | `app.get(...)` | `function (db) { var router = express.Router(); router.get(...); return router }` |
| `src/utils.js` | `buscar_cliente(id, cb)` | `buscar_cliente(db, id, cb)` (sem `require('./db')`) |
| `src/db/index.js` (era `db.js`) | exporta a conexão | exporta `{ abrirBanco(arquivo) }` |

Os corpos ganham um nível de indentação. Isso impede o Git de detectar o rename num commit só, mesmo
com `-w` (verificado na implementação). Por isso os movimentos vão num commit próprio, antes das
factories, e o critério de "só movimentos e ligação" é verificado por commit: o primeiro só com renames,
o segundo com `git diff -w`. O único ponto de chamada de `buscar_cliente` é `routes/pedidos.js`.
Em `legado.js`, `app.` vira `router.` nas definições de rota; é a ligação, não lógica.

*Alternativas:* `req.app.locals.db` (mexe em todo uso do `db` e mistura HTTP com dados, o que a
etapa 4 desfaz); um holder `init(db)` no módulo (continua sendo singleton com outro nome).

### 2. `abrirBanco(arquivo)` mantém a semântica do seed

`abrirBanco` faz exatamente o que o corpo de `db.js` faz hoje, recebendo o caminho em vez de ler
`DB_PATH`: `existsSync` antes de abrir, `serialize()`, schema + seed só se o arquivo não existia.
Quem lê `DB_PATH` (padrão `./loja.db`) é o `server.ts`. A ordem dos comandos fica garantida pelo
`serialize()`, como hoje, então as consultas dos testes continuam enfileiradas depois do seed.

### 3. `createApp` e a ordem de montagem

`src/app.ts`: `express()` → `express.json()` → log de requisição (mesmo formato) →
`createLegadoRouter(db)` → `/clientes` → `/pedidos`. Retorna o `app`, sem `listen`.

Hoje as rotas legadas estão em dois blocos, antes e depois de `/clientes` e `/pedidos`. Num router só,
todas passam a ser avaliadas antes. Isso não muda nada, porque nenhum caminho se sobrepõe: o router de
pedidos tem `GET /`, `GET /:id` e `POST /`, que não casam com `/:id/resumo` nem com `/:id/cancelar`.
Os testes de resumo, cancelamento e o 404 do `DELETE /pedidos/:id` confirmam.

### 4. Pipeline: `tsc` para `dist/`, Node 22

- `tsconfig.build.json`: `module`/`moduleResolution: nodenext`, `allowJs`, `checkJs: false`, `strict`,
  `rootDir: src`, `outDir: dist`, `include: ["src"]`. O `package.json` continua sem `type`
  (CommonJS).
- `tsconfig.json` (editor + typecheck): passa a incluir `src/` além de `test/`; continua `noEmit`.
- Scripts: `build` = `tsc -p tsconfig.build.json`; `prestart` = `npm run build`;
  `start` = `node dist/server.js`; `typecheck` = `tsc --noEmit && tsc -p tsconfig.build.json --noEmit`
  (as duas configurações resolvem módulos de jeitos diferentes, e o build é o que roda em produção).
  `main` passa a `dist/server.js`.
- `.ts` importa o JS legado com `import x = require('./...')` (`export =`), como no spike.
- `@types/express@4` (dev), porque `app.ts` passa a importar o `express`.
- `vitest.config.mts`: `coverage.include` passa a `src/**/*.{js,ts}`.

*Alternativa:* rodar TS direto no Node (remoção de tipos). Exigiria Node >= 22.18 ou 24 (as versões
instaladas são 22.13/22.15), imports com extensão `.ts` e `erasableSyntaxOnly`; e o `require()` de
`.ts` a partir do JS legado não foi verificado. Fica para quando o Node 24 entrar.

*Node 24:* adiado. A pipeline escolhida não depende dele; a decisão volta na etapa 2, que já mexe em
dependências. `.nvmrc` e `engines` não mudam.

### 5. Testes: só `helpers.ts` e `setup.ts`

- `test/helpers.ts` cria o arquivo temporário (hoje feito no `setup.ts`), exporta `db` e
  `api = () => supertest(app)` com `app = createApp({ db: abrirBanco(arquivo) })`.
- `test/setup.ts` silencia o console e, no `afterAll`, fecha o `db` importado de `./helpers` e apaga o
  arquivo. Somem o `DB_PATH` e o `createRequire`.
- No Vitest, os setup files e o arquivo de teste compartilham o grafo de módulos do worker, então o
  `db` de `setup.ts` é o mesmo do `helpers.ts`. Isso é verificado na implementação (veja Riscos).
- A regra do `AGENTS.md` muda de "não importe `db`" para: os `*.test.ts` só falam HTTP e importam só de
  `./helpers`; apenas `helpers.ts`/`setup.ts` usam `createApp` e `abrirBanco`.

### 6. Ordem dos movimentos

Duas fases. Primeiro só os `git mv` (ajustando caminhos de `require` e os dois arquivos de infra de
teste), com `npm test` passando, para o Git registrar renames puros. Depois a troca do singleton de uma
vez (`abrirBanco`, factories, `buscar_cliente(db, ...)`, `app.ts`, `helpers.ts`/`setup.ts`): não há
estado intermediário útil em que parte dos módulos use o singleton e parte receba o `db`. Por fim
`server.ts` e os scripts.

## Risks / Trade-offs

- **[O `tsc` reescreve o JS legado e acrescenta `"use strict"`]** → o código que roda em produção
  (`dist/`) não é o mesmo que os testes exercitam (`src/`, modo não estrito). → Na implementação, rodar a
  suíte uma vez contra o `dist/` (alias temporário, não versionado) e fazer o smoke de `npm start` num
  banco descartável. O critério de pronto da etapa inclui o smoke. As etapas 3 a 6 repetem o smoke até
  a 7 eliminar o JS.
- **[Setup e teste com instâncias diferentes de `helpers`]** → o `afterAll` fecharia outro banco e o
  arquivo temporário ficaria para trás. → Verificar que nenhum `loja-test-*.db` sobra no `tmpdir`
  depois de `npm test`; se sobrar, mover a criação do banco para o `setup.ts` e expor via módulo próprio.
- **[`npm start` passa a exigir devDependencies]** (`typescript` para o `prestart`) → aceito para uso
  interno; documentado no README. Quem quiser rodar sem build roda `npm run build` antes e
  `node dist/server.js`.
- **[Movimentos quebram imports ou a detecção de rename]** → `git mv` separado das edições, `npm test`
  a cada passo, `git diff -M -w --stat` conferido no fim.
- **[Ordem de montagem num router só]** → sem sobreposição de caminhos (Decisão 3); coberto pelos
  testes existentes.

## Migration Plan

Não há dados nem contrato a migrar. Quem roda a API troca `node app.js` por `npm start` (ou
`npm run build` + `node dist/server.js`). O `loja.db` existente continua sendo usado (`DB_PATH`
padrão igual), sem seed. Rollback: reverter a change.
