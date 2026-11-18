# Spec Delta

## Purpose

Garante que a criação e o cancelamento de pedido sejam atômicos: uma falha durante a gravação não
deixa pedido, itens, status ou estoque alterados pela metade.

## ADDED Requirements

### Requirement: Criação de pedido atômica
A criação de um pedido (registro do pedido, seus itens e a baixa de estoque de cada produto) SHALL
acontecer por inteiro ou não acontecer. Se qualquer parte da gravação falhar, a API SHALL responder
500 `{ "erro": "Erro ao salvar pedido" }`, e nenhum pedido, item ou baixa de estoque dessa requisição
SHALL permanecer gravado.

#### Scenario: Falha ao gravar um item
- **WHEN** o cliente envia um `POST /pedidos` válido e a gravação de um dos itens falha no banco
- **THEN** a API responde 500 com `{ "erro": "Erro ao salvar pedido" }`
- **AND** o pedido não existe (`GET /pedidos/<id esperado>` responde 404) e o estoque dos produtos do pedido não muda

#### Scenario: Falha ao baixar o estoque
- **WHEN** o cliente envia um `POST /pedidos` válido com dois itens e a baixa de estoque falha no banco
- **THEN** a API responde 500 com `{ "erro": "Erro ao salvar pedido" }`
- **AND** nenhum pedido é gravado e o estoque dos dois produtos não muda

#### Scenario: Pedido gravado com sucesso
- **WHEN** o cliente envia um `POST /pedidos` válido e o banco não falha
- **THEN** a API responde 201, o pedido e os itens ficam gravados e o estoque de cada produto cai pela quantidade do item

### Requirement: Cancelamento de pedido atômico
O cancelamento de um pedido `criado` (mudança do status para `cancelado` e devolução do estoque de
cada item) SHALL acontecer por inteiro ou não acontecer. Se qualquer parte falhar, a API SHALL
responder 500 `{ "erro": "Erro ao cancelar pedido" }`. O pedido SHALL continuar `criado`, e o estoque
SHALL ficar como estava antes da requisição.

#### Scenario: Falha ao devolver o estoque
- **WHEN** o cliente chama `POST /pedidos/<id>/cancelar` para um pedido `criado` e a devolução de estoque falha no banco
- **THEN** a API responde 500 com `{ "erro": "Erro ao cancelar pedido" }`
- **AND** `GET /pedidos/<id>` mostra o status `criado` e o estoque dos produtos não muda

#### Scenario: Falha ao ler os itens do pedido
- **WHEN** o cliente chama `POST /pedidos/<id>/cancelar` para um pedido `criado` e a leitura dos itens falha no banco
- **THEN** a API responde 500 com `{ "erro": "Erro ao cancelar pedido" }` e o pedido continua `criado`
