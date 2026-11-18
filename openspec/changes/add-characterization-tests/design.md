# Design

## Context

Veja proposal.md (seção Why). Estado atual que define a abordagem:

- `app.js` chama `app.listen` assim que é carregado e não exporta nada, então não pode ser importado por um teste.
- `db.js` é um singleton: lê `DB_PATH` uma única vez no `require`, cria o schema e o seed se o arquivo não existir e exporta uma conexão `sqlite3` em `serialize()`. Isso garante que o seed roda antes de qualquer consulta posterior.
- O seed é determinístico: 17 produtos e 10 clientes, com ids previsíveis. Alguns preços (29.90, 34.70, 61.70) provocam erros de ponto flutuante.
- Todo o comportamento relevante é visível pela própria API: o estoque via `GET /produtos/:id`, os valores gravados via `GET /pedidos/:id` e o status via resumo ou detalhe.
- O projeto é CommonJS, sem `"type": "module"`, e o `.nvmrc` indica Node 22 (localmente, 22.15).
- Comportamento atual já observado num banco descartável (ver proposal.md para a lista): estoque negativo com produto repetido, resumo `comum` com R$ 500 exatos mostrando desconto 0, relatório com `Math.round`, `?busca='` → 500, `produto_id: "abc"` → 500, `POST /pedidos` sem body → `cliente_id obrigatorio`.

## Goals / Non-Goals

**Goals:**
- Fazer qualquer mudança no contrato HTTP (status, corpo, mensagens, efeitos no estoque e nos valores gravados) quebrar pelo menos um teste.
- Manter a suíte estável durante a refatoração: ela só depende do `app` exportado e do HTTP, não de módulos internos (`utils`, `descontos`, `db`), e já está em TS para sobreviver à migração do app.
- Manter cada arquivo de teste independente dos outros: banco próprio, ordem livre e execução em paralelo.

**Non-Goals:**
- Testes unitários de funções internas (`calcula_frete`, `desconto_*`, `validaCep`), porque a refatoração vai mover ou fundir essas funções.
- Corrigir bugs ou divergências, padronizar erros ou validar `:id`.
- Converter o código de produção para TS, adicionar build ou CI.
- Meta mínima de cobertura.
- Simular falhas do SQLite para alcançar os ramos 500 internos (ver D9).

## Decisions

### D1. Em processo, com supertest, exportando o `app`
No final do `app.js`, o `app.listen(...)` passa a ficar dentro de `if (require.main === module)`, seguido de `module.exports = app`. O supertest recebe o `app` sem servidor ativo, abre uma porta efêmera em `127.0.0.1` e a fecha ao fim de cada requisição. Como essa mudança acontece antes de existir qualquer teste, ela é a primeira tarefa e é verificada à mão (subir com `node app.js` num banco descartável, conferir o log `Loja rodando na porta` e uma chamada `curl`).
*Alternativa:* caixa-preta, subindo `node app.js` como processo filho, sem tocar na produção. Foi descartada por decisão do usuário em favor do supertest.

### D2. Vitest com isolamento por arquivo (padrão)
Pool `forks` com `isolate: true` (o padrão do Vitest 5): cada arquivo de teste roda num processo filho próprio, com cache de módulos e singleton do `db.js` novos. Dentro de um arquivo, os testes rodam em sequência (o padrão), o que torna previsível o estado do banco ao longo do arquivo.
*Alternativas:* `node:test` (sem dependência, mas exige `tsx` ou remoção de tipos para rodar em TS) e Jest (exige `ts-jest` ou Babel e tem configuração de ESM difícil para quando o app virar ESM).

### D3. Banco temporário por arquivo via `setupFiles`
Os `import` estáticos do ESM são içados, então definir `process.env.DB_PATH` no topo do arquivo de teste rodaria tarde demais. Um `test/setup.ts`, registrado em `setupFiles`, roda dentro de cada processo antes do arquivo de teste e:
- define `DB_PATH` como um arquivo único em `os.tmpdir()` (com pid e um sufixo aleatório);
- silencia `console.log` e `console.error` com `vi.spyOn(...).mockImplementation(() => {})`, para esconder o log de requisições e os erros do código legado. Os logs não fazem parte do contrato;
- no `afterAll`, fecha a conexão do `db` e apaga o arquivo temporário.

