# Design

## Context

Veja proposal.md (seção Why). O código mistura dois estilos: o legado (`var`, callbacks, SQL concatenado) em `app.js`, `routes/pedidos.js` e `utils.js`, e o moderno em `routes/clientes.js`. Vários handlers de `app.js` são funções anônimas passadas direto para `app.get`/`app.post`. As regras de preço existem em várias cópias que já divergem; o `AGENTS.md` trata `POST /pedidos` como canônico e marca dois itens como *a confirmar*. Não há testes: a verificação é feita com `curl` contra `DB_PATH=/tmp/...`.

## Goals / Non-Goals

**Goals:**
- Quem lê qualquer função ou rota entende o contrato (entrada, saída, erros) e sabe se ela diverge da regra canônica.
- O README serve de referência da API para quem a consome, com exemplos reproduzíveis.

**Non-Goals:**
- Corrigir divergências, padronizar o formato de erro, parametrizar SQL ou refatorar handlers anônimos em funções nomeadas.
- Gerar site de documentação, adicionar `jsdoc`/TypeScript ou `// @ts-check`.
- Criar specs OpenSpec do contrato atual da API (pode virar uma change futura).

## Decisions

### D1. JSDoc puro, sem ferramenta
`/** ... */` com `@param {tipo}`, `@returns`, `@callback` e `@todo`. O editor já usa isso no hover, e não há dependência nova.
*Alternativas:* gerador `jsdoc` (exige dependência e build sem consumidor claro); `// @ts-check` (acenderia erros no código legado e amplia o escopo).

### D2. Handlers anônimos: bloco acima da chamada de rota
Em `app.js` e `routes/pedidos.js`, o bloco JSDoc fica imediatamente acima de `app.get(...)`/`router.post(...)` e descreve a rota: método e caminho, query/params/body, resposta de sucesso com status, erros com status e mensagem. Handlers nomeados (`routes/clientes.js`, `getPedido`) recebem o bloco na própria função.
*Alternativa:* extrair os handlers para funções nomeadas. É refactor e fica fora deste escopo.

### D3. Convenção de marcação de divergência
Toda divergência usa `@todo` e começa com `Diverge de <fonte canônica>:`, seguido do comportamento real. Exemplo:
`@todo Diverge de POST /pedidos: aplica 5% ao comum só com subtotal > 500 (lá é >= 500).`
Itens *a confirmar* com o negócio levam também a expressão `(a confirmar)`. Um padrão fixo permite listar todas com `grep -rn "Diverge de" --include=*.js`.
*Alternativa:* comentários livres. Seriam inconsistentes e difíceis de achar.

### D4. Comentários existentes ficam como estão
O comentário `// vip ganha 10% so acima de 200 reais` e o `// nao mexer: frete gratis...` permanecem. O JSDoc adicionado ao lado registra o comportamento real e a divergência. Remover ou reescrever o comentário do VIP seria decidir um item *a confirmar*.

### D5. README como referência da API; regras resumidas com link
O README traz: visão geral, como rodar, variáveis, referência das rotas (agrupadas por recurso: produtos, clientes, pedidos, frete, relatórios), formatos de erro e exemplos. As regras de negócio aparecem como resumo curto (desconto por tipo, frete, estoque, ciclo de vida, pedidos não são excluídos), com link para o `AGENTS.md` como fonte detalhada. Divergências relevantes para quem consome a API (resumo e relatório podem mostrar desconto ou faturamento diferente do gravado) são citadas na rota correspondente.
*Alternativa:* duplicar todas as regras no README. Criaria uma terceira cópia sujeita a divergência.

### D6. Exemplos do README vêm de execução real
Os exemplos de resposta são capturados chamando a API com `DB_PATH=/tmp/loja-doc.db PORTA=3999 node app.js` (banco recém-criado com o seed), não escritos à mão. O `loja.db` local não é tocado.

### D7. Idioma e estilo
Português, como o domínio. Sem alterar indentação nem o estilo (`var`/`const`) do código ao redor: só são inseridas linhas de comentário.

## Risks / Trade-offs

- [Docs e código voltam a divergir quando uma regra mudar] → O `AGENTS.md` ganha a orientação de atualizar JSDoc e README junto com a regra, e o padrão `Diverge de` facilita a revisão.
- [Uma edição de comentário altera código sem querer] → Na verificação, `git diff` filtrado deve mostrar só linhas de comentário nos `.js`; a API sobe e as rotas respondem como antes.
- [Exemplos com valores do seed ficam velhos se o seed mudar] → Aceito. Os exemplos indicam que vêm de um banco recém-criado.
