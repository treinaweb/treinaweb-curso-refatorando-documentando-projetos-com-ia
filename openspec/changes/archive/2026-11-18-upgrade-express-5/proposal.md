# Proposal

## Why

Esta change implementa a **etapa 2 (Express 5)** de `docs/refatoracao.md`. No Express 5, promises
rejeitadas em handlers e middlewares vão direto para o tratador de erro, e isso é pré-requisito do
`async/await` das etapas 4 a 6. O roteiro também deixou a revisão do Node 24 para esta etapa. Dois
spikes mostraram que dá para fazer as duas coisas juntas sem mudar nenhum teste:
- Node 22.15 com Express 5 e o query parser `extended`: 111 testes passando, typecheck limpo;
- Node 24.18 com Express 5: idem, e o `sqlite3` 5.1.7 instala por binário pronto.

## What Changes

- `express` 4.22.1 → **5.3.0** e `@types/express` 4 → **5** (dev).
- **Query parser fixado em `extended`** (`app.set('query parser', 'extended')` no `createApp`). O
  padrão do Express 5 (`simple`) não entende colchetes e faria `?busca[x]=cabo` responder 200 com todos
  os produtos, em vez de `400 Busca invalida`. Seria uma mudança de contrato, fora desta etapa.
- **Node 24:** `.nvmrc` 22 → 24, `engines.node` `>=20.17.0` → `>=24.11.0` (a primeira 24 LTS; o valor
  atual já estava abaixo do que o Vitest 5 exige) e `@types/node` 22 → 24 (dev).
- Documentação de versões: README, `AGENTS.md` (stack, requisito dos testes e a armadilha do query
  parser) e `docs/refatoracao.md` (decisões da etapa 2 e registro de andamento).
- **Sem mudança de comportamento:** nenhuma rota, status, corpo ou mensagem muda, e nenhum teste é
  alterado.

## Capabilities

### New Capabilities

Nenhuma. Troca de versão do framework e do runtime, sem comportamento observável novo
(`skip_specs: true`).

### Modified Capabilities

Nenhuma. `validacao-entrada` e `busca-produtos` continuam valendo exatamente como estão, e o query
parser `extended` existe justamente para preservar `Busca invalida` para a busca em forma de objeto.

## Impact

- **Dependências:** `express@5`, `@types/express@5`, `@types/node@24`. O `npm audit` cai de 14 para 13
  vulnerabilidades (sai a moderada do Express 4). As restantes são da cadeia do `sqlite3` 5 e saem na
  etapa 4.
- **Runtime:** quem roda a API (máquina local e servidor) passa a precisar do Node >= 24.11.
  `npm install` e `npm start` continuam iguais.
- **Código:** uma linha no `src/app.ts`. Os handlers continuam com callbacks; o `async/await` entra na
  etapa 6.
- **Testes:** nenhum muda. Os 111 passando e 8 todo são o critério.
- **Fora de escopo:** rodar TS direto no Node (o Node 24 remove tipos sem flag, mas trocar a pipeline é
  outra decisão), handlers `async`, troca do driver do SQLite.
