# Proposal

## Why

Esta change implementa a **etapa 5 (Domínio de preços)** de `docs/refatoracao.md`.

Hoje as regras de preço estão copiadas em cinco lugares:
- o `POST /pedidos` tem cópias inline do desconto `comum` e do frete;
- o resumo tem a própria regra `comum` e despacha os outros tipos por `descontos.js`;
- o relatório tem uma cópia completa das taxas, com `Math.round`;
- `descontos.js` tem o `vip` e o `atacado`;
- `utils.calcula_frete` tem o frete.

As cópias já divergiram, e a divergência só aparece lendo cada rota. Antes de separar as camadas na
etapa 6, as regras precisam estar num lugar só, puras e testáveis, com cada divergência **com nome**.

## What Changes

- **Domínio de preços em TypeScript**, em `src/domain/precos/`, sem I/O:
  - **dinheiro:** `arred2`, que é o `Number(x.toFixed(2))` de hoje;
  - **desconto:** as regras de cada tipo como dados (taxa e condição de elegibilidade), num `Map`. Um
    tipo fora do mapa dá desconto 0, inclusive nomes como `constructor` ou `toString`;
  - **políticas com nome**, que combinam as regras com um arredondamento:
    - `PEDIDO`, a canônica;
    - `RESUMO`, com o `comum` elegível só com subtotal `> 500`;
    - `RELATORIO`, que só conhece `vip`, `comum` e `atacado` e arredonda com `Math.round`.

    `RESUMO` e `RELATORIO` levam o comentário `@todo Diverge de POST /pedidos`;
  - **frete:** uma regra só, sobre o subtotal antes do desconto, pelo 1º dígito do CEP;
  - **pedido:** subtotal dos itens e total, na mesma ordem de operações de hoje.
- **Injeção:** o `createApp` passa o domínio às factories, que ficam `createPedidosRouter(r, v, precos)`
  e `createLegadoRouter(r, v, precos)`. É o mesmo padrão dos validadores e dos repositories, porque o
  JS legado não importa `.ts` sob o Vitest.
- **As rotas passam a usar o domínio:** `POST /pedidos`, `GET /pedidos/:id/resumo`,
  `GET /relatorios/vendas` e `GET /frete`. As respostas continuam idênticas, centavo por centavo, e
  as divergências continuam como estão.
- **Saem do projeto:**
  - `src/descontos.js`, substituído pelo domínio;
  - `utils.calcula_frete`, substituída pelo frete do domínio;
  - `utils.formata_moeda`, que não tinha uso. A remoção estava prevista para a etapa 8 e foi
    antecipada.

  `src/utils.js` fica só com `validaCep`.
- **Testes unitários do domínio** em `test/dominio/precos.test.ts`, que importam só de `src/domain/`.
  Cobrem:
  - as fronteiras de cada regra;
  - as três políticas lado a lado;
  - o tipo desconhecido e os nomes do protótipo de objeto;
  - o arredondamento.

  Os testes de caracterização não mudam.
- **Docs:**
  - `AGENTS.md`: o Mapa, as Armadilhas sem as "regras de preço duplicadas", a convenção do domínio e a
    exceção dos testes de domínio;
  - JSDoc das rotas;
  - `docs/refatoracao.md`: a etapa 5 concluída, as decisões, e a etapa 8 sem o `formata_moeda`.

  README e `docs/openapi.yaml` não mudam, porque o contrato é o mesmo.

## Capabilities

### New Capabilities

Nenhuma. É uma refatoração sem mudança de comportamento: a change usa `skip_specs: true`. As regras
de preço continuam descritas pelos testes de caracterização (inclusive os `[atual]` do resumo e do
relatório), pelo `AGENTS.md` e, agora, pelos testes do domínio.

### Modified Capabilities

Nenhuma.

## Impact

- **API:** nenhuma mudança. Os mesmos status, corpos e valores gravados, centavo por centavo.
- **Código:**
  - novos `src/domain/precos/*.ts`;
  - `src/app.ts`, que injeta o domínio;
  - `src/routes/pedidos.js` e `src/routes/legado.js`, que passam a usar o domínio;
  - `src/utils.js`, que fica só com `validaCep`;
  - `src/descontos.js` é removido.
- **Testes:** novo `test/dominio/precos.test.ts`. Os 131 testes de caracterização ficam sem nenhuma
  mudança. Dois deles citam `descontos.js` no nome ou num comentário, e o texto fica como está.
- **Dependências:** nenhuma.
- **Fora de escopo:**
  - corrigir as divergências (`comum > 500` no resumo, `Math.round` no relatório, a regra antiga do
    VIP);
  - mover para o domínio a soma do faturamento do relatório e o texto `R$ x.xx` das linhas do resumo,
    que ficam para a etapa 6;
  - services e controllers (etapa 6).
