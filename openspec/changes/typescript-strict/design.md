# Design

## Context

Etapa 7 de `docs/refatoracao.md` (veja proposal.md - Why). Estado atual (verificado):

- `tsconfig.json` (editor + `typecheck` de `src/` e `test/`, `module: preserve`) e `tsconfig.build.json`
  (`nodenext`, `dist/`), os dois com `strict: true`, `allowJs: true` e `checkJs: false`. Nenhum `.js`
  em `src/`.
- `npx tsc --noEmit` com os flags extras dá 11 erros, todos de `noUncheckedIndexedAccess`: 9 em
  `src/services/relatorio.ts` (`porTipo[tipo]`, `itensPorPedido[indice]`) e 2 em
  `src/http/middlewares/validar.ts` (`resultado.error.issues[0]`). Os demais flags dão 0.
- 15 `as` em `src/repositories/`, porque `.get()` e `.all()` do `better-sqlite3` devolvem `unknown`. Os
  tipos do `@types/better-sqlite3` aceitam `prepare<BindParameters, Result>(sql)`.
- `any` vindo de biblioteca: `res.locals` é `LocalsObj & Locals`, com `LocalsObj = Record<string, any>`
  por padrão, então uma *augmentation* do `Locals` não tira o `any` (a interseção com `any` continua
  `any`). O `err` do `ErrorRequestHandler` também é `any`.
- `Produto`, `Cliente`, `Pedido` e `ItemPedido` estão definidos em `src/repositories/*` e são
  importados pelos services.
- Versões verificadas em 2026-11-19: `typescript` 7.0.2 (instalado), `eslint` 10.15.0, `@eslint/js`
  10.0.1, `typescript-eslint` 8.73.0, `prettier` 3.10.1 e `eslint-config-prettier` 10.1.8. O
  `typescript-eslint` declara `typescript: ">=4.8.4 <6.1.0"` e lança
  `typescript-eslint does not support TS 7.0` ao carregar com o TypeScript 7. O suporte ao 7 é um
  backend experimental (`@typescript/native`) que exige o 7.1 em pré-lançamento. O TS 6 existe como
  `@typescript/typescript6@6.0.2`, com o binário `tsc6`; o `typescript@7.0.2` expõe `tsc`.
- Prettier 3.10.1 com o estilo atual e `printWidth: 120` (medido numa cópia): 13 arquivos mudam
  (`src/db/index.ts`, `src/http/routes/{clientes,pedidos,produtos}.ts`, `src/http/schemas/comum.ts`,
  `src/repositories/pedidos.ts`, `src/services/pedidos.ts` e 6 testes), cerca de 140 linhas.
- `npm ls typescript`: só o projeto depende do pacote `typescript`. O Vitest não usa o `tsc`.
- Linha de base: 166 testes passando e 1 `it.todo`.

## Goals / Non-Goals

**Goals:**
- `npm run typecheck` limpo com todos os flags extras e sem `allowJs`.
- Nenhum `as` e nenhum `any` (explícito ou vindo de biblioteca e usado como valor) em `src/`; o
  ESLint garante isso daqui em diante.
- `npm run lint` e `npm run format:check` limpos, junto com `npm test` e `npm run typecheck`.
- O `tsc` do build e do `typecheck` continua sendo o TypeScript 7.0.2.

**Non-Goals:**
- Validar as linhas do banco em tempo de execução.
- Mudar qualquer asserção, nome ou contagem de testes. Os testes só são reformatados.
- Formatar documentação (Markdown, YAML, JSON).

## Decisions

### 1. Flags do compilador

Os dois `tsconfig` ganham `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` e
`noFallthroughCasesInSwitch`, e perdem `allowJs` e `checkJs`. O `include` do build (`src`) não muda.

Correções:
- **`relatorio.ts`:** o grupo é obtido uma vez só
  (`const grupo = (porTipo[pedido.tipo] ??= { pedidos: 0, itens: 0, faturamento: 0 })`), e a segunda
  volta usa `Object.values(porTipo)` ou uma variável local. Os itens vêm de
  `itensPorPedido[indice] ?? []`, ou o laço passa a usar pares. O objeto continua simples, e a ordem
  das chaves, a sequência das somas e os arredondamentos não mudam (os testes do relatório comparam
  o corpo inteiro e os centavos).
- **`validar.ts`:** `issues[0]` ganha um ramo explícito. Um `safeParse` que falha sempre tem ao menos
  um problema, então o ramo é inalcançável. Ele responde com a `mensagem` fixa, se houver, ou lança um
  erro (o 500 da rota), e está documentado como inalcançável no código.

### 2. Repositories sem `as`

```ts
db.prepare<[number | string], Produto>('SELECT * FROM produtos WHERE id = ?').get(id)
db.prepare<[], Cliente>(`SELECT ${COLUNAS} FROM clientes ORDER BY id`).all()
db.prepare<number[], Produto>(`SELECT * FROM produtos WHERE id IN (${marcadores})`).all(...ids)
```

