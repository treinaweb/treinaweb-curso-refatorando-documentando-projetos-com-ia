# Proposal

## Why

Esta change implementa a **etapa 1 (Fundação)** de `docs/refatoracao.md`. As etapas seguintes (Zod,
Express 5, repositories, domínio, services, TS estrito) precisam de um lugar definitivo para o código
(`src/`), de uma forma de rodar TypeScript e de um `db` que possa ser injetado. Hoje o banco é um
singleton aberto no `require` de `db.js` e carregado diretamente por quatro módulos (`app.js`, `utils.js`,
`routes/clientes.js`, `routes/pedidos.js`). Com isso não dá para montar o app com outro banco, e os
testes dependem de `DB_PATH` + cache do `require` para escolher e fechar a conexão.

## What Changes

- Os módulos atuais vão para `src/` com `git mv`, preservando o histórico:
  `db.js` → `src/db/index.js`, `utils.js` → `src/utils.js`, `descontos.js` → `src/descontos.js`,
  `routes/*.js` → `src/routes/`, e as rotas legadas de `app.js` → `src/routes/legado.js`.
- **Injeção do `db` por factories**: os routers passam a ser `createXRouter(db)` e
  `buscar_cliente` passa a receber o `db` (`buscar_cliente(db, id, cb)`). O singleton deixa de existir;
  `db.js` vira `abrirBanco(arquivo)`, com a mesma regra de seed (só em banco novo).
- Novos módulos em TypeScript: `src/app.ts` (`createApp({ db })`: `express.json()`, log de requisição,
  routers) e `src/server.ts` (lê `PORTA`/`DB_PATH`, abre o banco, `listen`, mesmo log de início).
- **Pipeline:** compilação com `tsc` para `dist/` (`allowJs`), `npm start` roda `node dist/server.js`.
  Novos scripts `build`; `start`, `typecheck` e a cobertura ajustados. `dist/` no `.gitignore`.
- Nova dependência de desenvolvimento: `@types/express@4`. Nenhuma dependência de produção muda.
  O Node continua no 22.
- Testes: só `test/helpers.ts` e `test/setup.ts` mudam, passando a montar o app com
  `createApp({ db: abrirBanco(<arquivo temporário>) })`. **Nenhum `*.test.ts` muda.**
- Documentação: `AGENTS.md` (comandos, Mapa, regra de imports nos testes), `README.md` (comandos),
  comentário de origem do `docs/openapi.yaml` e `docs/refatoracao.md` (decisões da etapa 1 e registro de
  andamento).

Nenhuma rota, status, corpo de resposta, mensagem ou regra de negócio muda.

## Capabilities

### New Capabilities

Nenhuma. A change é estrutural e não altera comportamento observável (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- **Código:** todos os módulos de produção mudam de lugar; `app.js` deixa de existir na raiz. A lógica
  das rotas não muda (`git diff -M -w` mostra só movimentos e a ligação das factories).
- **Execução:** `npm start` passa a compilar antes (`prestart`), o que exige as dependências de
  desenvolvimento instaladas. `node app.js` deixa de funcionar; o entrypoint é `dist/server.js`.
- **Testes:** os 88 testes e 8 `it.todo` continuam iguais e passando.
- **Dependências:** `@types/express@4` (dev). Sem mudança em `express`, `sqlite3`, Node ou `.nvmrc`.
- **API (README de rotas, `docs/openapi.yaml`):** sem impacto no contrato.
