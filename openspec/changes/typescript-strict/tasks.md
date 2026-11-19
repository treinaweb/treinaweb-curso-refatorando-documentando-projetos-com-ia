# Tasks

Regra para todo o arquivo: nenhuma asserção, nome ou contagem de teste muda. Os testes só são
reformatados (grupo 3). Rodar com Node 24 (`.nvmrc`). Ao fim de cada task que mexe em código,
`npm test` e `npm run typecheck` passam.

**Fallback aplicado (decisão do usuário):** o spike da task 2.1 falhou (o `tsc` passou a ser o TS 6,
veja o design, Decisão 5). O ESLint foi adiado; a change segue com o Prettier e as demais decisões, e
o "sem `as`/`any`" é conferido por `grep`.

## 1. Linha de base

- [x] 1.1 Rodar `npm test` (166 passando, 1 todo), `npm run typecheck` e `npx tsc -v` (7.0.2). Registrar a contagem de `grep -rnE " as [A-Z(]" src` (14 em `src/repositories/`; a exploração contou 15 por incluir um comentário) e dos erros de `npx tsc --noEmit --noUncheckedIndexedAccess -p tsconfig.json` (11).

## 2. Ferramentas: spike, fallback e Prettier

- [x] 2.1 Spike da montagem lado a lado (design, Decisão 5): instalar `typescript` → `npm:@typescript/typescript6@6.0.2`, `typescript7` → `npm:typescript@7.0.2` e as ferramentas de lint, e conferir `npx tsc -v` → `7.0.2`. **Resultado:** falhou (`tsc` → 6.0.3, via `@typescript/old`). Fallback, por decisão do usuário: desinstalar `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier` e `typescript7`, voltar `typescript` para `^7.0.2` e manter só `prettier@3.10.1` (exato). Verificar com `npx tsc -v` → `7.0.2`, `npm ls typescript` → `7.0.2`, `git diff package.json` só com o `prettier`, `npm run typecheck` e `npm test` sem mudança.
- [x] 2.2 Criar `.prettierrc.json` e `.prettierignore` (Decisão 7) e os scripts `format` e `format:check`. Verificar com `npx prettier --list-different .`, que deve listar os 13 arquivos medidos no design e nenhum `.md`, `.yaml` ou `.json`.
- [x] 2.3 Documentar: no `AGENTS.md` (Rodar e verificar), `npm run format` e `npm run format:check` entre os comandos, e que o ESLint está adiado até o `typescript-eslint` suportar o TS 7 estável (o "sem `as`/`any`" fica por `grep` e revisão); no README (Testes), os dois scripts. Verificar com `grep -n "format:check" AGENTS.md README.md`.

## 3. Reformatação (commit próprio)

- [x] 3.1 Rodar `npm run format` sem nenhuma outra mudança no working tree além dos grupos 1 e 2 já commitados ou separados. Verificar com `npm run format:check` limpo, `npm test` (166, 1 todo, com os mesmos nomes: comparar `npx vitest list` antes e depois) e `git diff --stat`, que deve listar só os 13 arquivos. Conferir no diff que só há quebras de linha e os literais do seed (`50.00` → `50.0`).
- [x] 3.2 Fazer o commit da reformatação sozinha (`style: format code with prettier`), **com a autorização do usuário**: o grupo 2 vai num commit anterior (`build: add prettier`), e o restante da change depois. Verificar com `git show --stat HEAD`, que deve ter só os arquivos reformatados.

## 4. Flags do compilador

- [x] 4.1 Ligar os flags extras e remover `allowJs`/`checkJs` nos dois `tsconfig` (Decisão 1). Corrigir `src/services/relatorio.ts` (grupo obtido uma vez com `??=`, itens sem indexação insegura, mesma sequência de somas e arredondamentos) e `src/http/middlewares/validar.ts` (ramo explícito e documentado como inalcançável para `issues[0]`). Verificar com `npm run typecheck` limpo e `npx vitest run test/relatorio.test.ts test/pedidos.test.ts` (relatório com os mesmos centavos, inclusive o `[atual]` do `Math.round`, e validação com as mesmas mensagens).

