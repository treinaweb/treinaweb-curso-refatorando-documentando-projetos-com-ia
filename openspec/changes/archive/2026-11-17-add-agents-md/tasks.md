# Tasks

## 1. AGENTS.md

- [x] 1.1 Criar `AGENTS.md` na raiz com as seções: descrição curta (stack, uso interno, sem auth), "Rodar e verificar", "Mapa", "Regras de negócio", "Armadilhas" e "Convenções", seguindo o rascunho aprovado na exploração e as decisões do design.md. Verificar que o arquivo existe e tem no máximo cerca de 120 linhas (`wc -l AGENTS.md`).
- [x] 1.2 Em "Regras de negócio", declarar `POST /pedidos` como fonte canônica e marcar como "a confirmar" o limite do desconto VIP e o `>=` vs `>` R$ 500. Verificar relendo `routes/pedidos.js:88-111` e `descontos.js` e conferindo que percentuais, limites e faixas de frete do documento batem com o código.
- [x] 1.3 Em "Convenções", incluir o lembrete de que mudanças em regras de negócio, comandos ou convenções devem atualizar o `AGENTS.md`. Verificar que a frase está presente.
- [x] 1.4 Conferir cada caminho e comando citado: os arquivos existem (`ls app.js db.js descontos.js utils.js routes/`), as variáveis `PORTA` e `DB_PATH` aparecem no código (`grep -n "PORTA\|DB_PATH" app.js db.js`) e `DB_PATH=/tmp/loja-teste.db PORTA=3999 node app.js` sobe a API e responde a `curl localhost:3999/produtos`.

## 2. CLAUDE.md

- [x] 2.1 Criar `CLAUDE.md` na raiz contendo apenas `@AGENTS.md`. Verificar com `cat CLAUDE.md`; numa nova sessão do Claude Code, conferir com `/memory` que o conteúdo do `AGENTS.md` é carregado.
