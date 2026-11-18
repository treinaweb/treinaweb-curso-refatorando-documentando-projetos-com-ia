# Design

## Context

Etapa 3 de `docs/refatoracao.md` (veja proposal.md - Why). O contrato está em
`specs/validacao-entrada` e `specs/busca-produtos`. Estado atual relevante, depois da etapa 1:

- `src/app.ts` (TS) monta o app e injeta o `db` nas factories legadas em JS (`createLegadoRouter(db)`,
  `createClientesRouter(db)`, `createPedidosRouter(db)`).
- Os handlers validam à mão, por *truthiness*: `!cliente_id`, `!itens[i].produto_id`, `!nome`.
  `validaCep` (`src/utils.js`) remove o primeiro hífen e confere `length === 8 && !isNaN`.
  `GET /frete` usa `parseFloat(...) || 0`.
- SQL concatenado com entrada do usuário: `busca` (`legado.js`), o `id` do resumo (`legado.js`), os
  ids dos produtos e o `cliente_id` (`pedidos.js`, `utils.buscar_cliente`).
- **Restrição verificada num spike:** sob o Vitest, o JS legado é carregado com `require` nativo e
  **não consegue importar `.ts`** (`Cannot find module`). No `dist/` funcionaria. Por isso os
  schemas não podem ser importados pelos handlers JS.

## Goals / Non-Goals

**Goals:**
- Uma única definição de cada regra de entrada, em TS, no lugar definitivo (`src/http/`), pronta para
  os controllers da etapa 6.
- Os handlers legados deixam de validar entrada; ficam só com as regras que dependem do banco
  (cliente e produto inexistentes, estoque, status do pedido).
- Cada mudança de resposta é registrada por um teste de caracterização **antes** de ser feita.

**Non-Goals:**
- Converter handlers para TS ou reorganizar rotas (etapas 6 e 7).
- Parametrizar o SQL que a validação já torna seguro (ids do pedido, `buscar_cliente`): passa a só
  receber inteiros validados, e a etapa 4 move todo o SQL para os repositories. A busca é a exceção,
  porque a correção 1 só existe com o `LIKE` parametrizado.
- Transformar a entrada: os middlewares só aceitam ou rejeitam. O handler continua lendo `req.body`
  e `req.query` como chegaram.

## Decisions

### 1. Validadores injetados nas factories (opção A da exploração)

```
src/app.ts (TS)
  |-- importa schemas (src/http/schemas/*.ts) e validar() (src/http/middlewares/validar.ts)
  |-- monta os middlewares: validar({ schema, origem, formato, status })
  v
createPedidosRouter(db, { criarPedido, idPedido })        (JS legado)
  router.get('/:id', idPedido, getPedido)
  router.post('/', criarPedido, function (req, res) { ... sem validacao manual ... })
```

| Factory | Validadores injetados |
|---|---|
| `createLegadoRouter(db, v)` | `v.busca` (query de `GET /produtos`), `v.idProduto`, `v.frete` (query), `v.idPedido` (resumo e cancelar) |
| `createClientesRouter(db, v)` | `v.idCliente`, `v.criarCliente` (body, formato `error`) |
| `createPedidosRouter(db, v)` | `v.idPedido`, `v.criarPedido` (body) |

*Alternativas descartadas:* middlewares montados direto no `createApp` (o caminho da rota ficaria
duplicado no `app.ts` e no router, e a ordem de montagem passaria a importar) e converter os
handlers para TS (invade as etapas 6 e 7).

### 2. `validar()`: um middleware genérico

`validar({ schema, origem: 'body' | 'query' | 'params', formato: 'erro' | 'error', status = 400 })`:

1. `schema.safeParse(req[origem])`; se passar, `next()`;
2. se falhar, pega `issues[0]` e responde `status` com `{ [formato]: mensagem }`.

As mensagens vêm do próprio schema, pelo `error` de cada campo:
`error: (iss) => iss.input === undefined || iss.input === null ? 'cliente_id obrigatorio' : 'cliente_id invalido'`.
Assim, a mensagem do Zod nunca aparece. Para "no item N", o schema usa o marcador `{item}` na
mensagem, e o `validar` o substitui pelo índice + 1 tirado de `issues[0].path`. Isso não depende de o
error map conhecer o `path`.

O corpo vazio (`express.json()` dá `{}` no Express 4; no Express 5 será `undefined`) é tratado no
schema: `undefined` como origem vira `{}` (`z.preprocess`), e o resultado continua sendo
"`cliente_id obrigatorio`" ou "`Nome e email sao obrigatorios`".

### 3. Schemas

- **Id no path** (`schemas/id.ts`): `z.object({ id: z.string().regex(/^\d+$/) })`, com o validador
  montado com `status: 404` e a mensagem de "não encontrado" de cada rota (`Produto nao encontrado`,
  `Cliente nao encontrado`, `Pedido nao encontrado`) no formato da rota.
- **Inteiro positivo do corpo:** `z.number().int().positive()`. Os textos são recusados pelo tipo,
  sem coerção.