## 5. Tipos e casts

- [x] 5.1 Criar `src/domain/tipos.ts` (Decisão 3) com `TipoConhecido`, `Produto`, `Cliente`, `Pedido` e `ItemPedido`, com JSDoc. Os repositories, services e controllers passam a importar de lá; os tipos de consulta e de gravação continuam nos repositories. Em `descontos.ts`, `satisfies` com `TipoConhecido` nas entradas de `REGRAS` e de `TIPOS_RELATORIO`, mantendo os tipos públicos. `podeCancelar` vira `status is 'criado'`. `@todo` em `quantidadeTotal` (Decisão 8). Verificar com `npm run typecheck`, `npx vitest run test/dominio` e `grep -rn "from '../repositories/\(produtos\|clientes\|pedidos\)'" src/services src/http`, que só deve encontrar tipos de consulta.
- [x] 5.2 Trocar os 14 `as` dos repositories pelos genéricos `db.prepare<Parametros, Linha>(...)`, inclusive nos `.run` e nas transações (Decisão 2). Atualizar o JSDoc dos repositories (o tipo da linha é garantido pelo schema de `src/db/`). Verificar com `grep -rnE " as [A-Z(]" src` vazio, `npm run typecheck` e `npm test`.
- [x] 5.3 Trocar `validado(res, origem, schema)` por `validado(req, origem, schema)`, que reaplica o schema, e tirar a gravação em `res.locals` do `validar` (Decisão 4). Atualizar os controllers de clientes, produtos, frete e pedidos e o JSDoc do `validar`. Anotar `erro: unknown` no tratador de `erros.ts`. Verificar com `grep -rn "res.locals" src` vazio, `npm run typecheck` e `npm test`.
- [x] 5.4 Atualizar o `AGENTS.md` (Mapa e Convenções): `src/domain/tipos.ts`; os repositories com genéricos e sem `as`; `validado(req, ...)` reaplicando o schema; nenhum `as` nem `any` em `src/` (conferido por `grep`, enquanto o ESLint está adiado); os flags extras e o fim do `allowJs` nas notas do `tsconfig`. Verificar com `grep -n "res.locals\|allowJs" AGENTS.md`, que só deve mostrar a menção histórica, se houver.

## 6. Roteiro e verificação final

- [x] 6.1 Atualizar o `docs/refatoracao.md`:
  - invariante 2 com a exceção da formatação mecânica (etapa 7);
  - etapa 7 concluída, com as decisões (flags extras, genéricos do `prepare`, tipos de domínio com `string` honesto, `validado` reaplicando o schema, revendo a etapa 6, Prettier, `quantidadeTotal` mantido) e a resposta à decisão em aberto: formatação adotada; ESLint adiado, com o resultado do spike lado a lado e a condição para retomar (o `typescript-eslint` suportar o TS 7 estável);
  - registro de andamento.

  Verificar com `grep -n "typescript-strict" docs/refatoracao.md`.
- [x] 6.2 Rodar `npm test` (166, 1 todo), `npm run typecheck`, `npm run format:check` e `npm run test:coverage`. Conferir `grep -rn ": any\|as any" src`, `grep -rnE " as [A-Z(]" src` e `grep -rn "res.locals" src` vazios, `find src -name '*.js'` vazio e `npm ls typescript` → `7.0.2`.
- [x] 6.3 Smoke do `dist/` com um banco descartável (`DB_PATH` em `/tmp`, porta 3999): `npm start` sobe; `GET /produtos`, `GET /frete?cep=01310-100&subtotal=100` → 200 (frete 15); `POST /clientes` com CEP `" 01310-100 "` → 201 com `01310100`; `POST /pedidos` → 201; `GET /pedidos/<id>/resumo` → 200; `GET /relatorios/vendas` → 200; `GET /clientes/999` → 404 `{ error }`. Parar o servidor pelo PID (`ss -ltnp`) e apagar o banco descartável.
