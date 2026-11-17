/**
 * @file Conexao com o SQLite, criacao do schema e dados de exemplo.
 *
 * - Arquivo do banco: variavel de ambiente `DB_PATH` (padrao `./loja.db`).
 * - Se o arquivo NAO existe na inicializacao, cria as tabelas e insere os
 *   produtos e clientes de exemplo abaixo. Se ja existe, nada e criado nem
 *   migrado. Apagar o arquivo zera todos os dados.
 * - Tabelas:
 *   - `clientes` (id, nome, email, cep sem hifen, tipo: comum | vip | atacado)
 *   - `produtos` (id, nome, preco, estoque)
 *   - `pedidos` (id, cliente_id, subtotal, desconto, frete, total,
 *     status: criado | cancelado, criado_em em ISO 8601)
 *   - `itens_pedido` (id, pedido_id, produto_id, quantidade, preco_unitario
 *     copiado do produto na criacao do pedido)
 *
 * Exporta a conexao `sqlite3.Database` em modo `serialize()` (comandos
 * executados em ordem). Nao ha migracoes nem indices.
 *
 * @module db
 */

var sqlite3 = require('sqlite3')
var fs = require('fs')

var arquivo = process.env.DB_PATH || './loja.db'
var criar = !fs.existsSync(arquivo)

var db = new sqlite3.Database(arquivo)
db.serialize()

if (criar) {
  db.run("CREATE TABLE clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL, cep TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'comum')")
  db.run('CREATE TABLE produtos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, preco REAL NOT NULL, estoque INTEGER NOT NULL DEFAULT 0)')
  db.run('CREATE TABLE pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, subtotal REAL, desconto REAL, frete REAL, total REAL, status TEXT, criado_em TEXT)')
  db.run('CREATE TABLE itens_pedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL, produto_id INTEGER NOT NULL, quantidade INTEGER NOT NULL, preco_unitario REAL NOT NULL)')
  // TODO criar indices (pedido_id, cliente_id)

  var produtos = [
    ['Mouse sem fio', 50.00, 40],
    ['Teclado mecânico', 250.00, 15],
    ['Cabo USB-C 1m', 29.90, 100],
    ['Cabo HDMI 2m', 34.70, 60],
    ['Hub USB 4 portas', 61.70, 25],
    ['Monitor 24 polegadas', 899.00, 8],
    ['Headset gamer', 320.00, 10],
    ['Webcam HD', 100.00, 20],
    ['Suporte para notebook', 299.90, 3],
    ['Mousepad grande', 39.90, 50],
    ['Notebook 14 polegadas', 3299.00, 5],
    ['SSD 480GB', 219.90, 30],
    ['Memória RAM 8GB', 159.90, 25],
    ['Cabo de rede 5m', 24.90, 80],
    ['Adaptador HDMI para VGA', 45.00, 18],
    ['Caixa de som Bluetooth', 189.00, 12],
    ['Carregador USB-C 65W', 149.90, 22]
  ]
  produtos.forEach(function(p) {
    db.run('INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)', p)
  })

  var clientes = [
    ['Maria Silva', 'maria.silva@example.com', '01310100', 'comum'],
    ['João Pereira', 'joao.pereira@example.com', '20040020', 'vip'],
    ['Pedro Santos', 'pedro.santos@example.com', '30130000', 'comum'],
    ['Carla Oliveira', 'carla.oliveira@example.com', '40020000', 'comum'],
    ['Distribuidora Ramos Ltda', 'compras@ramos.example.com', '50030230', 'atacado'],
    ['Lucas Almeida', 'lucas.almeida@example.com', '60060100', 'comum'],
    ['Fernanda Costa', 'fernanda.costa@example.com', '70040010', 'vip'],
    ['Rafael Gomes', 'rafael.gomes@example.com', '80010000', 'comum'],
    ['Juliana Rocha', 'juliana.rocha@example.com', '90010000', 'comum'],
    ['Tiago Martins', 'tiago.martins@example.com', '13010000', 'comum']
  ]
  clientes.forEach(function(c) {
    db.run('INSERT INTO clientes (nome, email, cep, tipo) VALUES (?, ?, ?, ?)', c)
  })
}

module.exports = db
