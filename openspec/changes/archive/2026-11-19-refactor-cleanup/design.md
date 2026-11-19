# Design

## Context

Etapa 8 de `docs/refatoracao.md` (veja proposal.md - Why). Estado verificado em 2026-11-19:

- `npm test` (166 passando, 1 todo), `npm run typecheck`, `npm run format:check` e `npm audit` (0
  vulnerabilidades) já estão limpos. `npm outdated` só mostra o `@types/node` 26, que não deve subir
  (o projeto é Node 24). O `@types/better-sqlite3` 9.6.0 é a versão mais recente dos tipos.
- Referências obsoletas (`grep -rn "app.js\|routes/\|descontos.js\|legado\|utils\|copia propria" test src`,
  sem contar `src/http/routes/`):

  | Arquivo | Linha | Texto atual |
  |---|---|---|
  | `test/resumo.test.ts` | 4 | `GET /pedidos/:id/resumo (app.js) recalcula ...` |
  | `test/resumo.test.ts` | 61 | nome: `'atacado usa descontos.js (15% com 10 unidades)'` |
  | `test/resumo.test.ts` | 80 | `@todo Diverge de POST /pedidos (app.js). O resumo aplica ...` |
  | `test/relatorio.test.ts` | 4 | `GET /relatorios/vendas (app.js). ...` |
  | `test/relatorio.test.ts` | 6 | `O relatorio nao usa descontos.js: tem uma copia propria das regras.` |
  | `test/relatorio.test.ts` | 37 | `@todo Diverge de POST /pedidos (app.js). O relatorio ...` |
  | `test/pedidos.test.ts` | 4 | `POST /pedidos (routes/pedidos.js) e a fonte canonica ...` |
  | `test/clientes.test.ts` | 4 | `routes/clientes.js usa o formato de erro { error } (o legado usa { erro })` |
  | `test/setup.ts` | 5 | `... codigo legado nao fazem parte do contrato` |
  | `test/helpers.ts` | 5 | `... nao importam modulos internos (utils, descontos, db)` |
  | `src/domain/precos/dinheiro.ts` | 6 | `... exatamente como o codigo legado:` |
  | `src/domain/precos/pedido.ts` | 3 | `... sequencia de calculo do codigo legado ...` |
  | `src/domain/precos/descontos.ts` | 106 | `... o string vem do codigo JS legado ...` |

- `zod` está como `^4.6.7` no `package.json` (instalado 4.6.7); `express` (`5.3.0`) e
  `better-sqlite3` (`13.2.0`) são exatos.
- `AGENTS.md`: a convenção "Refatoração" manda seguir o roteiro, e o Mapa descreve o roteiro como vivo.
  "Specs (quando existirem)" está defasado (existem `busca-produtos`, `falhas-do-banco`,
  `gravacao-pedidos` e `validacao-entrada`). As 4 Armadilhas continuam valendo.
- O roteiro guarda os pendentes: o ESLint adiado (etapa 7), "Fora da refatoração" e o `TODO` dos
  índices (etapa 4, fora de escopo).

## Goals / Non-Goals

**Goals:**
- Nenhuma referência a arquivo ou módulo que não existe mais, em `src/` e `test/`.
- Os pendentes ficam visíveis a partir do `AGENTS.md`.
- O roteiro termina explicitamente encerrado, no mesmo caminho.

**Non-Goals:**
- Mudar qualquer asserção ou comportamento.
- Resolver qualquer pendente.
- Reescrever o histórico das etapas no roteiro (só a etapa 8, o cabeçalho e a nota de arquitetura
  mudam).

## Decisions

### 1. Texto dos testes (todas as referências, decisão do usuário)

Cada comentário passa a citar o módulo atual, sem mudar o sentido:
- `(app.js)` → o caminho atual da regra: `src/services/pedidos.ts` (resumo) ou
  `src/services/relatorio.ts` (relatório). Nos `@todo Diverge de`, a fonte passa a ser a política com
  nome (`RESUMO`, `RELATORIO`) em `src/domain/precos/descontos.ts`.
- `relatorio.test.ts:6` → "O relatório usa a política `RELATORIO` (`src/domain/precos/descontos.ts`)",
  porque a "cópia própria das regras" deixou de existir na etapa 5.
- `routes/pedidos.js` → `src/services/pedidos.ts`; `routes/clientes.js` →
  `src/http/routes/clientes.ts`, e "o legado usa `{ erro }`" vira "as demais rotas usam `{ erro }`".
