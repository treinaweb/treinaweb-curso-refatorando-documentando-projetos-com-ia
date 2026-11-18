# Tasks

## 1. Roteiro

- [x] 1.1 Criar `docs/refatoracao.md` com: o objetivo; os princípios e invariantes (testes de caracterização como rede de segurança; só a etapa 3 altera testes; regras de negócio *a confirmar* preservadas; uma change por etapa); a arquitetura de destino com diagrama ASCII e os padrões adotados; a ordem de execução (D4). Verificar que o diagrama usa só ASCII (`grep -nP '[^\x00-\x7F]' docs/refatoracao.md` não mostra nada dentro dos blocos de diagrama)
- [x] 1.2 Adicionar ao `docs/refatoracao.md` as etapas 0 a 8, com a estrutura fixa do D2 e os níveis de certeza do D3. Incluir na etapa 3 a tabela das correções 1 a 6, a política de tipos estrita, os padrões propostos ainda a confirmar e o requisito de adicionar testes de caracterização antes de mudar o comportamento. Verificar que cada etapa tem todos os campos do D2 (conferir os 9 campos em cada uma das 9 seções)
- [x] 1.3 Adicionar ao `docs/refatoracao.md` a seção "Fora da refatoração" (estoque negativo, resumo `> 500`, relatório `Math.round`, unificação do formato de erro, regra antiga do VIP), a seção "Fatos verificados" com as datas (D6) e o "Registro de andamento" (D5), com a etapa 0 concluída (`2026-11-18-add-characterization-tests`) e as demais pendentes. Verificar que os fatos citados batem com o código atual: `grep -n "sub > 500\|Math.round" app.js` e os 9 testes de `grep -rn "\[atual\]" test`

## 2. AGENTS.md

- [x] 2.1 Atualizar o `AGENTS.md`: incluir `docs/refatoracao.md` no Mapa e, em Convenções, dizer que as changes de refatoração seguem o roteiro, citam a etapa e atualizam o roteiro (registro de andamento e decisões alteradas) na mesma change. Verificar com `git diff AGENTS.md` que nenhuma regra de negócio mudou

## 3. Verificação final

- [x] 3.1 Confirmar com `git status` que só mudaram `docs/refatoracao.md`, `AGENTS.md` e a pasta da change, e que `npm test` continua passando (88 testes e 8 todo), sem alteração de código
