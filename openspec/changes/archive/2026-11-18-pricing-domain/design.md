# Design

## Context

Etapa 5 de `docs/refatoracao.md` (veja proposal.md - Why). Estado atual das cópias (verificado no código):

| Onde | Desconto | Frete | Arredondamento |
|---|---|---|---|
| `POST /pedidos` (`routes/pedidos.js`) | `comum` inline (`>= 500`, 5%); outros por `descontos['desconto_' + tipo](subtotal, itens)` | inline | `toFixed(2)` no subtotal, desconto e total |
| `GET /pedidos/:id/resumo` (`routes/legado.js`) | `vip` por `descontos.desconto_vip`; `comum` inline (`> 500`); outros pelo despacho | lê `pedidos.frete` | `toFixed(2)` no subtotal e total; linhas `R$ x.xx` com `toFixed(2)` |
| `GET /relatorios/vendas` (`routes/legado.js`) | cópia própria: `vip` 10%, `comum` 5% se `>= 500`, `atacado` 15% se quantidade `>= 10`; tipo fora disso → 0 | lê `pedidos.frete` | `Math.round` no desconto; `toFixed(2)` no faturamento por tipo e no geral |
| `GET /frete` (`routes/legado.js`) | - | `utils.calcula_frete` | - |

Restrições:
- O JS legado não importa `.ts` sob o Vitest. Por isso o domínio é injetado pelo `createApp`, como os
  validadores e os repositories.
- Os testes comparam valores exatos, então qualquer mudança na ordem das operações com decimais muda
  centavos.
- Os testes `[atual]` do resumo e do relatório registram as divergências e precisam continuar
  passando.

## Goals / Non-Goals

**Goals:**
- `grep -rn "0.05\|0.1\b\|0.15\|>= 300" src` encontra só `src/domain/precos/`.
- Cada divergência é uma política com nome e `@todo Diverge de POST /pedidos`, num lugar só.
- Domínio puro, sem I/O nem Express, testado direto por `test/dominio/`.

**Non-Goals:**
- Corrigir divergências (veja "Fora da refatoração" no roteiro).
- Mover para o domínio a soma do faturamento do relatório e o texto das linhas do resumo. Isso é
  apresentação e agregação, e vai para os services na etapa 6.
- Converter as rotas para TS (etapa 6/7).

## Decisions

### 1. Módulos de `src/domain/precos/`

```
src/domain/precos/
  dinheiro.ts   arred2(valor)                     Number(valor.toFixed(2))
  descontos.ts  Regra, Politica, REGRAS, PEDIDO, RESUMO, RELATORIO,
                quantidadeTotal(itens), desconto(politica, tipo, subtotal, quantidade)
  frete.ts      frete(cep, subtotal)
  pedido.ts     subtotal(itens), total(subtotal, desconto, frete)
  index.ts      reexporta tudo; e o objeto `precos` injetado
```

- `arred2` é exatamente `Number(valor.toFixed(2))`. Não troca para `Math.round(valor * 100) / 100`,
  porque os dois divergem em alguns valores.
- `frete` mantém `parseInt(cep.substring(0, 1))` e as comparações `<= 3`, `<= 7`, com o mesmo
  comportamento das duas cópias de hoje: com subtotal `>= 300`, o frete é 0.
- `subtotal(itens)` soma `preco_unitario * quantidade` na ordem dos itens e arredonda com `arred2` só
  no fim. Trocar `qtd * preco` por `preco * qtd` é seguro, porque a multiplicação dá exatamente o
  mesmo resultado nas duas ordens.
- `total(s, d, f)` é `arred2(s - d + f)`, nessa ordem.
- `quantidadeTotal(itens)` soma `Number(item.quantidade)`, como `desconto_atacado` faz hoje.

### 2. Regras como dados, políticas como combinação

```ts
interface Regra { taxa: number; elegivel(subtotal: number, quantidade: number): boolean }
interface Politica { regras: ReadonlyMap<string, Regra>; arredondar(valor: number): number }

REGRAS     = Map { comum:   { 0.05, subtotal >= 500 },
                   vip:     { 0.10, sempre },            // @todo a confirmar: "so acima de 200"
                   atacado: { 0.15, quantidade >= 10 } }
PEDIDO     = { REGRAS, arred2 }
RESUMO     = { REGRAS com comum: { 0.05, subtotal > 500 }, arred2 }      // @todo Diverge de POST /pedidos
RELATORIO  = { REGRAS so de ['vip','comum','atacado'], Math.round }      // @todo Diverge de POST /pedidos

desconto(p, tipo, subtotal, quantidade) =
  regra = p.regras.get(tipo); regra && regra.elegivel(subtotal, quantidade) ? p.arredondar(subtotal * regra.taxa) : 0
```

- **Os centavos não mudam.** Os três pontos calculam o mesmo produto, `subtotal * taxa`. O canônico e
  o resumo aplicam `Number(x.toFixed(2))`, e o relatório aplica `Math.round(x)`, como hoje.
- **`RESUMO` reaproveita a taxa do `comum`** (`REGRAS.get('comum').taxa`) e só troca a condição.
  Corrigir a divergência é apagar essa sobrescrita.
- **`RELATORIO` filtra `REGRAS` por uma lista fixa (`TIPOS_RELATORIO`).** Hoje a lista é igual às
  chaves de `REGRAS`, e o filtro deixa explícito que um tipo novo não entra no relatório
  automaticamente. Se não houvesse essa lista, um tipo novo passaria a valer no relatório, e a
  divergência seria "unificada sem querer".
- **`Map` em vez de objeto literal.** `get('constructor')` devolve `undefined`. Num objeto, devolveria
  a função herdada do protótipo e o desconto viraria `NaN` ou erro. Hoje o prefixo `desconto_` evita
  isso.