- **`POST /pedidos`:**
  - `cliente_id` (obrigatório/inválido);
  - `itens`: `z.array(item).min(1)`, com uma única mensagem `Pedido sem itens` para ausente, não-lista
    ou vazio;
  - `item`: um objeto com `produto_id` e depois `quantidade`. Um item que não é objeto é tratado como
    objeto vazio (`preprocess`), então cai em `produto_id obrigatorio no item {item}`.
  - A ordem das chaves no `shape` reproduz a ordem atual.
- **`POST /clientes`:**
  - `nome` e `email`: `undefined`, `null` ou `""` → `Nome e email sao obrigatorios`; não-string →
    `Nome invalido` / `Email invalido`.
  - `cep`: `z.string()` com `refine(utils.validaCep)`. Qualquer falha dá `CEP invalido`.
  - A ordem é `nome`, `email`, `cep`.
- **`GET /frete`:**
  - `cep` como em clientes, mas no formato `erro`;
  - `subtotal`: `undefined` ou `""` aceitos; senão, uma string que case com `/^\d+(\.\d+)?$/`, ou
    `Subtotal invalido`. Um array (`?subtotal=1&subtotal=2`) também falha.
- **`GET /produtos`:** `busca` opcional e `z.string()`. Um array ou objeto (`qs` do Express 4) dá
  `Busca invalida`.
- **Objetos não estritos** (`z.object`, não `z.strictObject`): os campos extras são ignorados.

### 4. `validaCep` é a fonte da regra de CEP

`validaCep` (JS) passa a ser estrito: `trim`, depois `/^\d{5}-?\d{3}$/`, e devolve o CEP sem hífen.
O schema em TS o reaproveita, porque TS importa JS sem problema e o caminho inverso é que não
funciona. Assim existe uma regra só, usada pelos schemas e pela normalização nos handlers. Quem chama
o `validaCep` garante que o valor é string (os schemas e a query).

### 5. Correção da busca

`WHERE nome LIKE ?` com o parâmetro `'%' + busca + '%'`. `%` e `_` vindos do usuário continuam
funcionando como curingas, porque não há `ESCAPE`. Isso é deliberado e está registrado em
`specs/busca-produtos`.

### 6. Ordem de trabalho: caracterizar, depois mudar

Para cada mudança: (1) um teste que registra o comportamento atual (`[atual]` quando é bug ou
divergência) e passa antes de qualquer mudança no código; (2) a mudança, com esse teste atualizado
para o comportamento novo, no mesmo passo. O histórico do arquivo de teste mostra o antes e o depois.
Os testes `[atual]` corrigidos perdem o prefixo.

### 7. Documentação

- README (tabela de erros de cada rota);
- `docs/openapi.yaml`:
  - as respostas 400 ganham as mensagens novas;
  - as rotas com id passam a documentar `pattern: '^\d+$'`;
  - o `subtotal` passa a ter `pattern`;
- JSDoc dos handlers e das factories;
- `AGENTS.md`: na Convenção, "validação de entrada só por schema Zod em `src/http/schemas/`,
  injetada nas factories"; nas Armadilhas, sai o "SQL concatenado" da busca e do resumo;
- `docs/refatoracao.md`:
  - as decisões desta etapa (injeção, mensagens de nome e email, ids do path em todas as rotas,
    valores falsy, detalhes de P2, efeito no frete, item não-objeto);
  - o registro de andamento.

## Risks / Trade-offs

- **[A ordem de `issues` do Zod pode não seguir a ordem das chaves]** → os testes de ordem existentes
  e os novos (`cliente_id` antes dos itens, `nome` antes de `email`, CEP antes de subtotal) falham se
  isso acontecer. Mitigação: validar em fases (topo e depois itens), compondo schemas.
- **[`preprocess` e error maps mudando o tipo do problema]** (por exemplo, `null` em
  `z.number()` gerando `invalid_type` com `input` `null`) → a regra de "obrigatório" olha
  `undefined` **e** `null`, e cada caso tem teste.
- **[A mudança de `validaCep` afeta clientes já gravados]** → não afeta: o frete só lê o primeiro
  dígito do CEP gravado, e a validação só roda no cadastro e na simulação. Antes do deploy, rodar
  `SELECT cep FROM clientes WHERE cep NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'` no
  `loja.db` de produção para saber se existem.
- **[`id` com zeros à esquerda]** (`/produtos/01`) continua 200, porque é só dígitos. Está no spec.
- **[Cobertura do Vitest]** → os módulos novos são TS (instrumentados pelo Vite); a cobertura dos
  handlers JS pode cair, porque a validação manual sai.
- **[`dist/` vs `src/`]** → o smoke do `dist/` é critério desta etapa (`npm start` num banco
  descartável, conferindo as respostas novas e as antigas).

## Migration Plan

Não há migração de dados. Quem consome a API recebe 400 (ou 404) onde antes recebia 200, 201, 404 ou
500 nos casos listados na proposal. Como é uso interno, o aviso vai pelo README/changelog do commit.
Rollback: reverter a change.
