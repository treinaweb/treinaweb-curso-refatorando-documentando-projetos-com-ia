# Proposal

## Why

Esta change implementa a **etapa 3 (Validação com Zod e correções explícitas)** de `docs/refatoracao.md`.
Hoje a validação de entrada é manual, incompleta e espalhada pelos handlers. Ela só confere se os
valores são *truthy*, e parte das entradas é concatenada no SQL. O resultado são comportamentos que
ninguém decidiu:
- aspa na busca → 500;
- `produto_id: "abc"` → 500;
- `cliente_id: 1.5` → 404;
- `nome: 123` gravado como número;
- `/produtos/1.0` encontrando o produto 1;
- `itens: [null]` → 500 em HTML.

Esta é a única etapa da refatoração que pode mudar o contrato. Ela vem antes do Express 5 (etapa 2),
que deixa o `req.body` indefinido quando não há corpo.

## What Changes

- **Validação de entrada com Zod 4**, definida uma vez em `src/http/schemas/` e aplicada por middlewares
  em `src/http/middlewares/`. Os middlewares são injetados nas factories dos routers legados, do mesmo
  jeito que o `db`. A resposta usa só o primeiro problema, com mensagens do projeto (nunca as do Zod)
  e no formato de erro de cada rota (`{erro}` ou `{error}`).
- **Política de tipos estrita** (mudanças de comportamento, todas com teste):
  - ids no corpo (`cliente_id`, `produto_id`): ausente ou `null` → `... obrigatorio`, como hoje.
    Qualquer valor que não seja inteiro positivo → **novo** `cliente_id invalido` /
    `produto_id invalido no item N`. Hoje `0`/`""`/`false` dão "obrigatorio", `1.5` dá 404 e `"1"` é
    aceito.
  - item do pedido que não é objeto (`null`, `5`) → `produto_id obrigatorio no item N`. Hoje `null`
    dá 500 em HTML.
  - `nome`/`email`: ausente, `null` ou `""` → `Nome e email sao obrigatorios`, como hoje. Valor que
    não é string → **novas** `Nome invalido` / `Email invalido`. Hoje é gravado como veio.
  - `cep` no `POST /clientes`: só string. Numérico → `CEP invalido`; hoje é aceito.
  - ids no path de todas as rotas (`/produtos/:id`, `/clientes/:id`, `/pedidos/:id`, resumo e
    cancelamento): só dígitos. Qualquer outro valor → o 404 da própria rota. Hoje `1.0`, `1e0` e
    ` 1` encontram o registro 1, e `GET /pedidos/abc/resumo` dá 500.
  - `GET /frete`: `subtotal` ausente ou vazio vale 0, como hoje. Fora de `^\d+(\.\d+)?$` (incluindo
    negativo, `abc` e `350reais`) → **novo** `400 Subtotal invalido`. Hoje vale 0 ou o prefixo
    numérico.
  - `GET /produtos`: `busca` repetida ou objeto → **novo** `400 Busca invalida`.
  - CEP estrito, em `POST /clientes` e em `GET /frete`: `^\d{5}-?\d{3}$` depois do `trim`. Hoje
    `0131-0100` e `1.310100` são aceitos.
- **Correções explícitas** (a tabela da etapa 3 do roteiro):
  - a aspa na busca passa a ser caractere comum (200, com o `LIKE` parametrizado; `%` e `_`
    continuam curingas);
  - `produto_id` e `cliente_id` não numéricos → 400;
  - `GET /pedidos/abc/resumo` → 404;
  - o ramo morto `Body vazio` sai.
- **Testes:** primeiro, testes de caracterização do comportamento atual para cada caso acima que
  ainda não tem teste. Depois, a mudança, com os testes afetados atualizados e os `[atual]` corrigidos
  virando testes normais.
- **Mantido:** campos extras no corpo continuam ignorados (`tipo: 'vip'` no `POST /clientes`
  inclusive); as regras de negócio *a confirmar*; o formato de erro de cada rota; `nome` só com
  espaços continua aceito; o e-mail continua sem validação de formato.
- **Docs:** README (rotas e erros), `docs/openapi.yaml`, JSDoc, `AGENTS.md` (padrão de validação) e
  `docs/refatoracao.md` (decisões desta etapa e registro de andamento).

## Capabilities

### New Capabilities

- `validacao-entrada`: contrato de entrada da API. Define o que cada rota aceita no corpo, na query e
  no path, a ordem em que os problemas são avaliados e o status e a mensagem de cada rejeição.
- `busca-produtos`: semântica da busca de produtos por nome (`GET /produtos?busca=`): curingas,
  caracteres especiais e busca vazia.

### Modified Capabilities

Nenhuma (não há specs principais ainda).

## Impact

- **API (mudanças de contrato):** as respostas listadas acima. Os demais status, corpos e mensagens
  continuam iguais.
- **Código:**
  - novos `src/http/schemas/*.ts` e `src/http/middlewares/validar.ts`;
  - `src/app.ts` monta os validadores e os injeta nas factories;
  - `src/routes/*.js` deixam de validar à mão;
  - a busca usa SQL parametrizado;
  - `src/utils.js` (`validaCep`) fica estrito.
- **Dependências:** `zod@4` (produção).
- **Testes:**
  - novos testes de caracterização;
  - os `[atual]` de busca, ids não numéricos, resumo, `Body vazio` e `validaCep` corrigidos;
  - testes normais que mudam: `aceita CEP numerico...`, `subtotal ausente ou invalido vale 0`,
    `subtotal com sufixo...`.
- **Fora de escopo:** regras de negócio *a confirmar*, unificar o formato de erro, transações (etapa 4),
  validação de formato do e-mail, Express 5.
