# Proposal

## Why

Agentes de IA (Claude Code, Codex, Cursor etc.) iniciam cada sessão sem contexto sobre a Loja API. Eles precisam redescobrir o projeto a cada vez e tendem a errar justamente no que não é óbvio: as regras de preço estão duplicadas e divergentes, o frete tem uma restrição acordada com o comercial, pedidos são cancelados em vez de excluídos, não há testes e o README está desatualizado. Um arquivo de contexto carregado automaticamente reduz esse custo e evita alterações erradas em regras de negócio.

## What Changes

- Novo `AGENTS.md` na raiz: fonte única de contexto para agentes, com como rodar e verificar, mapa dos arquivos, regras de negócio canônicas, restrições e decisões, armadilhas conhecidas e convenções de código e de fluxo de trabalho (OpenSpec).
- Novo `CLAUDE.md` na raiz contendo apenas o import `@AGENTS.md`, para o Claude Code carregar o mesmo conteúdo sem duplicação.
- Divergências de regra ainda não confirmadas pelo negócio (limite do desconto VIP; `>=` vs `>` R$ 500 no desconto comum) ficam registradas como "a confirmar", com o comportamento de `POST /pedidos` como canônico.
- Nenhuma alteração de código, rotas, banco ou comportamento da API.

## Capabilities

### New Capabilities

Nenhuma. A change é só de documentação e não altera comportamento observável (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- Arquivos novos: `AGENTS.md`, `CLAUDE.md` (raiz do repositório).
- Código, API, dependências e banco: sem impacto.
- Manutenção: o `AGENTS.md` precisa ser atualizado quando regras de negócio, comandos ou convenções mudarem.