- O tipo da linha continua sendo uma promessa, como o `as` de hoje, cumprida pelo schema de `src/db/`.
  O ganho é tirar todo `as` de `src/` e tipar os parâmetros dos `?`.
- As transações (`db.transaction`) e os `INSERT`/`UPDATE` (`.run`) também passam a declarar os
  parâmetros.
- **Alternativas descartadas** (na exploração): manter o `as` com comentário, porque o `grep` deixaria
  de distinguir um cast legítimo de um erro; e validar com Zod, que seria regra nova e custaria em
  toda leitura.

### 3. Tipos de domínio

`src/domain/tipos.ts`:

```ts
export type TipoConhecido = 'comum' | 'vip' | 'atacado'   // so confere literais
export interface Produto { id: number; nome: string; preco: number; estoque: number }
export interface Cliente { id: number; nome: string; email: string; cep: string; tipo: string }
export interface Pedido  { id: number; cliente_id: number; subtotal: number; desconto: number;
                           frete: number; total: number; status: string; criado_em: string }
export interface ItemPedido { id: number; pedido_id: number; produto_id: number;
                              quantidade: number; preco_unitario: number }
```

- **`tipo` e `status` como `string`:** o banco aceita qualquer texto, e as regras dependem disso
  ("outros tipos: sem desconto"; a política `RELATORIO` existe por causa dos tipos novos). Uma união
  fechada aplicada às linhas lidas seria mentira de tipo. `StatusPedido` continua em
  `src/domain/pedido.ts`, e `podeCancelar` vira o estreitamento (`status is 'criado'`).
- **`TipoConhecido` só nos literais:** `REGRAS` e `TIPOS_RELATORIO` usam `satisfies` com
  `TipoConhecido` nas entradas, mas os tipos públicos continuam `ReadonlyMap<string, Regra>` e
  `readonly string[]`. Um tipo mais estreito quebraria a compilação de `test/dominio/precos.test.ts`,
  que monta uma política com um tipo novo, e os testes não mudam.
- Os repositories importam os tipos do domínio. Os tipos de consulta (`PedidoComCliente`,
  `ItemComNome`, `PedidoComTipo`, `ItemDetalhado`) e as entradas de gravação (`NovoCliente`,
  `NovoPedido`) continuam nos repositories: descrevem o formato de uma consulta ou de um comando.
- **Alternativas descartadas** (na exploração): a união "aberta" `'comum' | ... | (string & {})`, que é
  obscura e dá pouco ganho; e deixar os tipos nos repositories, que inverte a dependência
  (`service → domain`).

### 4. Sem o `any` das bibliotecas

- **`validado(req, origem, schema)` reaplica o schema** (`schema.parse(req[origem])`) e devolve
  `z.output<S>`. O `validar` volta a só conferir e responder, sem gravar em `res.locals`.
  - **Revisão de um padrão proposto na exploração** (a *augmentation* do `Locals`): o `LocalsObj`
    padrão do Express é `Record<string, any>`, e a interseção continua `any`, então a *augmentation*
    não resolveria. Um `WeakMap<Response, unknown>` tiraria o `any`, mas exigiria um `as` na leitura.
    Reaplicar o schema é tipado de ponta a ponta. O custo é rodar duas vezes um parse puro e barato
    (os `transform` não têm efeito colateral).
  - Se a rota não tiver rodado o `validar` daquela origem, o `parse` lança `ZodError` e cai no 500 da
    rota, como o erro de montagem de hoje.
  - Revê a decisão da etapa 6 (valor parseado em `res.locals`); o roteiro registra a mudança.
- **`erro: unknown`** no tratador de `erros.ts`. O `ErrorRequestHandler` aceita a anotação, e o
  estreitamento por `instanceof` já existe.

### 5. TypeScript lado a lado (spike primeiro)

```jsonc
// devDependencies
"typescript":  "npm:@typescript/typescript6@6.0.2",   // so o typescript-eslint importa este
"typescript7": "npm:typescript@7.0.2"                 // binario `tsc` (build e typecheck)
```

- O nome do alias do 7 **não** é `@typescript/native`: esse nome é um *peer* opcional do
  `@typescript-eslint/typescript-estree` com faixa `>=7.1.0-dev`, e instalar o 7.0.2 com ele geraria
  conflito de *peer*.
- Os scripts continuam chamando `tsc`. Pelos `bin` dos dois pacotes, o `node_modules/.bin/tsc` é o do
  7.0.2, e o 6.0.2 expõe só `tsc6`. **O spike confirma isso** (`npx tsc -v` → `7.0.2`), além de
  `npm run build`, `npm run typecheck`, `npm test` e um `npx eslint src` que carregue sem o erro
  `does not support TS 7.0`.
- **O editor:** o `typescript.tsdk`/a extensão do TS 7 do editor não fazem parte da change. O
  `AGENTS.md` registra a montagem para quem abrir o projeto.
- **Fallback:** se o spike falhar (o `tsc` resolver para o 6, conflito de instalação, o
  `typescript-eslint` não carregar), a montagem lado a lado é desfeita (`typescript` volta para
  `^7.0.2`), o ESLint é adiado e registrado no roteiro como pendente, e as demais decisões seguem.
  Essa troca é avisada ao usuário antes de prosseguir.
