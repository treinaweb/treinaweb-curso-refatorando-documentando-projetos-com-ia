# Design

## Context

Ver proposal.md (Why). Não existe `CLAUDE.md`, `AGENTS.md` nem spec em `openspec/specs/`. O README está desatualizado: lista `GET /pedidos` e `DELETE /pedidos/:id`, que não existem, e omite `/frete`, `/pedidos/:id/resumo`, `/relatorios/vendas` e `/pedidos/:id/cancelar`. As regras de desconto vivem em três lugares (`routes/pedidos.js`, `app.js` no resumo e no relatório) e as de frete em dois (`routes/pedidos.js`, `utils.calcula_frete`).

## Goals / Non-Goals

**Goals:**
- Dar a qualquer agente, logo no início da sessão, o contexto não óbvio e caro de errar.
- Manter um único arquivo de conteúdo, legível por várias ferramentas.
- Ficar curto (cerca de 60 a 120 linhas), já que o arquivo é carregado em toda sessão.

**Non-Goals:**
- Corrigir bugs ou divergências encontradas (SQL concatenado, regras duplicadas, falta de transação, rota de listagem perdida).
- Atualizar o README para humanos.
- Escrever specs OpenSpec das regras de negócio. Isso pode ser uma change futura.

## Decisions

1. **`AGENTS.md` como fonte da verdade e `CLAUDE.md` só com `@AGENTS.md`.**
   O AGENTS.md é lido nativamente por várias ferramentas, e o Claude Code lê `CLAUDE.md` e expande imports `@arquivo`.
   *Alternativas:* só `CLAUDE.md` (deixa outras ferramentas de fora); duas cópias (divergem com o tempo); symlink (comportamento inconsistente entre sistemas e ferramentas).

2. **`POST /pedidos` é a fonte canônica das regras de preço; divergências ficam "a confirmar".**
   É o código que efetivamente grava o valor cobrado. Assim o documento sai agora, sem esperar confirmação do negócio.
   *Alternativa:* confirmar as regras antes de escrever (bloquearia a entrega).

3. **Escrever em forma de instrução estável, sem descrever bugs pontuais.**
   Ex.: "regras de preço duplicadas em 3 lugares; ao mudar uma, alinhe todas ou pergunte", em vez de "o resumo usa `> 500`". Uma descrição de bug fica falsa quando ele é corrigido, e o agente passa a confiar em informação errada.

4. **Critério de inclusão: só o que é não óbvio ou caro de errar.**
   Fica de fora o que o agente descobre rápido lendo o código (dependências, schema completo, seed). A exceção é um "Mapa" de cerca de 5 linhas, que evita uma exploração inteira a cada sessão.

5. **Idioma português**, igual ao domínio e às mensagens do código.

6. **Instruções operacionais de segurança para agentes:** perguntar antes de apagar `loja.db` e verificar mudanças usando `DB_PATH=/tmp/loja-teste.db`, para não sujar o banco local.

7. **Formalizar a migração para `routes/` como convenção:** rotas novas vão em `routes/`, no estilo de `routes/clientes.js` e com SQL sempre parametrizado.

## Risks / Trade-offs

- [O documento desatualiza quando regras ou comandos mudam] → instruções estáveis em vez de descrições de bugs, mais o lembrete na própria seção de convenções de que mudança de regra exige atualizar o `AGENTS.md`.
- [Regra "a confirmar" pode ser tratada como definitiva pelo agente] → marcar explicitamente e instruir a perguntar antes de alterar.
- [Arquivo longo consome contexto em toda sessão] → limite de cerca de 120 linhas e critério de inclusão rígido.
- [A convenção de `routes/` pode não refletir a vontade do time] → é fácil de remover; registrada como decisão aqui para revisão.
