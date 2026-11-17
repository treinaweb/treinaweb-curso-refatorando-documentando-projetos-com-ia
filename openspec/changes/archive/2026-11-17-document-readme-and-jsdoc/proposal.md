# Proposal

## Why

O README não reflete mais a API. Ele documenta rotas que não existem (`GET /pedidos`, `DELETE /pedidos/:id`), omite cinco rotas reais e descreve só uma das regras de preço. O código também não tem documentação inline, então quem lê precisa reconstruir sozinho os contratos (despacho dinâmico de descontos, formato dos callbacks, quais rotas recalculam o preço) e as divergências entre as cópias das regras de preço.

## What Changes

- **README.md reescrito** para o estado atual: como rodar (`npm start`, Node 22, `PORTA`, `DB_PATH`), referência de todas as rotas existentes (parâmetros, corpo, respostas e erros), os dois formatos de erro (`{erro}` e `{error}`), um resumo das regras com link para o `AGENTS.md` e exemplos de `curl` verificados contra um banco descartável.
- **JSDoc** (`/** ... */`, em português) em todos os módulos: `app.js`, `routes/pedidos.js`, `routes/clientes.js`, `descontos.js`, `utils.js` e `db.js`. Cobre os handlers de rota, as funções exportadas e o contrato `desconto_<tipo>`.
- **Divergências documentadas como estão, sem corrigir.** Os docs descrevem o comportamento real e marcam as divergências com `@todo`:
  - `GET /pedidos/:id/resumo` usa `> 500` no desconto `comum` (`POST /pedidos` usa `>= 500`) e recalcula o desconto em vez de ler `pedidos.desconto`;
  - `GET /relatorios/vendas` recalcula o desconto com `Math.round` (reais inteiros), e o faturamento pode não bater com `pedidos.total`;
  - o comentário de `descontos.js` ("só acima de R$ 200") não corresponde ao código, que aplica 10% sobre qualquer valor *(a confirmar)*;
  - o frete existe duplicado em `routes/pedidos.js` e em `utils.calcula_frete`;
  - `GET /frete` usa o CEP da query string, não o do cadastro (é uma simulação);
  - `utils.formata_moeda` não é usada.
- **AGENTS.md atualizado:** sai a nota de que o README está desatualizado e entra a convenção de JSDoc para código novo.
- Nenhuma alteração de lógica, rotas, SQL, banco ou respostas da API. Os comentários existentes ficam no lugar (inclusive o de `descontos.js`, que é *a confirmar*); a divergência é registrada ao lado deles.

## Capabilities

### New Capabilities

Nenhuma. A change é só de documentação e não altera comportamento observável (`skip_specs: true`).

### Modified Capabilities

Nenhuma.

## Impact

- Arquivos alterados: `README.md`, `AGENTS.md` e comentários em `app.js`, `routes/pedidos.js`, `routes/clientes.js`, `descontos.js`, `utils.js` e `db.js`.
- Código executável, API, dependências e banco: sem impacto (sem nova dependência, sem gerador de docs).
- Manutenção: README e JSDoc passam a ser mais uma superfície a manter alinhada quando regras ou rotas mudarem.
