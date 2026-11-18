# falhas-do-banco Specification

## Purpose

Define como cada rota responde a uma falha do banco de dados: status 500 com corpo JSON no formato de
erro da rota e com a mensagem própria da rota, sem página HTML e sem derrubar o processo.

## Requirements

### Requirement: Falha do banco responde 500 em JSON
Quando uma consulta ou gravação falha no banco, a rota SHALL responder status 500 com um corpo JSON
no formato de erro da rota (`{ erro }` nas rotas legadas, `{ error }` em `/clientes`) e com a mensagem
definida para a rota. A resposta SHALL NOT ser a página de erro HTML do Express, e a falha SHALL NOT
encerrar o processo da API.

#### Scenario: Processo continua atendendo depois de uma falha
- **WHEN** uma rota responde 500 por falha do banco
- **THEN** uma requisição seguinte a outra rota que não depende da parte com falha é atendida normalmente

### Requirement: Mensagens de falha do banco por rota
Cada rota SHALL usar a mensagem de falha do banco abaixo, qualquer que seja a consulta ou gravação
que falhou:

| Rota | Mensagem |
|---|---|
| `GET /produtos` | `Erro ao buscar produtos` |
| `GET /produtos/:id` | `Erro ao buscar produto` |
| `GET /clientes` | `Erro ao listar clientes` |
| `GET /clientes/:id` | `Erro ao buscar cliente` |
| `POST /clientes` | `Erro ao salvar cliente` |
| `GET /pedidos/:id` | `Erro ao buscar pedido` (pedido) ou `Erro ao buscar itens` (itens) |
| `POST /pedidos` | `Erro interno` (leitura do cliente ou dos produtos) ou `Erro ao salvar pedido` (gravação) |
| `GET /pedidos/:id/resumo` | `Erro ao gerar resumo` |
| `GET /relatorios/vendas` | `Erro ao gerar relatorio` |
| `POST /pedidos/:id/cancelar` | `Erro ao cancelar pedido` |

#### Scenario: Falha ao listar produtos
- **WHEN** a leitura de produtos falha no banco e o cliente chama `GET /produtos`
- **THEN** a API responde 500 com `{ "erro": "Erro ao buscar produtos" }`

#### Scenario: Falha em clientes usa o formato de clientes
- **WHEN** a leitura de clientes falha no banco e o cliente chama `GET /clientes`
- **THEN** a API responde 500 com `{ "error": "Erro ao listar clientes" }`

#### Scenario: Falha ao ler os itens de um pedido
- **WHEN** o pedido existe, a leitura dos seus itens falha no banco e o cliente chama `GET /pedidos/<id>`
- **THEN** a API responde 500 com `{ "erro": "Erro ao buscar itens" }`

#### Scenario: Falha ao ler o cliente na criação do pedido
- **WHEN** a leitura de clientes falha no banco e o cliente envia um `POST /pedidos` válido
- **THEN** a API responde 500 com `{ "erro": "Erro interno" }`

#### Scenario: Falha nos itens do relatório
- **WHEN** há pedidos não cancelados, a leitura dos itens falha no banco e o cliente chama `GET /relatorios/vendas`
- **THEN** a API responde 500 com `{ "erro": "Erro ao gerar relatorio" }` e o processo continua atendendo
