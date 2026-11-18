# Design

## Context

Etapa 2 de `docs/refatoracao.md` (veja proposal.md - Why). Situação depois das etapas 1 e 3:

- `src/app.ts` cria o app com `express()`, `express.json()` e o log, e injeta o `db` e os validadores
  nas factories legadas.
- A entrada é validada por schemas Zod. O `objetoOuVazio` já trata o corpo ou a query ausente como
  `{}`, que é exatamente o caso que o Express 5 cria ao deixar o `req.body` como `undefined` sem
  corpo.
- Os spikes, feitos em worktrees descartáveis a partir da `main`:

| Ambiente | Query parser | Testes | Typecheck |
|---|---|---|---|
| Node 22.15 + Express 5.3.0 + `@types/express` 5.0.6 | `simple` (padrão) | 110 passando, 1 falhando (`?busca[x]=cabo` → 200) | limpo |
| Node 22.15 + Express 5.3.0 | `extended` | 111 passando | limpo |
| Node 24.18 + Express 5.3.0, `npm ci` (`sqlite3` por binário pronto) | `extended` | 111 passando | limpo |

## Goals / Non-Goals

**Goals:**
- Express 5 e Node 24 com o contrato HTTP idêntico: nenhum teste alterado.

**Non-Goals:**
- Usar os recursos novos do Express 5 (handlers `async`, tratador de erro centralizado): etapa 6.
- Mudar a pipeline de build (`tsc` → `dist/`), mesmo com a remoção de tipos nativa do Node 24.
- Trocar o driver do SQLite (etapa 4).

## Decisions

### 1. Query parser `extended`, fixado no `createApp`

`app.set('query parser', 'extended')`, logo depois de `express()` e antes de qualquer middleware,
com um comentário que explica o motivo. O `simple` (`node:querystring`) lê `?busca[x]=cabo` como a
chave literal `busca[x]`: a `busca` fica ausente e a rota devolve todos os produtos. O spec
`validacao-entrada` diz que isso deve ser `400 Busca invalida`. Trocar o parser seria uma mudança de
contrato, e só a etapa 3 podia fazer isso.

*Alternativa:* adotar o `simple` e atualizar o teste e o spec (o roteiro recomendava o `simple` só
"se os testes continuarem passando"). Fica possível como change própria de contrato.

### 2. Node 24 na mesma change

`.nvmrc` = `24`, `engines.node` = `>=24.11.0` e `@types/node` `^24`. A decisão foi do usuário. O spike
cobre a combinação Node 24 + Express 5. O valor `>=24.11.0` é uma suposição registrada: é a primeira
versão LTS da linha 24, e qualquer 24 LTS atende ao Vitest 5 (`^24`) e ao `better-sqlite3` 13, uma
das opções da etapa 4 (Node >= 22).

*Alternativa considerada:* uma change própria `upgrade-node-24`, que daria um rollback independente.
Foi descartada pelo usuário.

### 3. O que o Express 5 muda e por que não afeta

| Mudança | Por que não afeta |
|---|---|
| `req.body` `undefined` sem corpo | Os schemas tratam como `{}`, e os handlers só leem o corpo depois da validação |
| `path-to-regexp` novo | Só há rotas simples (`/:id`, `/:id/resumo`, `/:id/cancelar`) |
| `req.query` como getter | Ninguém atribui ao `req.query` |
| Promises rejeitadas no tratador de erro | Nenhum handler é `async` hoje |
| Assinaturas removidas (`res.send(status)`, `res.json(obj, status)`, `app.del`) | Não são usadas (conferir com `grep` na implementação) |

## Risks / Trade-offs

- **[O servidor de produção não ter Node 24]** → o `engines` documenta o requisito e o README diz o
  que instalar. Sem `engine-strict`, o npm só avisa e não bloqueia. Rollback: reverter a change.
- **[Runtime e framework no mesmo diff]** → se algo quebrar em produção, os dois voltam juntos. O
  custo é aceito, e os spikes reduzem o risco.
- **[O `sqlite3` 5.1.7 sem binário pronto em outra plataforma]** → no Linux x64 o binário existe
  (spike). Em outra plataforma, o `node-gyp` compila, desde que haja toolchain. A troca de driver da
  etapa 4 resolve de vez.
- **[Alguém remover a linha do query parser]** → a armadilha fica no `AGENTS.md`, e o teste
  `busca repetida ou como objeto devolve 400` falha.

## Migration Plan

1. Instalar o Node 24 (`nvm install 24`) no ambiente local e no servidor.
2. `npm install` (reinstala o `sqlite3` para a ABI do Node 24) e `npm start`.

Rollback: reverter a change e voltar ao Node 22 (`nvm use 22`, `npm install`).
