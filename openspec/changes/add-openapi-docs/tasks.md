# Tasks

## 1. Capturar o comportamento real

- [x] 1.1 Subir a API em banco descartável (`DB_PATH=/tmp/loja-openapi.db PORTA=3999 node app.js`, com Node 22 no PATH) e capturar com `curl` as respostas de todas as 11 rotas e de cada erro documentado no README; incluir o relatório com banco vazio e testar `GET /pedidos/abc/resumo` e `GET /pedidos/abc` para registrar o status real com id não numérico. Verificar que toda rota respondeu e que o arquivo de captura em scratchpad tem os 11 sucessos e os erros

## 2. Escrever o OpenAPI

- [x] 2.1 Criar `docs/openapi.yaml` com `openapi: 3.0.3`, `info`, `servers`, `tags`, `components/schemas` e `components/parameters` conforme D3–D5. Verificar que o YAML faz parse com `npx --yes js-yaml docs/openapi.yaml > /dev/null` (código de saída 0)
- [x] 2.2 Adicionar as operações de Produtos, Clientes e Frete (`listarProdutos`, `buscarProduto`, `listarClientes`, `buscarCliente`, `criarCliente`, `simularFrete`) com parâmetros, corpos, respostas, erros com o schema certo (`Erro` vs `ErrorClientes`) e exemplos de 1.1. Verificar que cada status documentado aparece na captura de 1.1
- [x] 2.3 Adicionar as operações de Pedidos e Relatórios (`criarPedido`, `buscarPedido`, `resumoPedido`, `cancelarPedido`, `relatorioVendas`) com exemplos de 1.1, as divergências nas `description`s (D7) e o comportamento de id não numérico conforme observado (D6). Verificar que cada status documentado aparece na captura de 1.1
- [x] 2.4 Validar com `npx --yes @redocly/cli@latest lint docs/openapi.yaml` (sem erros; warnings de estilo justificados em D9 são aceitos) e conferir que as operações do spec batem 1:1 com as rotas de `grep -nE "^(app|router)\.(get|post|put|delete)\(" app.js routes/*.js` (excluindo o `DELETE` comentado)

## 3. README e AGENTS.md

- [x] 3.1 Adicionar ao `README.md` um link para `docs/openapi.yaml` (com uma frase sobre o uso em ferramentas locais, como extensões do VS Code), sem alterar o restante. Verificar com `git diff README.md`, que deve mostrar só a adição
- [x] 3.2 Atualizar o `AGENTS.md`: incluir `docs/openapi.yaml` no Mapa e estender a regra "ao mudar uma regra ou rota, atualize README e JSDoc" para incluir o OpenAPI. Verificar com `git diff AGENTS.md`, que não deve mudar nenhuma regra de negócio

## 4. Verificação final

- [x] 4.1 Confirmar com `git status` e `git diff --stat` que só mudaram `docs/openapi.yaml`, `README.md` e `AGENTS.md` (mais a pasta da change), que `package.json` e o código ficaram intactos e que o `loja.db` local não foi modificado (mtime igual ao anterior)
