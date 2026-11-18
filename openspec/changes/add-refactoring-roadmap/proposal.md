# Proposal

## Why

O projeto vai passar por uma refatoração completa: padrões de projeto, separação de responsabilidades, `async/await`, upgrade de dependências, validação com Zod e migração para TypeScript. Ela será feita em várias changes do OpenSpec, ao longo do tempo. As decisões já tomadas (ordem das etapas, o que pode ou não alterar testes, política de validação, o que fica de fora) estão só na conversa de exploração. Sem um documento versionado, cada change futura teria de redescobri-las, e elas acabariam divergindo.

## What Changes

- Novo `docs/refatoracao.md`: o roteiro da refatoração, usado como referência para propor as changes futuras. Contém:
  - os princípios e invariantes: o contrato HTTP protegido pelos testes de caracterização, e a regra de que **só a etapa de validação e correções altera testes**;
  - a arquitetura de destino (camadas `http` → `services` → `domain` / `repositories` → `db`) e os padrões adotados (Repository, Service layer, Strategy, Factory com injeção de dependência, middleware de erro);
  - as etapas, na ordem de execução, cada uma com o nome sugerido da change, objetivo, escopo, fora de escopo, decisões já tomadas, decisões em aberto, riscos e critério de pronto;
  - as decisões já confirmadas: as correções explícitas (itens 1 a 6), Zod na etapa de validação, a política de tipos estrita e as transações na camada de dados;
  - os padrões propostos e ainda não confirmados, marcados para confirmar na etapa correspondente;
  - o que fica **fora** da refatoração (regras de negócio *a confirmar*) e vira change própria depois;
  - um registro de andamento: a etapa, a change e o status.
- `AGENTS.md`: o roteiro entra no Mapa, e uma convenção diz que as changes de refatoração seguem `docs/refatoracao.md` e o atualizam ao concluir ou mudar uma etapa.
- Nenhuma alteração de código, testes, dependências ou comportamento da API.

## Capabilities

### New Capabilities

Nenhuma. A change é só de documentação e não altera comportamento observável (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- **Arquivos novos:** `docs/refatoracao.md`.
- **Arquivos alterados:** `AGENTS.md` (Mapa e Convenções).
- **Código, testes, `package.json`, `README.md`, `docs/openapi.yaml`:** sem impacto. O README é a referência para quem consome a API, e o roteiro é interno de desenvolvimento.
- **Changes futuras:** cada etapa do roteiro vira uma change (`/opsx:propose <nome-da-etapa>`) que cita o roteiro e, ao ser arquivada, atualiza o registro de andamento.