- `setup.ts` e `helpers.ts`: "código legado" e `utils` saem; a lista de módulos internos passa a ser
  `src/` em geral (services, domain, repositories, db).
- **O nome de teste:** `'atacado usa a regra canonica (15% com 10 unidades)'`, que descreve a regra em
  vez do arquivo.

**Verificação:** a `npx vitest list` antes e depois difere em exatamente uma linha (o nome do
`atacado`). O diff dos testes, descontados os comentários (`//`, `/** */`) e aquela string de `it(...)`,
é vazio.

### 2. Comentários de `src/domain/precos/`

"Como o código legado" vira a descrição da regra em si: por exemplo, em `dinheiro.ts`,
"exatamente como `Number(valor.toFixed(2))`, que é o arredondamento gravado nos pedidos existentes".
No `@todo` de `quantidadeTotal`, "vem do código JS legado" vira "vem da versão em JavaScript (antes da
etapa 7)". Nenhum código muda.

### 3. Dependências

- `zod`: `"^4.6.7"` → `"4.6.7"`. Dependências de produção exatas, como as outras duas. As de
  desenvolvimento continuam como estão (`^` nos `@types/*`, `vitest` e `supertest`; `prettier` já é
  exato). A versão instalada é a mesma, então o `package-lock.json` só muda o *range* registrado do
  pacote raiz, se mudar.
- `@types/node` fica na versão maior 24; o `AGENTS.md` registra a regra.

### 4. `AGENTS.md`

- **Pendências** (seção nova, depois de Armadilhas), com um item por linha e o link para o detalhe:
  - ESLint adiado até o `typescript-eslint` suportar o TS 7 estável (`docs/refatoracao.md`, etapa 7);
  - regras de negócio *a confirmar*, registradas pelos testes `[atual]` (`docs/refatoracao.md`, "Fora da
    refatoração", e Regras de negócio acima);
  - unificação do formato de erro (`{erro}` x `{error}`), que muda o contrato;
  - índices no schema (`// TODO criar indices` em `src/db/index.ts`).
- **Convenção "Refatoração"** → "Roteiro concluído: `docs/refatoracao.md` é o registro das decisões
  da arquitetura atual (o porquê de cada camada e de cada exceção). Mudanças novas seguem o OpenSpec
  normalmente; ao rever uma decisão registrada lá, cite a etapa."
- **Mapa:** `docs/refatoracao.md` descrito como histórico (concluído em 2026-11-19).
- **Specs:** "Specs ficam em `openspec/specs/`: `busca-produtos`, `falhas-do-banco`,
  `gravacao-pedidos` e `validacao-entrada`."
- **Nota do `@types/node`** em "Rodar e verificar".

### 5. Roteiro

- **Cabeçalho:** "Concluído em 2026-11-19. Mantido como registro histórico das decisões; os pendentes
  estão na seção Pendências do `AGENTS.md`." O parágrafo "Referência para propor as changes..." vira
  pretérito.
- **"Arquitetura alcançada"**, logo depois de "Arquitetura de destino": a estrutura final de `src/`
  e as diferenças em relação ao planejado, cada uma com a etapa que decidiu:
  - services e repositories como factories (`criarXService`), não classes (etapas 4 e 6);
  - Strategy como regras em dados (`REGRAS`) e políticas com nome (etapa 5);
  - o tratador de erro é por rota (`falhas(...)`), não no app (etapa 6);
  - `domain/tipos.ts` e `domain/erros.ts`, além de `pedido.ts` (etapas 6 e 7);
  - sem ESLint (etapa 7).
- **Etapa 8 concluída,** com as decisões (o roteiro fica como histórico; todas as referências
  obsoletas nos testes; `zod` exato; Pendências no `AGENTS.md`) e a decisão em aberto respondida.
- **Registro de andamento:** etapa 8 concluída.

## Risks / Trade-offs

- **[Mudar o que um teste verifica ao editar texto]** → verificação da Decisão 1: a lista de testes muda
  em uma linha, e o diff sem comentários é vazio.
- **[Remover um aviso que ainda protege]** (risco listado no roteiro) → nenhum aviso sai. O do `DELETE`
  continua no router e no `AGENTS.md`, e os pendentes ganham uma seção própria.
- **[Fixar o `zod` mudar a instalação]** → a versão fixada é a instalada. `npm install` e `npm ls zod`
  conferem.

## Migration Plan

Não há migração. Para reverter, basta um `git revert` da change.
