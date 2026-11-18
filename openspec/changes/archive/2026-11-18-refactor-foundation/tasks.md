# Tasks

Regra para todo o arquivo: `git mv` num passo separado da edição do conteúdo, e `npm test`
(88 passando, 8 todo) ao fim de cada grupo. Rodar com Node 22 (`.nvmrc`).

## 1. Linha de base e ferramentas

- [x] 1.1 Rodar `npm test` e `npm run typecheck` antes de qualquer mudança e verificar 88 passando, 8 todo e typecheck limpo
- [x] 1.2 Adicionar `@types/express@4` às devDependencies e verificar com `npm ls @types/express` (nenhuma dependência de produção muda em `package.json`)
- [x] 1.3 Criar `tsconfig.build.json` (nodenext, `allowJs`, `checkJs: false`, `strict`, `rootDir: src`, `outDir: dist`), incluir `src/` no `tsconfig.json`, adicionar `dist/` ao `.gitignore` e verificar que `npm run typecheck` continua limpo

## 2. Movimentos (sem mudar conteúdo)

- [x] 2.1 `git mv db.js src/db/index.js`, `git mv utils.js descontos.js src/`, `git mv routes/clientes.js routes/pedidos.js src/routes/` e `git mv app.js src/routes/legado.js`, ajustando só os caminhos dos `require`, o import de `test/helpers.ts` (`../src/routes/legado`) e o caminho do `createRequire` em `test/setup.ts`; verificar com `npm test` e com `git status` mostrando os arquivos como `renamed`

## 3. Fim do singleton: factories e `createApp`

O singleton sai de uma vez neste grupo: entre as tasks os testes podem falhar; o grupo termina com `npm test` passando.

- [x] 3.1 Transformar `src/db/index.js` em `abrirBanco(arquivo)`, com a mesma regra de seed (só em arquivo novo) e sem ler `DB_PATH`; JSDoc com entradas e retorno
- [x] 3.2 Mudar `buscar_cliente(id, cb)` para `buscar_cliente(db, id, cb)` em `src/utils.js`, sem `require('./db')`, atualizando o JSDoc
- [x] 3.3 Exportar `createClientesRouter(db)` e `createPedidosRouter(db)` em `src/routes/` (pedidos repassa o `db` para `buscar_cliente`), com JSDoc da factory
- [x] 3.4 Transformar `src/routes/legado.js` em `createLegadoRouter(db)` (`express.Router()`, `app.` → `router.` nas rotas), removendo `express()`, middlewares, `listen`, `module.exports = app` e o `require` do banco; atualizar o `@file`; manter o comentário do `DELETE` desativado
- [x] 3.5 Criar `src/app.ts` com `createApp({ db })`: `express.json()`, log `<ISO> <METODO> <URL>`, `createLegadoRouter(db)`, `/clientes`, `/pedidos`; JSDoc em português
- [x] 3.6 Mudar `test/helpers.ts` para criar o arquivo temporário, `export const db = abrirBanco(arquivo)` e `createApp({ db })`; mudar `test/setup.ts` para só silenciar o console e, no `afterAll`, fechar esse `db` e apagar o arquivo, sem `DB_PATH` nem `createRequire`; verificar `npm test` (88 passando, 8 todo), `npm run typecheck` limpo e nenhum `loja-test-*.db` sobrando em `os.tmpdir()`

## 4. Entrypoint e scripts

- [x] 4.1 Criar `src/server.ts` (lê `PORTA` padrão 3000 e `DB_PATH` padrão `./loja.db`, `abrirBanco`, `createApp`, `listen` com `Loja rodando na porta N`); verificar com `npm run build` gerando `dist/server.js`
- [x] 4.2 Ajustar `package.json`: `build`, `prestart`, `start` = `node dist/server.js`, `typecheck` rodando as duas configurações, `main` = `dist/server.js`; ajustar `coverage.include` do `vitest.config.mts` para `src/**/*.{js,ts}`; verificar `npm run typecheck` limpo e `npm run test:coverage` listando os arquivos de `src/`

## 5. Verificação do `dist/` (código que roda em produção)

- [x] 5.1 Rodar a suíte uma vez contra `dist/` (alias temporário em `vitest`, sem versionar) e verificar 88 passando; se algum módulo legado falhar em modo estrito, parar e levar ao usuário antes de mudar lógica
- [x] 5.2 Smoke: `DB_PATH=/tmp/loja-teste.db PORTA=3999 npm start`, conferir o log `Loja rodando na porta 3999`, o log de requisição e respostas de `GET /produtos`, `GET /clientes/1`, `GET /frete?cep=01310100&subtotal=100` e `POST /pedidos` iguais às de hoje; apagar o banco descartável no fim

## 6. Documentação e roteiro

- [x] 6.1 Atualizar `AGENTS.md`: comandos (`npm start`/`npm run build`, sem `node app.js`), verificação manual com banco descartável, Mapa com `src/`, regra dos testes (`*.test.ts` só importam de `./helpers`; só `helpers.ts`/`setup.ts` usam `createApp`/`abrirBanco`) e "Rotas novas vão em `src/routes/`"; verificar com `grep -n "app.js\|db.js" AGENTS.md` sem referências aos caminhos antigos
- [x] 6.2 Atualizar `README.md` (comandos, build, `npm start` exigir devDependencies) e o comentário de origem em `docs/openapi.yaml` (`src/`); verificar que os comandos do README rodam como escritos
- [x] 6.3 Atualizar `docs/refatoracao.md`: decisões em aberto da etapa 1 viram decididas (`tsc` → `dist/`, Node 22 mantido e Node 24 revisto na etapa 2), critério com `git diff -M -w`, invariante "nenhum `*.test.ts` muda; só `helpers.ts`/`setup.ts`" no princípio 2, smoke do `dist/` como critério das etapas 3 a 6, `@types/express` 5 no escopo da etapa 2, e registro de andamento da etapa 1 como concluída (`refactor-foundation`)

## 7. Integração final

- [x] 7.1 Verificar `npm test` (88 passando, 8 todo), `npm run typecheck` limpo, nenhum `*.test.ts` alterado (`git diff --stat main -- 'test/*.test.ts'` vazio), o commit dos movimentos mostrando só renames (`git show --stat -M`) e o restante (`git diff -w`) com mudanças só de ligação nas factories
