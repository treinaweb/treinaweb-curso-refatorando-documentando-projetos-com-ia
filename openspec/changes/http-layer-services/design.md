# Design

## Context

Etapa 6 de `docs/refatoracao.md` (veja proposal.md - Why). Estado atual (verificado no código):

```
src/app.ts  createApp({ db })
  express.json(), log inline, 7 validadores validar(...), criarRepositorios(db), precos
  |-- createLegadoRouter(r, v, precos)   raiz: /produtos, /produtos/:id, /frete,
  |                                      /pedidos/:id/resumo, /relatorios/vendas, /pedidos/:id/cancelar
  |-- createClientesRouter(r, v)         /clientes: GET /, GET /:id, POST /      ({error})
  +-- createPedidosRouter(r, v, precos)  /pedidos: GET /:id, POST /
```

- Cada handler é `async`, e cada `await` de repository fica num `try/catch` com `console.log(err)` (em
  clientes, `console.error`) e a mensagem 500 da rota. Duas rotas têm duas mensagens, conforme a fase:
  `GET /pedidos/:id` (`Erro ao buscar pedido` / `Erro ao buscar itens`) e `POST /pedidos`
  (`Erro interno` na leitura / `Erro ao salvar pedido` na gravação). As mensagens estão no spec
  `falhas-do-banco` e são todas cobertas por testes.
- O `validar` só confere a entrada e chama `next()`. Os handlers releem a entrada crua: o `/frete` e o
  `POST /clientes` chamam `validaCep` de novo, e o `/frete` faz `parseFloat(subtotal) || 0`.
- O corpo JSON malformado faz o `express.json()` chamar `next(err)` no nível do app. Sem tratador de
  erro registrado, o Express responde 400 com a página HTML padrão. Nenhum teste cobre esse caso.
- No Express 5, `req.query` é um *getter* e não pode ser reatribuído.
- `tsconfig` com `strict: true` e `allowJs`. Os módulos novos nascem em TS. O `allowJs` sai na etapa 7.
- Linha de base: 163 testes passando e 1 `it.todo`.

## Goals / Non-Goals

**Goals:**
- Nenhum `try/catch` em controller. Os únicos `try` que restam ficam nos services, para marcar a fase
  de uma falha do banco.
- O controller nunca toca em repository (conferível com `grep`).
- Cada rota declara, num lugar só, as mensagens 500 que usa.
- `src/routes/` e `src/utils.js` deixam de existir. Nenhum `.js` novo em `src/`.

**Non-Goals:**
- Mudar o contrato HTTP (status, corpos, mensagens, ordem das chaves) ou consultas.
- Tipar todo o código a partir de `z.infer` e remover `as` em geral (etapa 7). Nesta etapa, só a
  leitura da entrada validada é tipada pelo schema.
- Tratador de erro no nível do app.

## Decisions

### 1. Estrutura e fluxo

```
src/
  app.ts                    createApp({ db }): json, log, repositorios -> services -> routers
  http/
    routes/                 produtos, clientes, frete, pedidos, relatorios   (montagem + mensagens 500)
    controllers/            leem res.locals.validado, chamam o service, respondem
    middlewares/            validar.ts, erros.ts, log.ts
    schemas/                (os da etapa 3, com transform no CEP e no subtotal)
  services/                 produtos, clientes, frete, pedidos, relatorio + erros.ts (FalhaDoBanco)
  domain/
    precos/                 (etapa 5)
    pedido.ts               StatusPedido, podeCancelar
    erros.ts                NaoEncontrado, EstoqueInsuficiente, TransicaoInvalida
  repositories/, db/        (sem mudanca)

requisicao -> validar (400/404 direto) -> controller -> service -> domain / repositories
                                             |  throw
                                             v
                                         falhas(...) da rota -> { erro | error } + status
```