- **Alternativas descartadas** (na proposta): voltar o projeto para o TypeScript 6 (regride o
  compilador do build) e usar o backend experimental do 7.1 (pré-lançamento).

**Resultado do spike (2026-11-19): falhou.** O `@typescript/typescript6@6.0.2` é um invólucro que
depende de `@typescript/old` (= `typescript@^6`, resolvido para 6.0.3), e é esse pacote que expõe o
binário `tsc`: o `node_modules/.bin/tsc` passou a ser o TS 6.0.3. O TS 7 só funcionava por caminho
explícito. O `typescript-eslint` carregou. Opções apresentadas: chamar o TS 7 por caminho nos scripts
(com `npx tsc` e o editor no TS 6) ou o fallback. **O usuário escolheu o fallback:** a montagem foi
desfeita (`typescript` de volta para `^7.0.2`) e o ESLint ficou adiado. A Decisão 6 abaixo fica
registrada como o plano para quando o `typescript-eslint` suportar o TS 7 estável.

### 6. ESLint (adiado; plano para retomar)

`eslint.config.mjs` (configuração *flat*):

```
ignores: dist/, coverage/, node_modules/
@eslint/js recommended
typescript-eslint strictTypeChecked   (parserOptions.projectService: true)
eslint-config-prettier                (por ultimo: desliga as regras de estilo)

src/**/*.ts:
  @typescript-eslint/consistent-type-assertions: { assertionStyle: 'never' }   // sem `as`
  @typescript-eslint/no-unused-vars: argsIgnorePattern '^_'                   // _next, _req

test/**/*.ts:
  desliga no-unsafe-assignment, -member-access, -argument, -call, -return   (res.body e any)
  + o que mais acusar os testes existentes, uma regra por linha, com o motivo

*.mjs / *.mts de configuracao: disableTypeChecked
```

- **Política para o que o lint acusar em `src/`:** corrigir o código. Desligar uma regra só com
  justificativa num comentário na configuração e uma nota no roteiro.
- **Política para `test/`:** os testes não mudam (só formatação), então o que o lint acusar neles é
  resolvido por configuração, sempre com o motivo comentado.
- Script: `"lint": "eslint ."`.

### 7. Prettier

`.prettierrc.json`: `{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 120 }`.
`.prettierignore`: `dist/`, `coverage/`, `node_modules/`, `openspec/`, `docs/`, `*.md`, `*.yaml`, `*.json`,
o que limita o Prettier ao código. Scripts: `"format": "prettier --write ."` e
`"format:check": "prettier --check ."`.

- **Commit próprio:** a reformatação acontece logo depois da instalação das ferramentas e antes de
  qualquer mudança de tipos, só com a saída do `prettier --write`. A revisão é mecânica:
  `prettier --check` passa, `npm test` dá a mesma contagem e os mesmos nomes, e o diff não tem nada
  além de quebras de linha e literais numéricos (`50.00` → `50.0` no seed, mesmo valor).
- **Exceção ao invariante 2** (decisão do usuário): o roteiro passa a dizer que os `*.test.ts` só
  mudam na etapa 3, **exceto por formatação mecânica** (etapa 7), sem mudar asserção, nome ou
  contagem.

### 8. O que fica como está

- `quantidadeTotal(itens: readonly { quantidade: number | string }[])`, com um
  `@todo` dizendo que hoje só chegam números (schema e banco). Estreitar o tipo mudaria uma asserção
  em `test/dominio/precos.test.ts`.
- `import Database = require('better-sqlite3')` em `src/db/index.ts`: é TypeScript válido nos dois
  modos de módulo. A troca para `import Database from` só entra se o lint pedir.

## Risks / Trade-offs

- **[A montagem lado a lado não funcionar]** → spike como primeira task, com o fallback da Decisão 5,
  avisado ao usuário.
- **[TS 6 e TS 7 divergirem nos tipos]** → o `typecheck` (TS 7) é a fonte da verdade. O TS 6 só alimenta
  o lint. Uma divergência que o lint acuse e o `tsc` não, ou vice-versa, fica registrada e resolvida
  pelo código, nunca desligando o `typecheck`.
- **[O lint acusar muito em `src/`]** → o código das etapas 3 a 6 já segue a maior parte das regras.
  O que aparecer é corrigido na task do lint, com a política da Decisão 6.
- **[Reaplicar o schema esconder um erro de montagem]** → o comportamento é o de hoje (500 da rota). O
  parse é puro, então o resultado é idêntico ao do `validar`.
- **[`noUncheckedIndexedAccess` mudar centavos no relatório]** → as correções só mudam a forma de
  acessar, não a sequência de somas e arredondamentos; os testes do relatório comparam os valores
  exatos.
- **[Formatação esconder uma mudança de teste]** → commit próprio, revisão mecânica (Decisão 7).

## Migration Plan

Não há migração de dados nem de contrato. Para quem já tem o projeto, `npm install` instala a
montagem nova. Para reverter, basta um `git revert` dos commits da change.
