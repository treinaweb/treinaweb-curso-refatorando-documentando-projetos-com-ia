# Loja API

API de pedidos da loja. Node + Express + SQLite.

Uso interno. Não expor fora da rede da loja.

## Como rodar

```
npm install
node app.js
```

A API sobe em http://localhost:3000. O banco (`loja.db`) é criado na primeira execução, já com alguns produtos e clientes de exemplo. Para zerar os dados é só apagar o `loja.db`.

## Rotas

```
GET    /produtos           lista os produtos
GET    /produtos/:id       detalhe de um produto

GET    /clientes           lista os clientes
GET    /clientes/:id       detalhe de um cliente
POST   /clientes           cadastra cliente { nome, email, cep }

GET    /pedidos            lista os pedidos (mais recentes primeiro)
GET    /pedidos/:id        detalhe do pedido com os itens
POST   /pedidos            cria pedido { cliente_id, itens: [{ produto_id, quantidade }] }
DELETE /pedidos/:id        exclui o pedido
```

## Regras

- O estoque é baixado quando o pedido é criado.
- Pedidos a partir de R$ 500,00 têm 5% de desconto.

## Exemplo

```
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"cliente_id": 1, "itens": [{"produto_id": 2, "quantidade": 1}]}'
```