Para fechar a conexão, o setup obtém o `db` com `createRequire(import.meta.url)('../db.js')`. Assim ele usa o mesmo cache de `require` nativo que o `app.js` usa, em vez de criar uma segunda instância pelo carregador do Vitest (ver Riscos).

### D4. Testes em TypeScript, produção em JS
Os arquivos de teste são `test/**/*.test.ts` e importam `import app from '../app'`. A interoperabilidade CJS/ESM entrega o `module.exports` como default, e essa linha continua válida quando o app virar `app.ts` com `export default`. O `tsconfig.json` é mínimo: `strict`, `noEmit`, `allowJs: true` e `checkJs: false` (o editor infere os tipos do JS legado sem apontar erros nele), `include` com `test/**` e `vitest.config.mts`. O Vitest não checa tipos, então a checagem é o script `typecheck` (`tsc --noEmit`), separado do `npm test`.

### D5. Asserções sobre o JSON inteiro
Por padrão, cada resposta é comparada inteira com `toEqual`, para pegar campos a mais ou a menos e mudanças de nome ou formato (`{erro}` x `{error}`). Campos que mudam a cada execução usam matchers: `criado_em` → `expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/)`, e `id` de pedido → `expect.any(Number)` quando o valor exato não importa. Os valores monetários são comparados exatamente com o que a API devolve hoje (por exemplo, `95.73`), sem `toBeCloseTo`, porque o arredondamento faz parte do comportamento. O status HTTP é sempre verificado. O `Content-Type` JSON é verificado nas rotas JSON.

### D6. Convenção para o comportamento atual
Testes que registram um bug ou uma divergência:
- têm o nome iniciado por `[atual]` (por exemplo, `it('[atual] aceita produto repetido acima do estoque e deixa estoque negativo', ...)`);
- têm um comentário logo acima apontando a fonte, como o `@todo Diverge de...` do JSDoc correspondente ou a descrição do bug, e dizendo que a correção exige uma mudança própria.

A lista é obtida com `grep -rn "\[atual\]" test`. A convenção entra no `AGENTS.md`.

### D7. Organização por área, com o estado controlado
```
test/
  setup.ts             DB_PATH temporario, console silenciado, teardown
  helpers.ts           request(app), criarPedido(), estoqueDe() e afins
  produtos.test.ts     listagem (17 do seed), busca, busca com aspas -> 500, detalhe, 404
  clientes.test.ts     listagem, detalhe, 404, cadastro (CEP com/sem hifen, tipo comum),
                       validacoes, formato {error}
  frete.test.ts        faixas 0-3/4-7/8-9, limite 300, subtotal ausente/invalido -> 0,
                       CEP invalido -> 400
  pedidos.test.ts      validacoes 400/404 (inclui sem body), desconto por tipo
                       (comum >=500, vip, atacado >=10), frete pelo CEP do cadastro,
                       total, ponto flutuante, baixa de estoque, GET /pedidos/:id,
                       [atual] produto repetido acima do estoque, [atual] produto_id
                       nao numerico -> 500
  resumo.test.ts       formato das linhas, frete gravado, 404,
                       [atual] comum com R$ 500 exatos -> desconto 0
  cancelar.test.ts     devolve estoque, 2o cancelamento -> 400, 404, rotas DELETE -> 404
  relatorio.test.ts    banco vazio -> so `geral`; tipos; ignora cancelados;
                       [atual] Math.round no desconto
```
Regras para lidar com o estado compartilhado dentro de um arquivo:
- o estoque é verificado como diferença (lido antes e depois), nunca como valor absoluto, exceto no teste que depende do seed;
- o `relatorio.test.ts` tem o próprio banco, por ser um arquivo separado. O primeiro teste roda com o banco vazio, e os seguintes criam um conjunto conhecido de pedidos e conferem os totais exatos;
- cada teste cria os pedidos de que precisa (via helper) e não depende de pedidos criados por outro teste, exceto no relatório, que é acumulativo de propósito e roda em sequência;
- os cenários escolhem produtos e quantidades que não esgotam o estoque usado por outros testes do mesmo arquivo.

### D8. Scripts e cobertura
- `test`: `vitest run`
- `test:coverage`: `vitest run --coverage` (provider `v8`, relatório em texto; `coverage/` vai para o `.gitignore`)
- `typecheck`: `tsc --noEmit`

A cobertura serve como mapa para achar ramos não exercitados, não como critério para aprovar ou reprovar.

