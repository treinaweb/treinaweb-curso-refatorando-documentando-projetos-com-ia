# validacao-entrada Specification

## Purpose

Define o contrato de entrada da Loja API: o que cada rota aceita no corpo, na query e no path, em que
ordem os problemas são avaliados e qual status e mensagem cada rejeição devolve.

## Requirements

### Requirement: Rejeição pelo primeiro problema, com mensagem do projeto
Quando uma entrada tem mais de um problema, a API SHALL responder só pelo primeiro, na ordem definida
para a rota. A mensagem SHALL ser uma das mensagens do projeto, no formato de erro da rota
(`{ erro }` nas rotas legadas, `{ error }` em `/clientes`), e nunca uma mensagem gerada pela
biblioteca de validação.

#### Scenario: Dois campos inválidos no pedido
- **WHEN** o cliente envia `POST /pedidos` com `{ "cliente_id": "abc", "itens": [] }`
- **THEN** a API responde 400 com `{ "erro": "cliente_id invalido" }`

#### Scenario: Formato de erro de clientes
- **WHEN** o cliente envia `POST /clientes` sem corpo
- **THEN** a API responde 400 com `{ "error": "Nome e email sao obrigatorios" }`

### Requirement: Campos extras no corpo são ignorados
A API SHALL ignorar campos do corpo que a rota não usa, sem rejeitar a requisição.

#### Scenario: Tipo informado no cadastro de cliente
- **WHEN** o cliente envia `POST /clientes` com `{ "nome": "A", "email": "a@x", "cep": "01310100", "tipo": "vip" }`
- **THEN** a API responde 201 e o cliente é criado com `tipo` `comum`

### Requirement: cliente_id do pedido
Em `POST /pedidos`, `cliente_id` ausente ou `null` SHALL gerar 400 `cliente_id obrigatorio`. Qualquer
outro valor que não seja um número inteiro positivo SHALL gerar 400 `cliente_id invalido`.
`cliente_id` SHALL ser avaliado antes dos itens.

#### Scenario: Pedido sem corpo
- **WHEN** o cliente envia `POST /pedidos` sem corpo
- **THEN** a API responde 400 com `{ "erro": "cliente_id obrigatorio" }`

#### Scenario: cliente_id nulo
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id: null` e itens válidos
- **THEN** a API responde 400 com `{ "erro": "cliente_id obrigatorio" }`

#### Scenario: cliente_id que não é inteiro positivo
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id` igual a `0`, `""`, `false`, `1.5`, `-3`, `"1"` ou `"abc"`, com itens válidos
- **THEN** a API responde 400 com `{ "erro": "cliente_id invalido" }`

#### Scenario: Cliente válido e inexistente
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id: 999` e itens válidos
- **THEN** a API responde 404 com `{ "erro": "Cliente nao encontrado" }`

### Requirement: Lista de itens do pedido
Em `POST /pedidos`, `itens` ausente, que não seja lista ou que seja uma lista vazia SHALL gerar 400
`Pedido sem itens`.

#### Scenario: Itens que não são lista
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id: 1` e `itens: "x"`
- **THEN** a API responde 400 com `{ "erro": "Pedido sem itens" }`

### Requirement: Cada item do pedido
Os itens SHALL ser avaliados em ordem, com `produto_id` antes de `quantidade`; N é a posição do item,
começando em 1. Item que não é objeto, ou com `produto_id` ausente ou `null`, SHALL gerar 400
`produto_id obrigatorio no item N`. `produto_id` que não seja inteiro positivo SHALL gerar 400
`produto_id invalido no item N`. `quantidade` que não seja inteiro positivo SHALL gerar 400
`Quantidade invalida no item N`.

#### Scenario: Item nulo
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id: 1` e `itens: [null]`
- **THEN** a API responde 400 com `{ "erro": "produto_id obrigatorio no item 1" }`

#### Scenario: produto_id em texto
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id: 1` e `itens: [{ "produto_id": 1, "quantidade": 1 }, { "produto_id": "abc", "quantidade": 1 }]`
- **THEN** a API responde 400 com `{ "erro": "produto_id invalido no item 2" }`

#### Scenario: produto_id zero
- **WHEN** o cliente envia `POST /pedidos` com `cliente_id: 1` e `itens: [{ "produto_id": 0, "quantidade": 1 }]`
- **THEN** a API responde 400 com `{ "erro": "produto_id invalido no item 1" }`

#### Scenario: Quantidade ausente ou não inteira
- **WHEN** o cliente envia `POST /pedidos` com um item de `produto_id: 1` e `quantidade` ausente, `null`, `0`, `-1`, `1.5` ou `"2"`
- **THEN** a API responde 400 com `{ "erro": "Quantidade invalida no item 1" }`

### Requirement: Nome e email do cliente
Em `POST /clientes`, `nome` SHALL ser avaliado antes de `email`, e ambos antes do CEP. `nome` ou
`email` ausente, `null` ou `""` SHALL gerar 400 `Nome e email sao obrigatorios`. `nome` que não seja
texto SHALL gerar 400 `Nome invalido`, e `email` que não seja texto SHALL gerar 400 `Email invalido`.
Texto só com espaços SHALL ser aceito, e o formato do e-mail SHALL NOT ser validado.

