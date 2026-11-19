# Proposal

## Why

Esta change implementa a **etapa 8 (Limpeza final)** de `docs/refatoracao.md`, a última do roteiro.

Depois das etapas 0 a 7, o código já está na arquitetura de destino. Sobra coerência:
- comentários e um nome de teste ainda mandam o leitor para arquivos que não existem mais (`app.js`,
  `routes/pedidos.js`, `routes/clientes.js`, `descontos.js`, `utils`);
- o roteiro, que hoje também guarda os pendentes (o ESLint adiado, as regras *a confirmar*), precisa
  ser encerrado sem que esses pendentes sumam de vista;
- a política de versões das dependências de produção não é uniforme.

## What Changes

- **Referências obsoletas nos testes** (só texto, decisão do usuário): os 10 pontos em 6 arquivos
  (`resumo`, `relatorio`, `pedidos`, `clientes`, `setup` e `helpers`) passam a citar os módulos atuais.
  O único nome de teste que muda é `'atacado usa descontos.js (15% com 10 unidades)'`, que passa a ser
  `'atacado usa a regra canonica (15% com 10 unidades)'`. Nenhuma asserção muda.
- **"Código legado" em `src/`:** os três comentários de `src/domain/precos/` (`dinheiro.ts`, `pedido.ts`
  e o `@todo` de `descontos.ts`) passam a descrever a origem sem apontar para código que não existe.
- **Dependências:** `zod` fixado em versão exata (`4.6.7`, a instalada), como `express` e
  `better-sqlite3`. As dependências de produção ficam todas exatas, e o `package-lock.json` não muda.
  O `@types/node` continua na versão maior 24, a do Node do `.nvmrc`.
- **`AGENTS.md`:**
  - nova seção **Pendências**, com links para o detalhe no roteiro: o ESLint adiado, as regras de
    negócio *a confirmar*, a unificação do formato de erro e os índices do schema;
  - a convenção "Refatoração" passa a dizer que o roteiro está concluído e é o registro das decisões
    da arquitetura atual;
  - o Mapa descreve o `docs/refatoracao.md` como histórico;
  - "Specs (quando existirem)" passa a listar os 4 specs que já existem;
  - uma nota de que o `@types/node` acompanha a versão maior do Node do `.nvmrc`.
- **Roteiro encerrado e mantido em `docs/refatoracao.md`** (decisão do usuário, opção A da decisão em
  aberto da etapa 8):
  - cabeçalho de concluído;
  - etapa 8 concluída;
  - uma nota "Arquitetura alcançada" com o que ficou diferente do destino planejado (por exemplo,
    factories em vez de classes `PedidoService`, regras como dados em vez de Strategy por classe);
  - "Fora da refatoração" e o ESLint adiado continuam lá como detalhe;
  - registro de andamento completo.

  O arquivo não muda de lugar, porque as changes arquivadas citam esse caminho.
- O `// TODO criar indices` do schema fica no código e entra em Pendências.

## Capabilities

### New Capabilities

Nenhuma. É limpeza de texto, documentação e uma linha do `package.json`, sem mudança de
comportamento: a change usa `skip_specs: true`.

### Modified Capabilities

Nenhuma.

## Impact

- **API:** nenhuma mudança.
- **Código de produção:** só os três comentários de `src/domain/precos/`.
- **Testes:**
  - comentários em 6 arquivos;
  - um nome de teste em `resumo.test.ts`.

  Nenhuma asserção, nenhum teste a mais ou a menos (166 e 1 todo). A `npx vitest list` muda em
  exatamente uma linha.
- **Dependências:** `zod` de `^4.6.7` para `4.6.7`, sem mudar a versão instalada nem o lock.
- **Docs:** `AGENTS.md` e `docs/refatoracao.md`. O README e o `docs/openapi.yaml` não mudam, porque já
  estão em dia.
- **Fora de escopo:**
  - criar os índices;
  - retomar o ESLint;
  - resolver as regras *a confirmar*;
  - unificar o formato de erro;
  - apagar as branches locais já integradas (limpeza do git local, fora da change).
