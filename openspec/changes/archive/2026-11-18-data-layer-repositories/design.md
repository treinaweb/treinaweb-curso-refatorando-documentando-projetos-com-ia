# Design

## Context

Etapa 4 de `docs/refatoracao.md` (veja proposal.md - Why). O contrato novo está em
`specs/gravacao-pedidos` e `specs/falhas-do-banco`. Estado atual:

- `src/db/index.js` (`abrirBanco`) devolve uma conexão do `sqlite3` 5, em `serialize()`.
- `src/app.ts` injeta o `db` e os validadores nas factories JS (`createLegadoRouter`,
  `createClientesRouter`, `createPedidosRouter`).
- 22 chamadas ao banco nos handlers, por callback. 6 têm SQL concatenado, que hoje só recebe inteiros
  validados.
- Caminhos de erro que derrubam o processo: no relatório (`itens.length` com `itens` indefinido) e no
  cancelamento (leitura dos itens). As devoluções de estoque do cancelamento ignoram o erro e
  respondem 200.
- `test/helpers.ts` cria o banco com `abrirBanco` e o app com `createApp`; `test/setup.ts` fecha a
  conexão por callback.

Spikes (Node 24.18, glibc 2.35), feitos em diretórios descartáveis:
- `better-sqlite3` 13.2.0: carrega por binário pronto, `npm audit` 0, sem tipos próprios
  (`@types/better-sqlite3` 9.6.0);
- `db.transaction(fn)` com `RAISE(ABORT)` num trigger faz rollback completo;
- `lastInsertRowid` é `number`; `REAL` e `LIKE` se comportam como no `sqlite3`;
- a função da transação precisa ser síncrona;
- o binário do `sqlite3` 6.0.1 exige GLIBC 2.38.

## Goals / Non-Goals

**Goals:**
- Todo o SQL em `src/repositories/` e `src/db/`, parametrizado.
- Criação e cancelamento atômicos.
- Nenhum callback de banco nem contador de callback nos handlers.
- As 17 respostas 500 cobertas por teste, com as 15 que não mudam caracterizadas antes da reescrita.

**Non-Goals:**
- Services, controllers e middleware de erro centralizado (etapa 6). Os `try/catch` por rota são
  provisórios.
- Tirar as regras de preço e os cálculos dos handlers (etapa 5).
- Índices e mudança de schema.

## Decisions

### 1. `better-sqlite3`, com repositories `Promise` por cima

Os repositories expõem métodos `async`. Por dentro, usam a API síncrona do `better-sqlite3`, e uma
exceção do driver vira uma promise rejeitada. A interface `Promise` foi decidida no roteiro para
permitir trocar de driver; o custo de ela ser "artificial" com um driver síncrono já tinha sido
aceito.

### 2. Repositories e o que cada um expõe

`criarRepositorios(db)` em `src/repositories/index.ts` devolve `{ produtos, clientes, pedidos }`. As
consultas reproduzem as colunas e a ordem atuais, para o JSON sair idêntico:

| Repository | Métodos |
|---|---|
| `produtos` | `listar(busca?)` (`LIKE ?` com `'%' + busca + '%'`, sem `ORDER BY`, como hoje), `buscar(id)`, `buscarVarios(ids)` (`IN (?, ?, ...)`) |
| `clientes` | `listar()` (`ORDER BY id`), `buscar(id)` (colunas públicas), `buscarCompleto(id)` (`SELECT *`, usado na criação do pedido), `criar({ nome, email, cep })` → id |
| `pedidos` | `buscar(id)`, `itensDoPedido(id)` (`produto_id, nome, quantidade, preco_unitario`), `buscarParaResumo(id)` e `itensParaResumo(id)` (as consultas atuais do resumo), `listarAtivosComTipo()` e `itensDe(id)` (relatório), `criar(dados)` e `cancelar(id)`, que são transacionais |

- `pedidos.criar({ cliente_id, subtotal, desconto, frete, total, criado_em, itens })` faz, numa
  `db.transaction`: `INSERT` do pedido, `INSERT` de cada item e `UPDATE produtos SET estoque =
  estoque - ?`. Devolve o id.
- `pedidos.cancelar(id)` faz, numa transação: `UPDATE` do status, leitura dos itens e
  `UPDATE ... estoque + ?` por item.

A conferência de status e de estoque continua no handler, antes da chamada, como hoje. Por isso o
`[atual]` do estoque negativo com produto repetido não muda.

`utils.buscar_cliente` sai; quem chamava passa a usar `clientes.buscarCompleto`.

### 3. Injeção nas factories

`createApp({ db })` chama `criarRepositorios(db)` e passa `r` às factories:
`createLegadoRouter(r, v)`, `createClientesRouter(r, v)`, `createPedidosRouter(r, v)`. As factories
deixam de receber o `db`. O mesmo motivo das etapas 1 e 3 vale aqui: o JS legado não importa `.ts`
sob o Vitest.