- **Alternativa descartada: três funções independentes** (`descontoPedido`, `descontoResumo`,
  `descontoRelatorio`). Ela repetiria cada taxa até três vezes e esconderia o que difere de quê.

### 3. Como cada rota usa o domínio

| Rota | Antes | Depois |
|---|---|---|
| `POST /pedidos` | soma no laço de validação; `comum` inline e despacho; frete inline; total inline | o laço continua validando existência e estoque e copiando `preco_unitario`; depois `precos.subtotal(itens)`, `precos.desconto(precos.PEDIDO, tipo, subtotal, precos.quantidadeTotal(itens))`, `precos.frete(cliente.cep, subtotal)` e `precos.total(...)` |
| resumo | soma e linhas no `forEach`; desconto por tipo; total inline | o `forEach` continua montando as linhas (`toFixed(2)`, apresentação); `precos.subtotal(itens)`, `precos.desconto(precos.RESUMO, ...)` e `precos.total(sub, desc, ped.frete)` |
| relatório | `qtd` no laço; três `if` com `Math.round` | `qtd` do laço; `d = precos.desconto(precos.RELATORIO, p.tipo, p.subtotal, qtd)`; o faturamento continua acumulado na rota, com `precos.arred2` no lugar do `Number(x.toFixed(2))` |
| `GET /frete` | `utils.calcula_frete` | `precos.frete(cep, subtotal)` |

- No `POST /pedidos`, a soma sai do laço de validação. O laço retorna cedo com 404 ou 400, e nesse
  caso a soma nunca era usada. Por isso calcular depois dá o mesmo resultado.
- O subtotal soma os itens na ordem do corpo, a mesma de hoje.
- O resumo soma na ordem de `itensParaResumo`, também a de hoje.

### 4. Injeção

`src/app.ts` faz `import * as precos from './domain/precos'` e passa `precos` como terceiro argumento:
- `createPedidosRouter(r, v, precos)`;
- `createLegadoRouter(r, v, precos)`.

`createClientesRouter` não muda, porque não usa preço. Os JSDoc das factories tipam o parâmetro como
`typeof import('../domain/precos')`.

### 5. Testes do domínio

`test/dominio/precos.test.ts` importa de `../../src/domain/precos`. O `include` do Vitest já cobre a
pasta. O `setup.ts` também roda e abre um banco temporário sem uso; o custo é aceito para não
condicionar o setup.

Casos:
- **`desconto` com `PEDIDO`:**
  - `comum` com 499.99, 500 e 500.01;
  - `vip` com qualquer valor;
  - `atacado` com quantidade 9 e 10;
  - tipo desconhecido, `constructor`, `toString` e `__proto__` → 0.
- **As três políticas no mesmo caso:**
  - `comum` com 500: `PEDIDO` 25, `RESUMO` 0, `RELATORIO` 25;
  - `vip` com um subtotal cujo desconto tem centavos (por exemplo 123.45): `PEDIDO` e `RESUMO` dão
    12.35, e `RELATORIO` dá 12.
- **Tipos novos:** um tipo novo em `REGRAS` não entra em `RELATORIO`. O teste monta uma política com
  `REGRAS` estendida e verifica a lista fixa.
- **`frete`:** subtotal 299.99 e 300; CEP começando em 0, 3, 4, 7, 8 e 9.
- **Dinheiro e pedido:**
  - `arred2` reproduz `toFixed(2)`, inclusive num caso em que `Math.round(x * 100) / 100` dá outro
    valor;
  - `subtotal` arredonda só no fim;
  - `total` com a ordem `s - d + f`;
  - `quantidadeTotal` com quantidades em texto.

A regra do `AGENTS.md` muda para:
- os testes de **caracterização** (`test/*.test.ts`) importam só de `./helpers`;
- os testes de **domínio** (`test/dominio/*.test.ts`) importam só de `src/domain/`.

### 6. O que sai

- `src/descontos.js` sai. O contrato do despacho dinâmico (`desconto_<tipo>`) deixa de existir:
  - um tipo novo passa a ser uma entrada em `REGRAS`;
  - o comentário antigo do VIP ("só acima de 200") vira o `@todo a confirmar` da regra `vip`.
- `utils.calcula_frete` e `utils.formata_moeda` saem. `utils.js` fica com `validaCep`.
- Os testes `resumo.test.ts` ("atacado usa descontos.js") e `relatorio.test.ts` (comentário) citam um
  arquivo que deixa de existir. Pelo invariante, o texto deles não muda nesta change. A atualização
  vai para o escopo da etapa 8, como texto apenas.

## Risks / Trade-offs

- **[Centavos diferentes por ordem de operação]** → cada função reproduz a sequência atual (Decisão 1).
  Os testes de caracterização comparam valores exatos, e os de domínio fixam `arred2` = `toFixed(2)`.
- **["Unificar sem querer" o resumo ou o relatório]** → as políticas são objetos separados, e os testes
  `[atual]` continuam passando. Os testes de domínio comparam as três políticas lado a lado.
- **[Tipo de `cep` no frete]** → o domínio recebe o CEP como texto. O CEP do cadastro sempre é texto de
  8 dígitos, porque é validado na criação e o seed é fixo. Em `/frete`, o validador já garante o
  formato.
- **[O injetado não é o importado]** → o `index.ts` exporta tudo. Os routers usam só `precos.*`, sem
  `require` do domínio. O typecheck do build garante que o módulo existe.
- **[Três argumentos posicionais nas factories]** → é provisório. Na etapa 6, os services importam o
  domínio direto, e as factories passam a receber só os services.

## Migration Plan

Não há migração de dados: o schema e os valores gravados são os mesmos. Para reverter, basta um
`git revert` da change.
