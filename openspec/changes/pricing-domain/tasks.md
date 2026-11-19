# Tasks

Regra para todo o arquivo: nenhum teste de caracterização (`test/*.test.ts`) é alterado. Rodar com
Node 24 (`.nvmrc`). Ao fim de cada grupo, `npm test` e `npm run typecheck` passam.

## 1. Linha de base

- [x] 1.1 Rodar `npm test` (131 passando, 1 todo) e `npm run typecheck`. Registrar a saída de `grep -rn "0\.05\|0\.1\b\|0\.15\|>= 300" src`; o esperado é 9 linhas: 2 em `descontos.js`, 1 em `utils.js`, 2 em `routes/pedidos.js` (contando a linha de JSDoc) e 4 em `routes/legado.js`.

## 2. Domínio de preços, com testes

- [x] 2.1 Criar `src/domain/precos/dinheiro.ts` (`arred2`), `frete.ts` (`frete`) e `pedido.ts` (`subtotal`, `total`), como na Decisão 1, com JSDoc em português (entradas, retorno e a sequência de cálculo que cada um reproduz). Verificar com `npm run typecheck`.
- [x] 2.2 Criar `src/domain/precos/descontos.ts` com `Regra`, `Politica`, `REGRAS`, `PEDIDO`, `RESUMO`, `RELATORIO` (filtrada por `TIPOS_RELATORIO`), `quantidadeTotal` e `desconto` (Decisão 2):
  - `@todo Diverge de POST /pedidos: ... (a confirmar)` em `RESUMO` e em `RELATORIO`;
  - `@todo ... (a confirmar)` na regra `vip`, com a regra antiga "so acima de 200";
  - o `index.ts` reexporta os quatro módulos.

  Verificar com `npm run typecheck` e com `grep -rn "Diverge de" src/domain`, que deve mostrar as duas políticas.
- [x] 2.3 Criar `test/dominio/precos.test.ts` com os casos da Decisão 5:
  - fronteiras de `comum`, `vip`, `atacado` e frete;
  - as três políticas lado a lado (`comum` 500 → 25/0/25; `vip` 123.45 → 12.35/12.35/12);
  - tipo desconhecido, `constructor`, `toString` e `__proto__` → 0;
  - um tipo novo em `REGRAS` não entra em `RELATORIO`;
  - `arred2(0.015)` → 0.01, igual a `toFixed(2)`;
  - `subtotal` arredondando só no fim, `total` e `quantidadeTotal` com texto.

  Verificar com `npx vitest run test/dominio`, todos passando.

## 3. Rotas usando o domínio (em bloco: os testes de caracterização passam no fim do grupo)

- [x] 3.1 Em `src/app.ts`, fazer `import * as precos from './domain/precos'` e passar o domínio como terceiro argumento de `createPedidosRouter` e `createLegadoRouter`, atualizando o JSDoc de `createApp` (Decisão 4). Verificar com `npm run typecheck`.
- [x] 3.2 Em `src/routes/pedidos.js`, trocar o `require('../descontos')` pelo parâmetro `precos` (Decisão 3):
  - no laço, valida e copia `preco_unitario`;
  - depois do laço, `precos.subtotal`, `precos.desconto(precos.PEDIDO, ...)`, `precos.frete(cliente.cep, subtotal)` e `precos.total`;
  - JSDoc da factory com o parâmetro `precos`;
  - JSDoc do `POST /` apontando para o domínio, sem o `@todo Diverge de utils.calcula_frete` e sem repetir os números da regra, como o `>= 300` (eles ficam só no domínio, para o `grep` da etapa).

  Verificar com `npx vitest run test/pedidos.test.ts`.
- [x] 3.3 Em `src/routes/legado.js`, trocar `descontos` e `utils.calcula_frete` por `precos`:
  - `/frete` com `precos.frete`;
  - resumo com `precos.subtotal`, `precos.desconto(precos.RESUMO, ...)` e `precos.total`, mantendo as linhas `R$ x.xx` na rota;
  - relatório com `precos.desconto(precos.RELATORIO, ...)` e `precos.arred2` no faturamento.

  Atualizar os JSDoc: o `@todo Diverge de` do resumo e do relatório passa a apontar para a política com nome, e o texto deixa de citar `descontos.js` e a cópia própria. Verificar com `npx vitest run test/resumo.test.ts test/relatorio.test.ts test/frete.test.ts`, incluindo os dois `[atual]`.
- [x] 3.4 Remover `src/descontos.js` (`git rm`), `calcula_frete` e `formata_moeda` de `src/utils.js`, e atualizar o `@file` dele. Verificar:
  - `npm test`: 131 de caracterização + os de domínio passando, 1 todo;
  - `npm run typecheck` limpo;
  - `git diff main -- 'test/*.test.ts'` vazio;
  - `grep -rn "0\.05\|0\.1\b\|0\.15\|>= 300" src` só em `src/domain/precos/`;
  - `grep -rn "descontos\|calcula_frete\|formata_moeda" src` vazio, ou só em comentários do domínio que expliquem a origem.

## 4. Documentação e roteiro

- [x] 4.1 `AGENTS.md`:
  - Mapa: sai `src/descontos.js`, entra `src/domain/precos/` (regras como dados e políticas `PEDIDO`, `RESUMO` e `RELATORIO`), `utils.js` só com `validaCep`, e `test/dominio/`;
  - Armadilhas: "Regras de preço duplicadas" vira "Políticas de preço divergentes", com as divergências no domínio, a orientação de mudar regra em `REGRAS` e a de não unificar políticas sem decisão do negócio;
  - Testes: os de caracterização importam só de `./helpers`, e os de domínio (`test/dominio/`) só de `src/domain/`;
  - Convenção: regra de preço só em `src/domain/precos/`, injetada pelo `createApp`.

  Verificar com `grep -n "descontos.js\|calcula_frete" AGENTS.md` vazio.
- [x] 4.2 `docs/refatoracao.md`:
  - etapa 5 concluída, com as decisões: TS injetado, regras como dados e políticas com nome, testes de domínio, `formata_moeda` antecipada;
  - etapa 8 sem `formata_moeda` e com "atualizar o texto dos testes que citam `descontos.js`";
  - "Fora da refatoração" apontando para as políticas, e a regra antiga do VIP para `src/domain/precos/descontos.ts`;
  - registro de andamento.

  Verificar com `grep -n "pricing-domain" docs/refatoracao.md` mostrando a etapa como concluída. README e `docs/openapi.yaml` não mudam; verificar com `grep -n "descontos.js\|calcula_frete\|formata_moeda" README.md docs/openapi.yaml` vazio.

## 5. Verificação final

- [x] 5.1 Rodar `npm test`, `npm run typecheck` e `npm run test:coverage`; o domínio deve ter 100% de linhas. Rodar também `grep -rn "Diverge de" --include='*.js' --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist .`, que deve listar as divergências no domínio e nas rotas.
- [x] 5.2 Smoke do `dist/` com um banco descartável (`DB_PATH` em `/tmp`, porta 3999):
  - `npm start` sobe;
  - `GET /frete?cep=01310-100&subtotal=100` → 15;
  - `POST /pedidos` de um cliente `vip` e de um `comum` → 201, com os valores esperados;
  - `GET /pedidos/<id>/resumo` e `GET /relatorios/vendas` → 200.

  Parar o servidor pelo PID (`ss -ltnp`) e apagar o banco descartável.
