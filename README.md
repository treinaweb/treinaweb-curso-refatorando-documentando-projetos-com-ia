# Loja API

API REST de pedidos da loja de informática e periféricos. Node 22 + Express 4 + SQLite.

Uso interno, **sem autenticação**. Não expor fora da rede da loja.

## Como rodar

Requer Node 22 (veja `.nvmrc`).

```
npm install
npm start
```

O `npm start` compila o código (`npm run build`, TypeScript para `dist/`) e sobe a API com
`node dist/server.js`, em http://localhost:3000. Por compilar antes, ele precisa das dependências de
desenvolvimento instaladas (o `npm install` padrão já instala). Para compilar uma vez e subir sem
recompilar: `npm run build` e depois `node dist/server.js`.

| Variável  | Padrão      | Uso                        |
|-----------|-------------|----------------------------|
| `PORTA`   | `3000`      | Porta HTTP                 |
| `DB_PATH` | `./loja.db` | Arquivo do banco SQLite    |

Se o arquivo do banco não existe, ele é criado na inicialização com o schema e alguns
produtos e clientes de exemplo. Apagar o arquivo zera todos os dados.

Para testar sem mexer no banco local, use um banco descartável:

```
DB_PATH=/tmp/loja-teste.db PORTA=3999 npm start
```

## Testes

Requer Node 22.12 ou mais recente.

```
npm test               # testes (Vitest + supertest), cada arquivo com banco temporário próprio
npm run typecheck      # checagem de tipos do código e dos testes (tsc --noEmit)
npm run test:coverage  # testes com relatório de cobertura
```

