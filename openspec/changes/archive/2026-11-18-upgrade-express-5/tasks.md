# Tasks

Regra para todo o arquivo: nenhum teste é alterado. Se algum falhar, a troca mudou comportamento:
pare e investigue em vez de ajustar o teste.

## 1. Linha de base

- [x] 1.1 No Node 22, rodar `npm test` (111 passando, 8 todo), `npm run typecheck` e `npm audit`, e anotar o total de vulnerabilidades (esperado: 14)

## 2. Node 24

- [x] 2.1 Trocar o `.nvmrc` para `24`, o `engines.node` para `>=24.11.0` e o `@types/node` para `^24`
- [x] 2.2 No Node 24, rodar `npm install` (que reinstala o `sqlite3` para a nova ABI) e verificar `npm test` (111 passando, 8 todo) e `npm run typecheck` limpo

## 3. Express 5

- [x] 3.1 Conferir com `grep` que não são usadas assinaturas removidas no Express 5 (`res.send(` com status numérico, `res.json(` com dois argumentos, `app.del(`, `req.param(`, `res.sendfile`) e verificar que o resultado está vazio em `src/`
- [x] 3.2 Instalar `express@5` e `@types/express@5` e verificar com `npm ls express @types/express`
- [x] 3.3 Adicionar `app.set('query parser', 'extended')` no `createApp`, antes dos middlewares, com o comentário do motivo e o JSDoc do `createApp` atualizado; verificar `npm test` (111 passando, 8 todo, nenhum arquivo de teste alterado: `git diff --stat -- test/` vazio) e `npm run typecheck` limpo
- [x] 3.4 Rodar `npm audit` e verificar que não há vulnerabilidades novas em relação à linha de base (esperado: 13, sem a moderada do Express 4)

## 4. Documentação e roteiro

- [x] 4.1 Atualizar o README (stack "Node 24 + Express 5", "Requer Node 24" no Como rodar e no Testes) e verificar com `grep -n "Node 22\|Express 4" README.md` vazio
- [x] 4.2 Atualizar o `AGENTS.md`: stack, requisito dos testes (Node >= 24.11, o `.nvmrc` atende) e a armadilha nova "query parser fixado em `extended` no `src/app.ts`; o padrão `simple` do Express 5 muda `?busca[x]=`"; verificar com `grep -n "Node 22\|Express 4" AGENTS.md` vazio
- [x] 4.3 Atualizar o `docs/refatoracao.md`:
  - etapa 2 concluída, com o query parser decidido (`extended`, porque o `simple` muda uma resposta) e o Node 24 decidido nesta etapa;
  - etapa 1: nota de que o Node 24 entrou na etapa 2;
  - fato verificado: o `sqlite3` 5.1.7 instala por binário pronto no Node 24.18 (Linux x64);
  - registro de andamento.

## 5. Verificação final

- [x] 5.1 Smoke do `dist/` no Node 24: `DB_PATH=/tmp/loja-teste.db PORTA=3999 npm start`, conferindo o log de início e as respostas de:
  - `GET /produtos?busca[x]=cabo` → 400;
  - `GET /produtos?busca=cabo` → 200;
  - `POST /pedidos` sem corpo → 400 `cliente_id obrigatorio`;
  - `POST /pedidos` válido → 201;
  - `GET /pedidos/abc/resumo` → 404.

  Apagar o banco descartável no fim.
- [x] 5.2 Atualizar a memória local sobre o Node desta máquina (de "forçar v22 no PATH" para v24) e verificar `npm test`, `npm run typecheck` e `git diff --stat main -- test/` vazio
