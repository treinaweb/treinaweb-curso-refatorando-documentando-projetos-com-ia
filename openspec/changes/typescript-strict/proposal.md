# Proposal

## Why

Esta change implementa a **etapa 7 (TypeScript estrito)** de `docs/refatoracao.md`.

As etapas 4 a 6 já fizeram a maior parte do que o roteiro previa:
- não há mais `.js` em `src/`;
- `strict: true` está ligado nos dois `tsconfig`;
- não existe `any` explícito;
- a entrada é tipada pelos schemas.

Ainda sobra, porém, o que o `strict` não pega:
- **15 `as`** nos repositories;
- o **`any` das bibliotecas**: o `res.locals` do Express, usado pelo `validar`, e o `erro` do tratador;
- **tipos de domínio** que moram na camada de dados;
- indexações que o compilador aceita sem conferir se a chave existe (11 casos com
  `noUncheckedIndexedAccess`);
- nada que impeça um `any` ou um `as` de voltar: hoje isso depende de `grep` e de revisão.

Esta etapa fecha essas portas antes da limpeza final (etapa 8).

## What Changes

- **Flags extras do compilador** nos dois `tsconfig`: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitReturns` e `noFallthroughCasesInSwitch`. Sai o `allowJs` (e o `checkJs`). As 11
  correções exigidas ficam em `src/services/relatorio.ts` e `src/http/middlewares/validar.ts`.
- **Sem `as` em `src/`:** os repositories passam a usar os genéricos do `better-sqlite3`
  (`db.prepare<Parametros, Linha>(sql)`), que também tipam os parâmetros dos `?`.
- **Sem o `any` das bibliotecas:**
  - o controller passa a obter a entrada validada reaplicando o schema da rota
    (`validado(req, origem, schema)`), sem guardar nada em `res.locals`;
  - o tratador de erros anota `erro: unknown`.
- **Tipos de domínio em `src/domain/tipos.ts`** (`Produto`, `Cliente`, `Pedido`, `ItemPedido`), com
  `tipo` e `status` como `string`, porque o banco aceita qualquer texto e as regras dependem disso.
  `TipoConhecido` (`'comum' | 'vip' | 'atacado'`) só confere as chaves de `REGRAS` e de
  `TIPOS_RELATORIO`. Os tipos de consulta (`PedidoComCliente`, `ItemComNome`...) continuam nos
  repositories.
- **ESLint** com `typescript-eslint` (configuração *flat*, regras *type-checked* estritas, `as`
  proibido em `src/`) e o script `npm run lint`. Em `test/`, como nenhuma asserção de teste muda, a
  família `no-unsafe-*` (o `res.body` do supertest é `any`) e qualquer outra regra que acuse os testes
  existentes são desligadas por configuração, com o motivo comentado.
- **TypeScript lado a lado:** o `typescript-eslint` atual (8.73) não carrega com o TypeScript 7. O
  pacote `typescript` passa a ser o alias do TypeScript 6.0.2 (`@typescript/typescript6`, binário
  `tsc6`), usado só pelo `typescript-eslint`, e o TypeScript 7.0.2 fica instalado com outro nome,
  como o `tsc` do build e do `typecheck`. A primeira task é um spike que prova essa montagem.
  **Fallback:** se ela não funcionar, o ESLint é adiado e registrado no roteiro como pendente, e o
  resto da change segue. **Aplicado:** o spike falhou (o `tsc` passou a ser o TS 6) e o usuário
  escolheu o fallback; veja o design, Decisão 5. Sem o lint, o "sem `as`/`any`" fica por `grep`.
- **Prettier** com o estilo atual (`semi: false`, `singleQuote: true`, `trailingComma: 'all'`,
  `printWidth: 120`), só para os arquivos de código (`.ts`, `.mts`, `.mjs`), com os scripts `format` e
  `format:check`. A reformatação (13 arquivos: 7 em `src/` e 6 em `test/`) vai num **commit
  próprio**, só com a saída do `prettier --write`.
- **Exceção ao invariante 2 do roteiro:** a reformatação mecânica dos testes é permitida, sem mudar
  nenhuma asserção, com o mesmo número de testes e os mesmos nomes. Fica registrada no roteiro.
- `quantidadeTotal(number | string)` continua como está. Estreitar o tipo mudaria uma asserção de
  teste de domínio. Um `@todo` registra que, hoje, só chegam números.
- **Docs:** `AGENTS.md` (comandos, Mapa, Convenções e a montagem lado a lado do TypeScript),
  README (os scripts novos) e `docs/refatoracao.md` (etapa 7 concluída, as decisões, a exceção ao
  invariante 2 e o registro de andamento).

## Capabilities

### New Capabilities

Nenhuma. É uma mudança de tipos e de ferramentas, sem mudança de comportamento: a change usa
`skip_specs: true`.

### Modified Capabilities

Nenhuma.

## Impact

- **API:** nenhuma mudança.
- **Código:**
  - `tsconfig.json` e `tsconfig.build.json`;
  - `src/repositories/*` (genéricos, sem `as`) e o novo `src/domain/tipos.ts`;
  - `src/services/*` e `src/http/*`, que importam os tipos do domínio;
  - `src/http/middlewares/validar.ts` e `erros.ts`, e os controllers, por causa da assinatura de
    `validado`;
  - `src/services/relatorio.ts` (indexação segura);
  - a formatação de 13 arquivos.
- **Ferramentas e dependências (dev):** `eslint`, `@eslint/js`, `typescript-eslint`, `prettier` e
  `eslint-config-prettier`; o `typescript` vira alias do 6.0.2, e o 7.0.2 fica com outro nome.
  Arquivos novos: `eslint.config.mjs`, `.prettierrc.json` e `.prettierignore`. Scripts novos: `lint`,
  `format` e `format:check`. Nenhuma dependência de produção muda.
- **Testes:** só formatação (commit próprio). Nenhuma asserção, nenhum nome e nenhum teste a mais ou
  a menos.
- **Fora de escopo:**
  - validar as linhas do banco em tempo de execução (Zod nos repositories);
  - o backend experimental do TypeScript 7.1 para o `typescript-eslint`;
  - mudanças de lógica;
  - estreitar `quantidadeTotal`;
  - formatar Markdown, YAML ou JSON;
  - a limpeza da etapa 8 (o texto dos testes que citam `descontos.js`, a revisão de dependências).