Os testes ficam em `test/` e registram o comportamento atual da API, inclusive as divergências
descritas em [Regras](#regras). O banco local (`loja.db`) não é usado.

## Rotas

```
GET  /produtos                 lista os produtos (filtro opcional ?busca=)
GET  /produtos/:id             detalhe de um produto

GET  /clientes                 lista os clientes
GET  /clientes/:id             detalhe de um cliente
POST /clientes                 cadastra cliente

POST /pedidos                  cria pedido
GET  /pedidos/:id              detalhe do pedido com os itens
GET  /pedidos/:id/resumo       resumo legível do pedido
POST /pedidos/:id/cancelar     cancela o pedido e devolve o estoque

GET  /frete                    simula o frete para um CEP e subtotal
GET  /relatorios/vendas        faturamento por tipo de cliente
```

Não existem `GET /pedidos` (listagem) nem `DELETE /pedidos/:id`: pedidos são cancelados, nunca excluídos.

O contrato completo, em OpenAPI 3.0.3, está em [`docs/openapi.yaml`](docs/openapi.yaml). Ele pode ser aberto
em ferramentas locais, como extensões de OpenAPI do VS Code, para navegar e testar as rotas.

Os exemplos abaixo foram gerados contra um banco recém-criado (dados de exemplo).

### Produtos

**`GET /produtos`**: lista todos os produtos. O parâmetro `busca` filtra pelo nome
(contém o texto; maiúsculas e minúsculas são iguais).

```
curl "http://localhost:3000/produtos?busca=cabo"
```
```json
[{"id":3,"nome":"Cabo USB-C 1m","preco":29.9,"estoque":100},
 {"id":4,"nome":"Cabo HDMI 2m","preco":34.7,"estoque":60},
 {"id":14,"nome":"Cabo de rede 5m","preco":24.9,"estoque":80}]
```

**`GET /produtos/:id`**: `200` com `{ id, nome, preco, estoque }` ou `404 {"erro":"Produto nao encontrado"}`.

### Clientes

**`GET /clientes`**: lista `[{ id, nome, email, cep, tipo }]` ordenada por id.

**`GET /clientes/:id`**: `200` com o cliente ou `404 {"error":"Cliente nao encontrado"}`.

**`POST /clientes`**: body `{ nome, email, cep }`. O CEP tem 8 dígitos, com hífen opcional,
e é gravado sem hífen. O cliente cadastrado é sempre do tipo `comum`, e não há endpoint para mudar o tipo.

```
curl -X POST http://localhost:3000/clientes \
  -H "Content-Type: application/json" \
  -d '{"nome": "Ana Souza", "email": "ana@example.com", "cep": "04538-133"}'
```
```json
{"id":11,"nome":"Ana Souza","email":"ana@example.com","cep":"04538133","tipo":"comum"}
```

Erros: `400 {"error":"Nome e email sao obrigatorios"}`, `400 {"error":"CEP invalido"}`.

### Pedidos

**`POST /pedidos`**: body `{ cliente_id, itens: [{ produto_id, quantidade }] }`, com `quantidade`
inteira e maior que zero. Calcula subtotal, desconto, frete e total (veja [Regras](#regras)), grava o
pedido com status `criado` e baixa o estoque.

```
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"cliente_id": 1, "itens": [{"produto_id": 2, "quantidade": 1}]}'
```
```json
{"id":1,"cliente_id":1,"subtotal":250,"desconto":0,"frete":15,"total":265,"status":"criado"}
```

| Status | Erro (`{"erro": ...}`)                                                                 |
|--------|-----------------------------------------------------------------------------------------|
| 400    | `cliente_id obrigatorio`, `Pedido sem itens`, `produto_id obrigatorio no item N`, `Quantidade invalida no item N`, `Estoque insuficiente para <produto>` |
| 404    | `Cliente nao encontrado`, `Produto <id> nao encontrado`                                |
| 500    | `Erro interno`, `Erro ao salvar pedido`, `Pedido criado com erros`                     |

**`GET /pedidos/:id`**: o pedido como foi gravado, com os itens e o preço unitário da época da compra.

```json
{"id":1,"cliente_id":1,"subtotal":250,"desconto":0,"frete":15,"total":265,"status":"criado",
 "criado_em":"2026-11-17T20:17:34.710Z",
 "itens":[{"produto_id":2,"nome":"Teclado mecânico","quantidade":1,"preco_unitario":250}]}
```

**`GET /pedidos/:id/resumo`**: resumo legível, com uma linha por item.

```
curl http://localhost:3000/pedidos/2/resumo
```
```json
{"pedido":2,"cliente":"João Pereira","tipo_cliente":"vip",
 "itens":["1x Monitor 24 polegadas - R$ 899.00","2x Mouse sem fio - R$ 100.00"],
 "subtotal":999,"desconto":99.9,"frete":0,"total":899.1,"status":"criado"}
```

> **Divergência conhecida:** o resumo recalcula o desconto em vez de usar o valor gravado e,
> para cliente `comum`, só aplica os 5% com subtotal **acima** de R$ 500 (a criação aplica a
> partir de R$ 500). Num pedido `comum` de exatamente R$ 500,00, o resumo mostra um total
> diferente do cobrado. A fonte da verdade é `GET /pedidos/:id`.

**`POST /pedidos/:id/cancelar`**: muda o status de `criado` para `cancelado` e devolve o estoque dos itens.

```
curl -X POST http://localhost:3000/pedidos/1/cancelar
```
```json
{"id":1,"status":"cancelado"}
```

Erros: `400 {"erro":"Pedido nao pode ser cancelado (status cancelado)"}`, `404 {"erro":"Pedido nao encontrado"}`.

### Frete

**`GET /frete?cep=&subtotal=`**: simula o frete com o CEP informado. Na criação do pedido vale
o CEP do cadastro do cliente. Se `subtotal` for omitido, vale 0.

```
curl "http://localhost:3000/frete?cep=30130-000&subtotal=120"
```
```json
{"cep":"30130000","subtotal":120,"frete":15}
```

Erro: `400 {"erro":"CEP invalido"}`.

### Relatórios

**`GET /relatorios/vendas`**: quantidade de pedidos, de itens e faturamento por tipo de cliente,
mais o total `geral`. Pedidos cancelados ficam de fora.

```json
{"comum":{"pedidos":1,"itens":1,"faturamento":265},
 "vip":{"pedidos":1,"itens":3,"faturamento":899},
 "geral":{"pedidos":2,"itens":4,"faturamento":1164}}
```

> **Divergência conhecida:** o relatório recalcula o desconto arredondando para reais inteiros,
> em vez de usar o valor gravado. Por isso o faturamento pode não bater com a soma dos totais
> cobrados: no exemplo, o pedido vip tem `total` 899.1, mas entra no relatório como 899.

## Erros

As respostas de erro são JSON com uma mensagem, mas a chave varia:

- `{"erro": "..."}` em produtos, pedidos, frete e relatórios;
- `{"error": "..."}` em clientes.

Rotas inexistentes retornam o 404 padrão do Express (HTML).

## Regras

Resumo das regras aplicadas na criação do pedido. O detalhamento, incluindo os pontos ainda
a confirmar com o negócio, está no [AGENTS.md](AGENTS.md#regras-de-negócio).

- **Total** = subtotal − desconto + frete. O preço do produto é copiado para o item na criação,
  então pedidos antigos não mudam se o preço mudar.
- **Desconto por tipo de cliente:** `comum` 5% com subtotal a partir de R$ 500; `vip` 10%;
  `atacado` 15% se a soma das quantidades for 10 ou mais; outros tipos não têm desconto.
- **Frete** (sobre o subtotal antes do desconto): grátis a partir de R$ 300. Abaixo disso, pelo
  1º dígito do CEP do cliente: 0–3 R$ 15, 4–7 R$ 30, 8–9 R$ 20.
- **Estoque:** baixado na criação e devolvido no cancelamento. Sem estoque suficiente, retorna 400.
- **Status:** `criado` → `cancelado` (só a partir de `criado`).
