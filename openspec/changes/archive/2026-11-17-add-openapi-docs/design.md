# Design

## Context

Veja proposal.md (seção Why). As rotas estão em `app.js` e `routes/` e já foram mapeadas, com respostas reais capturadas, na change arquivada `2026-11-17-document-readme-and-jsdoc`. O README e o JSDoc descrevem o mesmo contrato em prosa. A API não tem autenticação, tem dois formatos de erro, um relatório com chaves dinâmicas por tipo de cliente e parâmetros `:id` que não são validados (em rotas com SQL concatenado, um id não numérico pode gerar 500).

## Goals / Non-Goals

**Goals:**
- Um arquivo que extensões do VS Code abram sem erros e que permita navegar e testar todas as operações.
- O spec descreve a API como ela é hoje, incluindo os comportamentos estranhos.

**Non-Goals:**
- Servir a documentação pela API, adicionar UI (`docs/index.html`) ou mudar o `package.json`.
- Gerar o spec a partir do código ou do JSDoc, ou gerar clientes.
- Corrigir divergências, validar `:id` ou padronizar erros.

## Decisions

### D1. OpenAPI 3.0.3, não 3.1
O consumidor é "alguma extensão do VS Code", ainda não definida, e o suporte à 3.0.x é universal enquanto o da 3.1 varia. A API não usa nada exclusivo da 3.1 (nulos, `webhooks`, `const`).
*Alternativa:* 3.1.0. É mais moderna, mas com risco de incompatibilidade sem nenhum ganho aqui.

### D2. Um único YAML escrito à mão
`docs/openapi.yaml`, sem `$ref` para arquivos externos (algumas extensões resolvem mal referências entre arquivos). YAML permite comentários e diffs legíveis.
*Alternativas:* gerar via `swagger-jsdoc` (exige reescrever o JSDoc em `@openapi`, mais uma dependência e um build); JSON (mais verboso, sem comentários).

### D3. Organização
- `info` (título, versão `1.0.0` alinhada ao `package.json`, descrição com o aviso de uso interno e sem autenticação); `servers: http://localhost:3000`; sem `security`.
- `tags`: Produtos, Clientes, Pedidos, Frete, Relatórios.
- `operationId` em camelCase português: `listarProdutos`, `buscarProduto`, `listarClientes`, `buscarCliente`, `criarCliente`, `criarPedido`, `buscarPedido`, `resumoPedido`, `cancelarPedido`, `simularFrete`, `relatorioVendas`.
- `components/schemas`: `Produto`, `Cliente`, `NovoCliente`, `Pedido`, `ItemPedido`, `PedidoDetalhe`, `NovoPedido`, `Resumo`, `Frete`, `Totais`, `RelatorioVendas`, `Erro`, `ErrorClientes`.
- `components/parameters`: `IdPath` reaproveitado.

### D4. Dois schemas de erro
`Erro` (`{ erro: string }`) para produtos, pedidos, frete e relatórios; `ErrorClientes` (`{ error: string }`) para clientes. Cada resposta de erro aponta para o schema real da rota, e os exemplos listam as mensagens exatas.
*Alternativa:* um schema único com `oneOf`. Esconderia qual formato cada rota usa.

### D5. Relatório com chaves dinâmicas
`RelatorioVendas` é um `object` com `geral` (`$ref Totais`) obrigatório e `additionalProperties: $ref Totais` para os tipos de cliente. Os exemplos mostram o caso vazio (só `geral`) e o caso com `comum` e `vip`.

### D6. `:id` declarado como inteiro, comportamento real na descrição
O parâmetro é `type: integer`, que é o contrato pretendido. Se a verificação confirmar que um id não numérico gera 500 em `GET /pedidos/{id}/resumo`, isso entra na `description` da operação e é listado como resposta 500. Nada é inventado: os status documentados são os observados com `curl`.

### D7. Divergências na `description`
O texto segue os avisos do README (resumo com `> 500`; relatório com `Math.round`, que não bate com `pedidos.total`). Não é criada extensão `x-*`, porque nenhuma ferramenta a consumiria.

### D8. Exemplos reais
Os `examples` vêm de chamadas a uma API com banco recém-criado (`DB_PATH=/tmp/loja-openapi.db PORTA=3999`). O `loja.db` local não é tocado.

### D9. Validação
`npx --yes @redocly/cli@latest lint docs/openapi.yaml`, sem adicionar dependência. A ferramenta é baixada só na execução. Os warnings de estilo do Redocly que não se aplicam a uma API interna (por exemplo `info-license`, `operation-4xx-response` em rotas sem 4xx) podem ficar como warnings, mas erros não são aceitos.

## Risks / Trade-offs

- [O spec diverge do código quando uma rota mudar] → O `AGENTS.md` passa a exigir a atualização do `docs/openapi.yaml` junto com README e JSDoc. A conferência das rotas segue o mesmo `grep` usado para o README.
- [Uma extensão específica do VS Code tem uma limitação não prevista] → 3.0.3 e arquivo único reduzem o risco. Ajustes pontuais podem vir depois sem mudar o desenho.
- [`npx` precisa de rede para baixar o Redocly] → Se não houver rede, a validação mínima é o parse do YAML com Node, e a falta do lint é registrada.