### 4. Handlers `async` com a mensagem 500 de cada rota

```js
router.get('/produtos/:id', v.idProduto, async function (req, res) {
    var row
    try {
        row = await r.produtos.buscar(req.params.id)
    } catch (err) {
        console.log(err)
        return res.status(500).json({erro: 'Erro ao buscar produto'})
    }
    ...
})
```

Cada bloco `try` cobre o mesmo trecho que o callback de erro cobre hoje. Assim, cada mensagem fica
ligada à mesma operação:
- em `GET /pedidos/:id`, `Erro ao buscar pedido` / `Erro ao buscar itens`;
- em `POST /pedidos`, `Erro interno` para as leituras e `Erro ao salvar pedido` para o `criar`.

Nenhum `await` fica fora de um `try`. Com o Express 5, uma rejeição escapada viraria a página HTML de
500, e é isso que o spec `falhas-do-banco` proíbe. O log `pedido N (tipo) em Xms` continua.

### 5. `src/db/index.ts`

`git mv src/db/index.js src/db/index.ts`, reescrito sobre o `better-sqlite3`, com o mesmo schema e o
mesmo seed, só em arquivo novo (`existsSync` antes de abrir). O seed roda numa transação: fica mais
rápido, e o resultado é o mesmo. Exporta `abrirBanco(arquivo): Database`.

### 6. Testes de falha do banco

O helper `appComBanco(preparar: string)` em `test/helpers.ts`:
1. cria outro arquivo temporário;
2. abre com `abrirBanco` (schema + seed);
3. executa o SQL de `preparar` (`DROP TABLE ...`, `CREATE TRIGGER ... RAISE(ABORT, ...)`,
   `INSERT ...`);
4. devolve `() => supertest(createApp({ db }))`.

Ele é `async` com qualquer driver, para que os `*.test.ts` não mudem com a troca, e registra o banco
para o `setup.ts` fechar e apagar no `afterAll`.

| Fase | Driver | Testes |
|---|---|---|
| Caracterização (antes) | `sqlite3` 5 | As 15 mensagens que não mudam. Cada uma substitui o `it.todo` da área, no próprio arquivo. |
| Depois da troca | `better-sqlite3` | Os novos testes de `gravacao-pedidos` (trigger em `itens_pedido` e em `produtos`, conferindo pelo HTTP que nada foi gravado), as falhas que derrubavam o processo (itens do relatório e do cancelamento) e o "processo continua atendendo" |

A falha parcial de hoje (`Pedido criado com erros`) não é caracterizada. O teste seria alterado nesta
mesma etapa, e isso violaria o invariante do roteiro. As falhas que derrubam o processo também não
são caracterizadas, porque derrubariam o worker do Vitest.

### 7. Ordem: troca em bloco, não handler a handler

A troca do driver, dos repositories e dos handlers acontece num único grupo de tasks, com os testes
passando no fim do grupo, como o grupo 3 da etapa 1. A rede de segurança são os 111 testes mais as
15 caracterizações.

*Alternativa:* migrar os handlers um a um sobre um adaptador provisório do `sqlite3` e trocar o driver
só no fim. Foi descartada: a transação do `better-sqlite3` exige uma função síncrona, que o adaptador
assíncrono não consegue imitar, então o adaptador e as transações seriam escritos duas vezes.

## Risks / Trade-offs

- **[Um `await` escapar de um `try`]** → 500 em HTML. Mitigação: os testes de falha cobrem cada
  mensagem por rota, e na revisão um `grep` confere que todo `await r.` está dentro de um `try`.
- **[Ordem das linhas ou formato de número diferente]** → os testes comparam o JSON inteiro e a ordem
  das listagens. As consultas mantêm o `ORDER BY` (ou a falta dele) de hoje.
- **[O relatório muda a ordem das chaves por tipo]** → hoje os callbacks completam na ordem dos
  pedidos, e com `await` em sequência a ordem é a mesma. `toEqual` não compara a ordem das chaves.
- **[`@types/better-sqlite3` 9.x com o pacote 13]** → a API usada (`prepare`, `get`, `all`, `run`,
  `exec`, `transaction`, `close`) é estável. Se o typecheck acusar diferença, ela é tratada na
  implementação.
- **[Driver síncrono bloqueia o event loop]** → aceito para uma API interna com SQLite local.
- **[Seed numa transação mudar os ids]** → não muda: a ordem dos `INSERT` é a mesma.
- **[Bancos já gravados com o `sqlite3` 5]** → o formato do arquivo SQLite é o mesmo. O `loja.db`
  existente abre sem migração.

## Migration Plan

`npm install` (sai o `sqlite3`, entra o `better-sqlite3`) e `npm start`. O `loja.db` existente
continua válido. Rollback: reverter a change e rodar `npm install`.