#### Scenario: Nome numérico
- **WHEN** o cliente envia `POST /clientes` com `{ "nome": 123, "email": "a@x", "cep": "01310100" }`
- **THEN** a API responde 400 com `{ "error": "Nome invalido" }` e nenhum cliente é gravado

#### Scenario: Email booleano
- **WHEN** o cliente envia `POST /clientes` com `{ "nome": "A", "email": true, "cep": "01310100" }`
- **THEN** a API responde 400 com `{ "error": "Email invalido" }`

#### Scenario: Nome ausente e email inválido
- **WHEN** o cliente envia `POST /clientes` com `{ "email": true, "cep": "01310100" }`
- **THEN** a API responde 400 com `{ "error": "Nome e email sao obrigatorios" }`

#### Scenario: Nome vazio
- **WHEN** o cliente envia `POST /clientes` com `{ "nome": "", "email": "a@x", "cep": "01310100" }`
- **THEN** a API responde 400 com `{ "error": "Nome e email sao obrigatorios" }`

### Requirement: Formato do CEP
Um CEP SHALL ser aceito só quando for texto que, depois de remover espaços nas pontas, tenha 5 dígitos,
um hífen opcional e 3 dígitos. Ele SHALL ser usado e devolvido sem hífen. Qualquer outro valor,
inclusive número ou ausência, SHALL gerar 400 `CEP invalido`. A regra vale para o `cep` de
`POST /clientes` e de `GET /frete`.

#### Scenario: CEP com hífen e espaços
- **WHEN** o cliente envia `POST /clientes` com `cep: " 20040-020 "` e nome e email válidos
- **THEN** a API responde 201 com `cep` `"20040020"`

#### Scenario: CEP numérico
- **WHEN** o cliente envia `POST /clientes` com `cep: 20040020` e nome e email válidos
- **THEN** a API responde 400 com `{ "error": "CEP invalido" }`

#### Scenario: Hífen fora do lugar
- **WHEN** o cliente envia `POST /clientes` com `cep` igual a `"0131-0100"` ou `"1.310100"`
- **THEN** a API responde 400 com `{ "error": "CEP invalido" }`

#### Scenario: CEP inválido na simulação de frete
- **WHEN** o cliente chama `GET /frete?cep=0131-0100`
- **THEN** a API responde 400 com `{ "erro": "CEP invalido" }`

### Requirement: Subtotal da simulação de frete
Em `GET /frete`, `subtotal` ausente ou vazio SHALL valer 0. Um valor só com dígitos, com parte decimal
opcional após ponto, SHALL ser aceito. Qualquer outro valor, inclusive negativo, SHALL gerar 400
`Subtotal invalido`. O CEP SHALL ser avaliado antes do subtotal.

#### Scenario: Subtotal ausente
- **WHEN** o cliente chama `GET /frete?cep=01310100`
- **THEN** a API responde 200 com `{ "cep": "01310100", "subtotal": 0, "frete": 15 }`

#### Scenario: Subtotal inválido
- **WHEN** o cliente chama `GET /frete?cep=01310100` com `subtotal` igual a `abc`, `350reais`, `-10`, `1e3`, `.5` ou `100,50`
- **THEN** a API responde 400 com `{ "erro": "Subtotal invalido" }`

#### Scenario: CEP e subtotal inválidos
- **WHEN** o cliente chama `GET /frete?cep=123&subtotal=abc`
- **THEN** a API responde 400 com `{ "erro": "CEP invalido" }`

### Requirement: Parâmetro de busca de produtos
Em `GET /produtos`, `busca` SHALL ser aceito ausente ou como um único texto. `busca` repetida ou em
forma de objeto SHALL gerar 400 `Busca invalida`.

#### Scenario: Busca repetida
- **WHEN** o cliente chama `GET /produtos?busca=a&busca=b`
- **THEN** a API responde 400 com `{ "erro": "Busca invalida" }`

#### Scenario: Busca como objeto
- **WHEN** o cliente chama `GET /produtos?busca[x]=cabo`
- **THEN** a API responde 400 com `{ "erro": "Busca invalida" }`

### Requirement: Ids no path
Nas rotas `GET /produtos/:id`, `GET /clientes/:id`, `GET /pedidos/:id`, `GET /pedidos/:id/resumo` e
`POST /pedidos/:id/cancelar`, um `id` que não seja só dígitos SHALL gerar o mesmo 404 de um id
inexistente naquela rota, sem consultar o banco.

#### Scenario: Id decimal de produto
- **WHEN** o cliente chama `GET /produtos/1.0`, `GET /produtos/1e0` ou `GET /produtos/%201`
- **THEN** a API responde 404 com `{ "erro": "Produto nao encontrado" }`

#### Scenario: Id decimal de cliente
- **WHEN** o cliente chama `GET /clientes/1.0`
- **THEN** a API responde 404 com `{ "error": "Cliente nao encontrado" }`

#### Scenario: Resumo com id em texto
- **WHEN** o cliente chama `GET /pedidos/abc/resumo`
- **THEN** a API responde 404 com `{ "erro": "Pedido nao encontrado" }`

#### Scenario: Cancelamento com id em texto
- **WHEN** o cliente chama `POST /pedidos/abc/cancelar`
- **THEN** a API responde 404 com `{ "erro": "Pedido nao encontrado" }`

#### Scenario: Zeros à esquerda
- **WHEN** o cliente chama `GET /produtos/01`
- **THEN** a API responde 200 com o produto de id 1