### D9. Lacunas declaradas com `it.todo`
O que não dá para alcançar por HTTP sem injetar falhas no SQLite fica como `it.todo`, com a explicação no título:
- falha no meio do loop de criação de pedido (`Pedido criado com erros`, sem transação);
- erros 500 de consulta (`Erro ao buscar...`, `Erro ao gerar...`);
- cancelamento de pedido sem itens: a rota nunca responde, mas a API não permite criar um pedido sem itens.

Essas lacunas aparecem na saída do Vitest como pendentes e não somem silenciosamente.

### D10. Versões e Node
As devDependencies ficam com as versões atuais, gravadas pelo `npm install -D`: `vitest` e `@vitest/coverage-v8` 5.x, `supertest` 7.x, `@types/supertest`, `typescript` e `@types/node` na linha 22. O `engines` do `package.json` (`>=20.17.0`) **não muda**, porque descreve o que a aplicação precisa para rodar. O requisito do Vitest (Node `^22.12.0`) fica documentado no README e no `AGENTS.md`, e o `.nvmrc` (22) já o atende.

## Risks / Trade-offs

- [O Vitest carregar `app.js` por um caminho e o `db.js` por outro, criando duas instâncias do singleton] → O spike (tarefa 1) verifica que só há uma conexão, ou seja, que o seed roda uma vez e o `afterAll` fecha a conexão que o app usa. O D3 usa `createRequire` para ficar no cache nativo. Se o problema aparecer, a alternativa é o setup apenas apagar o arquivo, sem fechar a conexão, e deixar o fim do processo encerrá-la.
- [O processo de teste não terminar por causa da conexão sqlite aberta] → Fechamento no `afterAll` (D3), verificado no spike.
- [A mudança no `app.js` alterar o comportamento antes de existirem testes] → Ela fica restrita a duas linhas no fim do arquivo e é verificada à mão antes de qualquer outra tarefa.
- [Estado compartilhado dentro de um arquivo deixar os testes dependentes da ordem] → As regras do D7 (diferenças de estoque, cada teste com seus próprios pedidos). O relatório fica isolado no seu arquivo.
- [TypeScript 7 (o compilador nativo) tratar `allowJs` ou a interoperabilidade CJS de forma diferente] → O `typecheck` roda no spike. Se falhar por causa do compilador, fixar `typescript` na linha 6.x e registrar o motivo.
- [Testes `[atual]` "travarem" bugs] → É intencional: a correção vira uma decisão explícita, que altera o teste e o comportamento numa mudança própria.
- [Comparar o JSON inteiro tornar os testes verbosos] → Os helpers concentram os objetos esperados repetidos (por exemplo, os produtos do seed).

## Migration Plan

Não há deploy. O rollback é reverter o commit: a única mudança na produção é o export do `app` mais o `listen` condicional, e remover os testes e as devDependencies não afeta a API.

## Notas da implementação

- **Config do Vitest em `vitest.config.mts`** (não `.ts`): num pacote CommonJS, o Vite avisava que o `.ts` com sintaxe ESM estava sendo carregado como CJS. O `.mts` é ESM explícito, sem mudar o `"type"` do pacote.
- **TypeScript 7.0.2** passou no `typecheck` com `allowJs`; não foi preciso fixar a linha 6.x.
- **Spike (risco do singleton):** confirmado que o `db.js` já estava no cache do `require` nativo antes do `afterAll`, ou seja, existe uma única conexão. O seed rodou uma vez, o processo encerra sozinho e não sobra `loja-test-*` em `os.tmpdir()`.
- **`app.js`:** além do export e do `listen` condicional, o `@file` ganhou duas linhas de JSDoc sobre o export (convenção do `AGENTS.md`).
- **Testes `[atual]` além dos previstos:** `cliente_id` não numérico → 500, resumo com id não numérico → 500, `validaCep` aceitando hífen fora do lugar e `1.310100`, e `POST /pedidos` sem corpo (o `Body vazio` é inalcançável). O `POST /clientes` sem corpo não recebeu `[atual]`: a resposta 400 é coerente.
- **Cobertura** (`npm run test:coverage`): 88% das linhas e 76% dos ramos. Ficaram sem cobertura só os ramos de erro do SQLite (lacunas do D9, marcadas com `it.todo`), o `if (!body)` inalcançável de `routes/pedidos.js`, o `app.listen` (só roda com `node app.js`) e `utils.formata_moeda` (sem uso).