- **Montagem por recurso:** `/produtos`, `/frete`, `/clientes`, `/pedidos` (inclusive `/:id/resumo` e
  `/:id/cancelar`) e `/relatorios` (`GET /vendas`). Os caminhos atendidos são os mesmos de hoje: o
  router montado em `/produtos` com `get('/')` atende `/produtos` e `/produtos/`, como o `get('/produtos')`
  na raiz atendia, sem roteamento estrito. As rotas inexistentes continuam caindo no 404 HTML do
  Express.
- **Factories, sem classes:** `criarServices(repositorios)` devolve
  `{ produtos, clientes, frete, pedidos, relatorio }`, cada um um objeto de métodos `async`, no estilo
  de `criarRepositorios`. Os routers são `criarXRouter(services)`. Os controllers são funções criadas
  junto do router, com o service no escopo.
- **Injeção:** só os repositories dependem do `db` e por isso continuam injetados. O domínio de preços
  e os schemas são importados direto. O argumento que justificava injetá-los ("o JS legado não
  importa `.ts` sob o Vitest") deixa de valer quando não há mais JS nas rotas.
- **Alternativa descartada:** classes (`PedidoService`) com construtor. Não traz nada sobre as
  factories e destoa dos repositories.

### 2. Erros tipados e mensagens 500 por fase

```ts
// src/domain/erros.ts (sem HTTP: so a classe e a mensagem)
class NaoEncontrado extends Error {}        // 'Produto nao encontrado', 'Produto 5 nao encontrado',
                                            // 'Cliente nao encontrado', 'Pedido nao encontrado'
class EstoqueInsuficiente extends Error {}  // 'Estoque insuficiente para <nome>'
class TransicaoInvalida extends Error {}    // 'Pedido nao pode ser cancelado (status <status>)'

// src/services/erros.ts
class FalhaDoBanco extends Error { constructor(readonly fase: string, readonly causa: unknown) }
```

O tratador, em `src/http/middlewares/erros.ts`, é criado por router com o formato e é aplicado por
rota com o mapa de mensagens 500:

```ts
const falhas = tratarErros('erro')             // ou 'error' em clientes
router.get('/:id', idPedido, controller.buscar,
  falhas({ padrao: 'Erro ao buscar pedido', itens: 'Erro ao buscar itens' }))
```

| Erro recebido | Status | Mensagem |
|---|---|---|
| `NaoEncontrado` | 404 | a do erro |
| `EstoqueInsuficiente`, `TransicaoInvalida` | 400 | a do erro |
| `FalhaDoBanco(fase)` | 500 | `mensagens[fase]` (`padrao` se a fase não estiver no mapa) |
| qualquer outro | 500 | `mensagens.padrao` |

- **A causa é logada** com `console.error` nos casos de 500, unificando o `console.log` do legado. Não
  é contrato: os testes silenciam os dois.
- **Só duas fases embrulham a falha:** `itens` em `GET /pedidos/:id` e `gravacao` em `POST /pedidos`.
  Nas demais rotas, o erro cru do repository cai em `padrao`, e o service não precisa de `try`.
- **Middleware de erro no fim da rota, não do router:** no Express 5, um tratador com 4 argumentos
  colocado na pilha da rota recebe as rejeições do controller dessa rota. Assim cada rota declara as
  suas mensagens sem metadado na requisição. Um tratador no nível do router precisaria descobrir qual
  rota falhou.
- **Sem tratador no nível do app:** o erro do `express.json()` acontece antes dos routers e não passa
  pelos tratadores das rotas, que estão em routers montados como middleware comum. A resposta ao JSON
  malformado continua a do Express (fixada pelo teste da Decisão 7).
- **O domínio não conhece status HTTP:** o mapeamento classe → status fica no tratador.
- **O `validar` continua respondendo direto** (400 ou o 404 do id), sem lançar erro. Não há ganho em
  passar pelo tratador, e as mensagens da etapa 3 ficam intactas.
- **Alternativas descartadas** (na exploração): o controller rotular cada chamada
  (`comFalha('...', fn)`), que traz o `try` de volta com outro nome; e quebrar o caso de uso por fase,
  que deixaria a orquestração no controller.

### 3. Entrada validada com a saída do parse

- O `validar` passa a guardar `resultado.data` em `res.locals.validado[origem]` (`body`, `query` ou
  `params`). As mensagens, o formato e o status da rejeição não mudam. `req.query` não pode ser
  reatribuído no Express 5, e guardar por origem evita colisão se uma rota validar duas partes.
- Um helper tipado lê o valor pelo schema (`validado(res, 'body', criarPedidoSchema)`, com o tipo de
  saída do schema). Assim o controller não usa `as`.
- **`cepSchema`:** a regra do `validaCep` passa para o próprio schema (`trim`, regex
  `/^\d{5}-?\d{3}$/`) e um `transform` devolve o CEP sem espaços e sem hífen. `src/utils.js` sai.
- **`subtotal` do `/frete`:** um `transform` devolve `0` para ausente ou vazio e `parseFloat(valor)`
  para o resto, que já passou pela regex. É o mesmo resultado de `parseFloat(x) || 0` para toda entrada
  aceita, inclusive `"0"` e `"007"`.
- **Ids do path continuam texto**, sem `transform`. `/produtos/01` continua achando o produto 1 pela
  afinidade do SQLite, e um id gigante não perde precisão como perderia num `Number`.
- **Revisão de decisão:** a etapa 3 registrou que o `validar` "não altera a requisição". Continua
  verdade (`req` não muda), mas o valor parseado passa a ser a fonte da entrada. O roteiro registra a
  mudança.

### 4. Services: o que cada um faz

| Service | Passos (na ordem atual) | Erros |
|---|---|---|
| `produtos.listar(busca)` / `buscar(id)` | repository | `NaoEncontrado('Produto nao encontrado')` |
| `clientes.listar()` / `buscar(id)` | repository | `NaoEncontrado('Cliente nao encontrado')` |
| `clientes.criar({ nome, email, cep })` | grava; devolve `{ id, nome, email, cep, tipo: 'comum' }` | - |
| `frete.simular(cep, subtotal)` | `precos.frete`; devolve `{ cep, subtotal, frete }` | - |
| `pedidos.buscar(id)` | pedido; itens (fase `itens`); devolve `{ ...pedido, itens }` | `NaoEncontrado('Pedido nao encontrado')` |
| `pedidos.criar({ cliente_id, itens })` | cliente; se existe, produtos; item a item: existe? estoque?; preços pelo domínio; grava (fase `gravacao`) | `NaoEncontrado('Cliente nao encontrado')`, `NaoEncontrado('Produto <id> nao encontrado')`, `EstoqueInsuficiente` |
| `pedidos.resumo(id)` | pedido com cliente; itens; desconto pela política `RESUMO` | `NaoEncontrado('Pedido nao encontrado')` |
| `pedidos.cancelar(id)` | pedido; `podeCancelar(status)`; `cancelar` (transação) | `NaoEncontrado`, `TransicaoInvalida` |
| `relatorio.vendas()` | pedidos ativos; itens de cada um; agregação por tipo com a política `RELATORIO` e `precos.arred2` | - |

- **A ordem das checagens do `POST /pedidos` é contrato:** o cliente é lido antes dos produtos, e os
  produtos só são lidos se o cliente existe. Os itens são conferidos na ordem do corpo, e o primeiro
  problema vence (produto inexistente ou estoque). O service não muta o corpo, ao contrário do
  handler atual, que gravava `preco_unitario` em `req.body.itens`: monta uma lista nova.
- **A ordem das chaves é contrato** (os testes comparam o corpo inteiro): `GET /pedidos/:id` devolve as
  colunas do pedido e `itens` por último; o relatório devolve os tipos na ordem em que aparecem e
  `geral` por último, como objeto simples (não `Map`); `{ geral: { pedidos: 0, itens: 0, faturamento: 0 } }`
  sem pedidos.
- **O faturamento do relatório** soma por tipo, arredonda cada tipo com `arred2`, soma os tipos já
  arredondados no geral e arredonda o geral: a mesma sequência de hoje, que muda centavos se for
  alterada.
- **O resumo:** o service devolve os dados estruturados (pedido, cliente, tipo, itens com quantidade,
  nome e preço, subtotal, desconto, frete, total, status). O texto `"2x Mouse sem fio - R$ 100.00"`
  (`(quantidade * preco_unitario).toFixed(2)`) é apresentação e fica num *presenter* do controller,
  como o `AGENTS.md` já classifica.
- **`podeCancelar(status)`** em `src/domain/pedido.ts` é `status === 'criado'`, com o tipo
  `StatusPedido = 'criado' | 'cancelado'`. O handler atual compara com `!=`; o status vem do banco
  como texto, e o resultado é o mesmo.
- **O log `pedido <id> (<tipo>) em <n>ms`** passa para o `pedidos.criar`, que conhece o tipo do cliente
  e mede o caso de uso. A exploração tinha previsto o controller, mas o tipo não faz parte da resposta.
  O log é operacional, não regra; o formato não muda.

### 5. Controllers

O controller faz três coisas: lê a entrada validada (ou `req.params.id`, já conferido), chama um
método do service e responde com o status de sucesso (`res.json`, ou `res.status(201).json` nas
criações). Não tem `try`, não decide status de erro e não calcula nada. A exceção é o *presenter* do
resumo.

### 6. Log de requisição

`src/http/middlewares/log.ts` exporta o middleware que escreve `<ISO> <METODO> <URL>` com
`console.log`, registrado logo depois do `express.json()`, na mesma posição de hoje.

### 7. Teste do JSON malformado, antes de tudo

Um teste de caracterização novo, num arquivo de teste existente que caiba (por exemplo,
`pedidos.test.ts`, com `POST /pedidos` e corpo `{"cliente_id":`), registra o status 400 e que a resposta
**não** é JSON (`content-type` `text/html`). Ele é escrito e passa **antes** de qualquer outra mudança.
O invariante 2 do roteiro proíbe mudar testes existentes, não acrescentar testes de caracterização,
como a etapa 4 fez com as falhas do banco.

### 8. O que sai e o que fica

- Saem `src/routes/legado.js`, `src/routes/pedidos.js`, `src/routes/clientes.js` (`git rm`) e
  `src/utils.js`.
- O aviso do `DELETE /pedidos/:id` vira um comentário curto no router de pedidos ("desativado de
  propósito: pedidos são cancelados, nunca excluídos; não reative"), sem o código SQL comentado. A
  etapa 8 previa decidir sobre esse bloco; o aviso continua no código e no `AGENTS.md`.
- O `// TODO: mover o resto pra routes/ depois` some com o `legado.js`.

## Risks / Trade-offs

- **[Rota sem `falhas(...)` volta a responder 500 em HTML]** → toda rota termina com `falhas(...)`; os
  testes de `falhas-do-banco` cobrem a mensagem de cada rota. A convenção entra no `AGENTS.md`.
- **[Mudar a ordem das checagens ou das chaves]** → a Decisão 4 lista a ordem, e os testes comparam o
  corpo inteiro e a ordem das mensagens.
- **[`transform` do CEP diferente do `validaCep`]** → a regex e o `trim` são copiados exatamente; os
  testes comparam o CEP gravado e o corpo do `/frete`, inclusive com espaços e hífen.
- **[Bug de programação muda de HTML para JSON 500]** → é a única diferença observável, num caminho que
  não tem teste nem é contrato. Fica registrada no roteiro.
- **[Tratador por rota não pegar a rejeição]** → é o comportamento documentado do Express 5 (o `router`
  repassa a rejeição ao próximo tratador de 4 argumentos da pilha). A task do primeiro router
  convertido (clientes) confirma com os testes de falha do banco antes de converter os outros.
- **[Change grande numa revisão só]** → as tasks convertem um recurso por vez, cada uma deixando
  `npm test` verde, e os routers antigos e novos convivem até o fim.
- **[Services de uma linha]** → é o custo da regra "controller só chama service", aceito na exploração.

## Migration Plan

Não há migração de dados nem de contrato. Os routers novos substituem os antigos recurso a recurso
dentro da change. Para reverter, basta um `git revert` da change.
