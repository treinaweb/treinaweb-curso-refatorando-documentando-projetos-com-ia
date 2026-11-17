# Tasks

## 1. JSDoc nos módulos de apoio

- [x] 1.1 Documentar `descontos.js`: cabeçalho do módulo explicando o contrato `desconto_<tipo>(subtotal, itens) -> number` (2 casas) e onde ele é despachado (`POST /pedidos`, `GET /pedidos/:id/resumo`; o relatório não usa); JSDoc em `desconto_vip` com `@todo Diverge de` sobre o comentário "só acima de R$ 200" (a confirmar), mantendo o comentário original; JSDoc em `desconto_atacado`. Verificar com `node -e "require('./descontos')"` e com `git diff descontos.js`, que deve mostrar só linhas de comentário adicionadas
- [x] 1.2 Documentar `utils.js`: `buscar_cliente` (callback `(err, cliente)`, observar que concatena SQL), `validaCep` (8 dígitos, hífen opcional, retorna sem hífen ou `null`), `calcula_frete` (faixas e `@todo Diverge de` sobre a cópia em `routes/pedidos.js`), `formata_moeda` (marcada como sem uso). Verificar com `node -e "const u=require('./utils');console.log(u.validaCep('01310-100'),u.calcula_frete('01310100',100))"` → `01310100 15`
- [x] 1.3 Documentar `db.js`: cabeçalho com `DB_PATH`, criação do schema e seed só quando o arquivo não existe, tabelas e o fato de exportar a conexão sqlite3 serializada. Verificar com `git diff db.js`, que deve mostrar só comentários

## 2. JSDoc nas rotas

- [x] 2.1 Documentar `routes/clientes.js`: cabeçalho do router e JSDoc em `listarClientes`, `buscarCliente` e `criarCliente` (body, tipo sempre `comum`, respostas e erros no formato `{error}`). Verificar com `git diff`, que deve mostrar só comentários
- [x] 2.2 Documentar `routes/pedidos.js`: cabeçalho do router, `getPedido` e o bloco acima de `router.post('/')` com validações, cálculo (subtotal, desconto via `descontos`, frete pelo CEP do cadastro), baixa de estoque, resposta 201 e erros (400/404/500). Incluir `@todo Diverge de` sobre o frete duplicado em `utils.calcula_frete` e notas de ausência de transação. Verificar com `git diff`, que deve mostrar só comentários
- [x] 2.3 Documentar `app.js`: cabeçalho do bootstrap (`PORTA`, middleware de log, montagem dos routers) e um bloco acima de cada rota: `GET /produtos` (busca), `GET /produtos/:id`, `GET /frete` (simulação com CEP da query), `GET /pedidos/:id/resumo` (`@todo Diverge de POST /pedidos` sobre `> 500` e o recálculo), `GET /relatorios/vendas` (`@todo Diverge de` sobre `Math.round` e o recálculo), `POST /pedidos/:id/cancelar` (só a partir de `criado`, devolve estoque); nota no bloco do `DELETE` comentado dizendo que a desativação é proposital. Verificar com `git diff`, que deve mostrar só comentários
- [x] 2.4 Verificar o grupo: `grep -rn "Diverge de" --include=*.js . | grep -v node_modules` lista todas as divergências do proposal (resumo `>`, relatório `Math.round`, vip, frete duplicado); `git diff -U0 -- '*.js' | grep '^[+-]' | grep -v '^+++\|^---'` só contém linhas de comentário

## 3. README e AGENTS.md

- [x] 3.1 Subir a API em banco descartável (`DB_PATH=/tmp/loja-doc.db PORTA=3999 node app.js`, com Node 22 no PATH) e capturar, com `curl`, respostas reais de todas as rotas: produtos (com e sem `busca`), clientes (listar, detalhe, criar), pedidos (criar, detalhe, resumo, cancelar, cancelar de novo → 400), frete e relatório, além de um erro de cada formato (`{erro}` e `{error}`). Verificar que toda rota documentada respondeu e que `GET /pedidos` e `DELETE /pedidos/1` retornam 404
- [x] 3.2 Reescrever o `README.md` conforme D5: visão geral, como rodar (`npm install`, `npm start`, Node 22, `PORTA`, `DB_PATH`, banco recriado ao apagar o arquivo), referência de rotas por recurso com parâmetros, respostas e erros, formatos de erro, resumo das regras com link para o `AGENTS.md`, notas de divergência em resumo/relatório e exemplos de `curl` tirados de 3.1. Verificar que a lista de rotas do README bate 1:1 com `grep -rnE "(app|router)\.(get|post|put|delete)\(" app.js routes/` (excluindo o `DELETE` comentado) e que cada exemplo de `curl` roda como escrito contra a instância de 3.1
- [x] 3.3 Atualizar o `AGENTS.md`: remover a nota "O README está desatualizado...", acrescentar nas Convenções que código novo leva JSDoc em português e que divergências usam `@todo Diverge de ...`, e acrescentar que mudanças de regra ou rota atualizam README e JSDoc junto. Verificar relendo o arquivo e conferindo que nenhuma regra de negócio mudou (`git diff AGENTS.md`)

## 4. Verificação final

- [x] 4.1 Com o banco descartável recriado do zero, subir a API e repetir o `POST /pedidos` do exemplo do README, conferindo a mesma resposta registrada; confirmar com `git status` que `loja.db` não foi alterado e com `git diff --stat` que só os arquivos previstos no proposal mudaram
