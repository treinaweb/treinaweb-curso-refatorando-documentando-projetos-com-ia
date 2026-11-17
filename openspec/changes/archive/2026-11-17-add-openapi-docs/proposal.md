# Proposal

## Why

O contrato da API só existe em prosa (README e JSDoc), que ferramentas não conseguem ler. Um arquivo OpenAPI estático e versionado permite navegar, validar e testar a API em ferramentas locais, como extensões do VS Code, sem subir nada novo nem mudar a aplicação.

## What Changes

- Novo `docs/openapi.yaml`: um único arquivo OpenAPI 3.0.3 em YAML, escrito à mão, com descrições em português, que cobre as 11 rotas existentes (produtos, clientes, pedidos, resumo, cancelamento, frete e relatório de vendas):
  - `tags` por recurso, `operationId` por operação, `components/schemas` reutilizáveis e `examples` tirados de respostas reais da API;
  - os dois formatos de erro (`{erro}` e `{error}`) modelados como schemas distintos, cada rota apontando para o seu;
  - o comportamento real e as divergências já conhecidas (resumo com `> 500`, relatório com `Math.round`) descritos nas `description`s, sem corrigir nada.
- `README.md` ganha um link para `docs/openapi.yaml`. O conteúdo atual é mantido.
- `AGENTS.md`: `docs/openapi.yaml` entra no mapa, e a regra de manutenção passa a incluí-lo (mudou rota ou regra, atualize README, JSDoc e OpenAPI).
- Nenhuma alteração de código, rotas, dependências ou comportamento da API. Nada é servido pela aplicação (sem Swagger UI, sem rota `/docs`).

## Capabilities

### New Capabilities

Nenhuma. A change é só de documentação e não altera comportamento observável (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- Arquivos novos: `docs/openapi.yaml`.
- Arquivos alterados: `README.md` (link) e `AGENTS.md` (mapa e convenção).
- Código, API, `package.json` e banco: sem impacto. A validação usa `npx @redocly/cli`, baixado na hora, sem entrar nas dependências.
- Manutenção: o OpenAPI passa a ser mais uma superfície a manter alinhada com `app.js` e `routes/`.
