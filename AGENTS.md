# Loja API — contexto para agentes

API REST interna de pedidos de uma loja de informática/periféricos.
Node 22 + Express 4 + SQLite3 (callbacks, sem ORM). Uso interno, **sem autenticação**.

## Rodar e verificar

- `npm install` e `npm start` (ou `node app.js`). Variáveis: `PORTA` (padrão 3000), `DB_PATH` (padrão `./loja.db`).
- Se o arquivo do banco não existe, `db.js` cria o schema e insere dados de exemplo (produtos e clientes).
  Apagar `loja.db` zera os dados: **pergunte antes de apagar**.
- **Testes:** `npm test` (Vitest + supertest), `npm run typecheck` (`tsc --noEmit`, o Vitest não checa tipos) e
  `npm run test:coverage`. Exigem Node >= 22.12 (o `.nvmrc` atende). Rode `npm test` antes e depois de qualquer mudança.
  - São **testes de caracterização**: registram o comportamento HTTP atual (status, corpo inteiro, efeitos no estoque
    e nos valores gravados). Testam só pelo HTTP, sobre o `app` exportado por `app.js`; não importe `utils`, `descontos`
    nem `db` nos testes. Cada arquivo roda num processo com banco temporário próprio (`test/setup.ts`); o `loja.db` não é tocado.
  - Testes com nome iniciado por `[atual]` registram bugs ou divergências conhecidos, como são hoje. Corrigir um deles
    é mudança de comportamento: faça numa change própria, alterando o teste junto. Liste-os com `grep -rn "\[atual\]" test`.
  - Lacunas que o HTTP não alcança ficam como `it.todo`.
- Para verificar à mão sem sujar o banco local, use um banco descartável: `DB_PATH=/tmp/loja-teste.db PORTA=3999 node app.js`.
- O README é a referência da API para quem a consome (rotas, payloads, respostas, erros, exemplos).
  Em caso de dúvida, a fonte da verdade das rotas continua sendo `app.js` + `routes/`.

## Mapa

- `app.js`: bootstrap, rotas de produtos, `/frete`, `/pedidos/:id/resumo`, `/relatorios/vendas`, `/pedidos/:id/cancelar`.
- `routes/clientes.js`, `routes/pedidos.js`: rotas já migradas (migração para `routes/` incompleta).
- `descontos.js`: desconto por tipo de cliente (`desconto_<tipo>`, despacho dinâmico).
- `utils.js`: validação de CEP, `calcula_frete`, `buscar_cliente`.
- `db.js`: conexão, schema e seed.
- `docs/openapi.yaml`: contrato OpenAPI 3.0.3 das rotas (escrito à mão, estático; não é servido pela API).
- `test/`: testes de caracterização em TypeScript (`*.test.ts`, um arquivo por área), `setup.ts` e `helpers.ts`.
  Configuração em `vitest.config.mts` e `tsconfig.json` (só testes/editor; o código de produção é JS, sem build).

## Regras de negócio

A fonte canônica é a criação de pedido (`POST /pedidos`, em `routes/pedidos.js`): é ela que grava
o valor cobrado. Itens marcados *a confirmar* ainda não foram validados com o negócio; **pergunte antes de alterá-los**.

- **Preço:** `total = subtotal - desconto + frete`. O preço do produto é copiado para
  `itens_pedido.preco_unitario` na criação; pedidos antigos não mudam se o preço mudar.
- **Desconto por `clientes.tipo`:**
  - `comum`: 5% se subtotal >= R$ 500 *(a confirmar: o resumo do pedido usa > R$ 500)*
  - `vip`: 10% sobre qualquer valor *(a confirmar: um comentário antigo fala em "só acima de R$ 200")*
  - `atacado`: 15% se a soma das quantidades dos itens for >= 10
  - outros tipos: sem desconto
- **Frete** (calculado sobre o subtotal **antes** do desconto, acordo com o comercial, não alterar):
  - subtotal >= R$ 300: grátis
  - senão, pelo 1º dígito do CEP **do cadastro do cliente**: 0-3 → R$ 15, 4-7 → R$ 30, 8-9 → R$ 20
- **Estoque:** baixado na criação do pedido; devolvido ao cancelar. Pedido sem estoque suficiente → 400.
- **Ciclo de vida:** `criado` → `cancelado` (só a partir de `criado`). Não existem outros status.
- **Pedidos são cancelados, nunca excluídos.** O `DELETE` foi desativado de propósito; não reative.
- Cliente cadastrado via API é sempre `comum`; não há endpoint para mudar o tipo.
- CEP: 8 dígitos, hífen opcional, armazenado sem hífen.

## Armadilhas

- **Regras de preço duplicadas.** O desconto é recalculado em `POST /pedidos`, `GET /pedidos/:id/resumo`
  e `GET /relatorios/vendas` (em vez de ler `pedidos.desconto`); o frete existe em `routes/pedidos.js`
  e em `utils.calcula_frete`. As cópias já divergiram. Ao mudar uma regra, alinhe todas ou pergunte.
- **SQL concatenado** em código legado (busca de produtos, resumo, `buscar_cliente`, `POST /pedidos`).
  Não copie esse padrão.
- **Sem transação** na criação/cancelamento de pedido; operações em loop com contador de callbacks.
- Formato de erro inconsistente: `{erro}` no código legado, `{error}` em `routes/clientes.js`.

## Convenções

- Domínio e mensagens em português (sem acentos nas mensagens de erro).
- Código novo: estilo de `routes/clientes.js` (`const`, arrow functions, `express.Router`) e
  **SQL sempre parametrizado com `?`**.
- Rotas novas vão em `routes/`, não em `app.js`.
- **JSDoc em português** (`/** ... */`, sem acentos, como os demais comentários) em toda função e rota nova:
  entradas, resposta de sucesso e erros com status. Divergências entre cópias de regras são marcadas com
  `@todo Diverge de <fonte canônica>: ...` (e `(a confirmar)` quando dependem do negócio);
  liste-as com `grep -rn "Diverge de" --include='*.js' --exclude-dir=node_modules .`.
- Mudanças de comportamento passam pelo OpenSpec: `/opsx:explore` → `/opsx:propose` → `/opsx:apply`.
  Specs (quando existirem) ficam em `openspec/specs/`.
- **Mantenha este arquivo atualizado:** ao mudar regras de negócio, comandos ou convenções, atualize o `AGENTS.md` na mesma mudança.
- Ao mudar uma regra ou rota, atualize também o `README.md`, o JSDoc afetado e o `docs/openapi.yaml` na mesma mudança.
