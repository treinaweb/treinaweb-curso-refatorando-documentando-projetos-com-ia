# Proposal

## Why

Esta change implementa a **etapa 6 (Camada HTTP e services)** de `docs/refatoracao.md`.

Depois das etapas 4 e 5, o SQL está nos repositories e as regras de preço estão no domínio. Mesmo
assim, cada handler de `src/routes/*.js` ainda faz tudo ao mesmo tempo:
- lê a entrada crua e normaliza de novo o que o schema já conferiu (`validaCep`, `parseFloat`);
- orquestra os repositories, cada `await` dentro de um `try/catch` que repete `console.log` e a
  mensagem 500 da rota;
- aplica regras que não estão em lugar nenhum além do handler: a ordem das checagens de produto e
  estoque, a transição `criado -> cancelado`, a agregação do relatório;
- monta a resposta.

Além disso, o JS legado obriga a injetar validadores e domínio nas factories, porque não importa
`.ts` sob o Vitest. Com a camada HTTP em TypeScript, essa restrição some, e as rotas passam a ter
uma estrutura só: route, controller, service.

## What Changes

- **Uma change só**, sem dividir a etapa em catálogo e pedidos (decisão do usuário).
- **Services por caso de uso**, em `src/services/`, em TypeScript, para **todas** as rotas, inclusive
  as que só repassam ao repository e o `/frete`:
  - produtos: listar e buscar;
  - clientes: listar, buscar e criar;
  - frete: simular;
  - pedidos: criar, buscar, resumo e cancelar;
  - relatório: vendas.

  Regra: o controller só chama service, e o service chama repositories e domínio.
- **Controllers finos e routers por recurso**, em `src/http/controllers/` e `src/http/routes/`
  (`produtos`, `clientes`, `frete`, `pedidos`, `relatorios`). O controller lê a entrada já parseada,
  chama o service e responde.
- **Erros tipados:**
  - em `src/domain/erros.ts`: `NaoEncontrado` (404), `EstoqueInsuficiente` (400) e
    `TransicaoInvalida` (400), cada um com a mensagem atual;
  - em `src/services/erros.ts`: `FalhaDoBanco(fase)`, para as rotas que têm duas mensagens 500.
- **Tratamento de erro centralizado** (`src/http/middlewares/erros.ts`), que substitui todos os
  `try/catch` dos handlers:
  - converte o erro tipado no status e na mensagem;
  - converte a falha do banco na mensagem 500 da rota, escolhida pela fase;
  - preserva o formato da rota (`{erro}` ou `{error}`);
  - loga a causa.
- **Validação com a saída do parse:** o `validar` continua respondendo o primeiro problema no formato
  da rota, mas passa a guardar o valor parseado em `res.locals`. Os schemas de CEP e de `subtotal`
  ganham `transform` (CEP sem hífen e sem espaços; `subtotal` numérico, 0 se ausente ou vazio). Os
  ids do path continuam texto. Revê a decisão da etapa 3 de que o `validar` "não altera a requisição".
- **`src/domain/pedido.ts`:** o status do pedido e `podeCancelar`, a única transição do ciclo de vida.
- **Log de requisição** como middleware próprio (`src/http/middlewares/log.ts`).
- **Injeção:** só os repositories continuam injetados, porque dependem do `db`. O `createApp` monta
  os services sobre eles e os entrega aos routers. Domínio e schemas passam a ser importados direto.
- **Saem do projeto:** `src/routes/legado.js`, `src/routes/pedidos.js`, `src/routes/clientes.js` e
  `src/utils.js`. A regra do CEP passa a morar só em `src/http/schemas/cep.ts`. O aviso de que o
  `DELETE /pedidos/:id` foi desativado de propósito passa para o router de pedidos, como comentário,
  sem o código antigo.
- **Testes:** um teste de caracterização novo, escrito antes de qualquer mudança, registra a resposta
  atual ao corpo JSON malformado (400 em HTML, do tratador padrão do Express). Nenhum teste existente
  muda.
- **Docs:** `AGENTS.md` (Mapa, Armadilhas e Convenções), JSDoc das rotas e dos services, o comentário
  de origem do `docs/openapi.yaml` (`src/routes/` → `src/http/routes/`) e `docs/refatoracao.md` (etapa
  6 concluída, decisões, a etapa 5 marcada como concluída no cabeçalho e o registro de andamento).
  O README não muda, porque o contrato é o mesmo.

## Capabilities

### New Capabilities

Nenhuma. É uma refatoração sem mudança de comportamento: a change usa `skip_specs: true`. Os specs
`falhas-do-banco`, `validacao-entrada`, `gravacao-pedidos` e `busca-produtos` continuam valendo como
estão e são a rede de segurança, junto com os testes de caracterização.

### Modified Capabilities

Nenhuma.

## Impact

- **API:** nenhuma mudança de status, corpo, mensagem ou valor gravado. A única diferença observável é
  um bug de programação (exceção inesperada num service): hoje, fora de um `try`, ele vira a página
  HTML 500 do Express; depois, vira o JSON 500 da rota. Nenhum caminho testado chega nele, e o
  resultado é coerente com o spec `falhas-do-banco`.
- **Código:**
  - novos `src/services/*.ts`, `src/http/controllers/*.ts`, `src/http/routes/*.ts`,
    `src/http/middlewares/erros.ts`, `src/http/middlewares/log.ts`, `src/domain/erros.ts` e
    `src/domain/pedido.ts`;
  - `src/app.ts` (monta services e routers), `src/http/middlewares/validar.ts` e os schemas de CEP e
    de frete;
  - removidos `src/routes/` e `src/utils.js`.
- **Testes:** um teste de caracterização novo (JSON malformado). Os 163 testes atuais passam sem
  mudança.
- **Dependências:** nenhuma.
- **Fora de escopo:**
  - unificar o formato de erro (`{erro}` x `{error}`);
  - corrigir as divergências de preço e as demais regras *a confirmar*;
  - mudar consultas (por exemplo, o N+1 dos itens no relatório) ou o schema;
  - autenticação e rotas novas;
  - TypeScript estrito, remoção do `allowJs` e `z.infer` em todo o código (etapa 7);
  - o texto dos testes que citam `descontos.js` (etapa 8).
