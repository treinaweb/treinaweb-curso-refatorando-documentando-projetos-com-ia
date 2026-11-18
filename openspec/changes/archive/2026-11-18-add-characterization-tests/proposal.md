# Proposal

## Why

A aplicação vai passar por uma refatoração completa (incluindo, numa etapa futura, a migração para TypeScript) e hoje não tem nenhum teste automatizado: a única verificação é subir a API e chamar os endpoints com `curl` à mão. Antes de mexer no código, é preciso uma rede de segurança que detecte automaticamente qualquer mudança de comportamento observável, inclusive nas partes frágeis e nas divergências já conhecidas.

## What Changes

- Nova suíte de **testes de caracterização** em `test/`, escrita em TypeScript (`*.test.ts`), com **Vitest** e **supertest**, rodando a aplicação em processo e com um banco SQLite temporário por arquivo de teste.
- Os testes cobrem as 11 rotas atuais pelo contrato HTTP (status, corpo e efeitos visíveis pela própria API, como o estoque) e **registram o comportamento de hoje, como ele é**, inclusive bugs e divergências, sem corrigir nada. Os principais:
  - venda acima do estoque quando o mesmo produto se repete no pedido (o estoque fica negativo);
  - `GET /pedidos/:id/resumo` com `> 500` para o cliente `comum` (difere do valor cobrado com R$ 500,00 exatos);
  - `GET /relatorios/vendas` arredondando o desconto com `Math.round`;
  - aspas em `?busca=` e `produto_id` não numérico retornando 500;
  - formatos de erro `{erro}` x `{error}`.
  Esses testes ficam marcados como comportamento atual e apontam para o `@todo Diverge de...` correspondente. Corrigir qualquer um deles será uma mudança separada.
- Única alteração no código de produção: `app.js` passa a exportar o `app` e só chama `app.listen` quando é executado diretamente (`require.main === module`). `node app.js` e `npm start` continuam com o mesmo comportamento.
- Novas devDependencies: `vitest`, `@vitest/coverage-v8`, `supertest`, `@types/supertest`, `typescript` e `@types/node`. Novos arquivos de configuração: `vitest.config.mts` e `tsconfig.json`, usados só pelos testes e pelo editor. O código de produção continua JS e não ganha etapa de build.
- `package.json`: scripts `test`, `test:coverage` e `typecheck`.
- `AGENTS.md` e `README.md`: o modo de verificar passa a ser `npm test`, e a convenção dos testes de comportamento atual fica documentada.

## Capabilities

### New Capabilities

Nenhuma. A mudança acrescenta testes e ferramentas, mas não altera o comportamento observável da API (`skip_specs: true`). A exportação do `app` é interna e não muda nenhuma rota, resposta ou regra.

### Modified Capabilities

Nenhuma.

## Impact

- **Código:** `app.js` (só o final do arquivo: export e `listen` condicional). Rotas, regras, `db.js` e o banco não mudam.
- **Arquivos novos:** `test/**`, `vitest.config.mts`, `tsconfig.json`.
- **Arquivos alterados:** `package.json` e `package-lock.json` (devDependencies e scripts), `AGENTS.md`, `README.md`.
- **Ambiente:** o Vitest 5 exige Node `^22.12.0 || ^24 || >=26`. A aplicação continua rodando com o `engines` atual (`>=20.17.0`), mas `npm test` passa a exigir Node 22.12 ou mais recente, que é o que o `.nvmrc` já indica.
- **API, `docs/openapi.yaml` e regras de negócio:** sem impacto.
- **Refatoração futura:** qualquer mudança de comportamento, intencional ou não, passa a quebrar um teste. Para corrigir uma divergência registrada, é preciso alterar o teste correspondente numa mudança própria.
