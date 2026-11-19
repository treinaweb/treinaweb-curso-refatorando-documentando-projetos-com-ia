# Tasks

Regra para todo o arquivo: nenhuma asserção muda, e o único nome de teste que muda é o da Decisão 1.
Rodar com Node 24 (`.nvmrc`). Ao fim de cada task que mexe em arquivo, `npm test`,
`npm run typecheck` e `npm run format:check` passam.

## 1. Linha de base

- [x] 1.1 Rodar `npm test` (166 passando, 1 todo), `npm run typecheck`, `npm run format:check` e `npm audit` (0 vulnerabilidades). Guardar a `npx vitest list` ordenada no scratchpad. Registrar a saída de `grep -rn "app.js\|routes/\|descontos.js\|legado\|utils\|copia propria" test src | grep -v "http/routes/"` (13 linhas, a tabela do design).

## 2. Texto dos testes e comentários de `src/`

- [x] 2.1 Atualizar os 10 pontos em `test/` (design, Decisão 1): os comentários de `resumo`, `relatorio`, `pedidos`, `clientes`, `setup` e `helpers`, e o nome do teste do `atacado` para `'atacado usa a regra canonica (15% com 10 unidades)'`. Verificar:
  - `npx vitest list` ordenada difere da linha de base em exatamente uma linha (o nome do `atacado`);
  - o diff de `test/`, descontados comentários e a string do `it(...)` renomeado, é vazio;
  - `npm test` (166, 1 todo).
- [x] 2.2 Atualizar os três comentários de `src/domain/precos/` (`dinheiro.ts`, `pedido.ts` e o `@todo` de `quantidadeTotal` em `descontos.ts`), conforme a Decisão 2. Verificar com o `grep` da 1.1, que deve voltar vazio, `git diff -w src` só com linhas de comentário e `npm run typecheck`.

## 3. Dependências

- [x] 3.1 Fixar `zod` em `4.6.7` no `package.json` (Decisão 3) e rodar `npm install`. Verificar com `npm ls zod` → `4.6.7`, `git diff package-lock.json`, que deve mostrar no máximo o *range* do pacote raiz, `npm audit` (0) e `npm test`.

## 4. AGENTS.md e roteiro

- [x] 4.1 Atualizar o `AGENTS.md` (Decisão 4): seção Pendências (ESLint adiado, regras *a confirmar*, formato de erro, índices, cada uma com o link); convenção "Refatoração" reescrita para o roteiro concluído; Mapa com o roteiro como histórico; Specs listando os 4 existentes; nota do `@types/node` em "Rodar e verificar". Verificar com `grep -n "Pendências\|quando existirem" AGENTS.md`: Pendências presente e "quando existirem" ausente.
- [x] 4.2 Atualizar o `docs/refatoracao.md` (Decisão 5): cabeçalho de concluído; parágrafo de abertura no pretérito; "Arquitetura alcançada" com a estrutura final e as diferenças por etapa; etapa 8 concluída, com as decisões e a decisão em aberto respondida (fica como histórico); registro de andamento. Verificar com `grep -n "Concluído em\|Arquitetura alcançada\|refactor-cleanup" docs/refatoracao.md` e com `grep -c "| pendente |" docs/refatoracao.md` → 0.

## 5. Verificação final

- [x] 5.1 Rodar `npm test` (166, 1 todo), `npm run typecheck`, `npm run format:check`, `npm run test:coverage` e `npm audit` (0, como pede o "pronto quando" da etapa). Conferir o `grep` da 1.1 vazio e `git diff --stat main`, que deve mostrar só `test/` (texto), três arquivos de `src/domain/precos/`, `package.json` (e, se mudar, o lock), `AGENTS.md`, `docs/refatoracao.md` e os artefatos da change.
