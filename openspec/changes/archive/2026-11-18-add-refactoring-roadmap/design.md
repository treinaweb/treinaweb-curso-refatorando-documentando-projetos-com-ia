# Design

## Context

Veja proposal.md (seção Why). O projeto já tem 88 testes de caracterização (change arquivada `2026-11-18-add-characterization-tests`), que registram o contrato HTTP atual. Nove deles (`[atual]`) registram bugs e divergências. A pasta `docs/` hoje só tem o `openapi.yaml`. O `AGENTS.md` é lido pelos agentes em toda sessão. As decisões que o roteiro registra vêm da exploração feita com o usuário e da leitura do código (`app.js`, `routes/`, `utils.js`, `descontos.js`, `db.js`) e das versões atuais no npm.

## Goals / Non-Goals

**Goals:**
- Um único documento que qualquer change de refatoração possa citar, com escopo, decisões e critério de pronto por etapa, detalhado o bastante para o `/opsx:propose` não precisar redescobrir nada.
- Deixar claro o que está **decidido**, o que é **padrão proposto** (a confirmar) e o que está **em aberto**.

**Non-Goals:**
- Substituir as changes: o roteiro não tem tarefas nem design detalhado. Cada etapa ainda passa pelo `/opsx:propose`.
- Criar specs no `openspec/specs/`, porque a refatoração não muda comportamento, exceto na etapa de correções, que terá a própria change.
- Documentar a API: isso continua no README e no OpenAPI.

## Decisions

### D1. Um arquivo Markdown em português, `docs/refatoracao.md`
O documento segue o idioma do domínio e dos demais documentos. Fica fora de `openspec/` porque é uma referência de longo prazo que sobrevive ao arquivamento das changes. Mantê-lo dentro de uma change o deixaria preso a ela.
*Alternativas:* um `openspec/specs/refatoracao/` (specs descrevem comportamento, não plano) ou um documento externo, como o Claude Docs (fora do repositório, sem versionamento junto com o código).

### D2. Estrutura fixa por etapa
Cada etapa usa os mesmos campos: **change sugerida** (nome kebab-case), **depende de**, **objetivo**, **escopo**, **fora de escopo**, **decisões tomadas**, **decisões em aberto**, **riscos**, **pronto quando**. Isso permite ao `/opsx:propose` copiar o escopo e as decisões direto para a proposal e o design da etapa.

### D3. Três níveis de certeza, sempre explícitos
- **Decidido:** confirmado pelo usuário na exploração (por exemplo, o Zod na etapa de validação, a política estrita, as correções 1 a 6).
- **Padrão proposto (confirmar na etapa):** sugerido mas ainda não confirmado (por exemplo, campos extras ignorados, `Subtotal invalido` para subtotal inválido, `Busca invalida` para busca repetida).
- **Em aberto:** a decidir na própria etapa, com as opções e uma recomendação (por exemplo, o driver do SQLite, `tsc` ou TS direto, Node 24).

Um "silêncio" na exploração não é tratado como confirmação.

### D4. Números estáveis e ordem de execução separada
As etapas mantêm a numeração usada na exploração (0 a 8), e a ordem de execução fica numa linha própria (0 → 1 → 3 → 2 → 4 → 5 → 6 → 7 → 8). Assim, as referências feitas na conversa e nas changes não quebram.

### D5. Registro de andamento no próprio roteiro
Uma tabela com a etapa, a change e o status (`pendente`, `em andamento`, `concluida (<pasta do archive>)`) fica no fim do documento. A convenção no `AGENTS.md` pede que cada change de refatoração atualize essa tabela, e também o roteiro se alguma decisão mudar, na mesma change.

### D6. Fatos verificados, com fonte
Os pontos que dependem de versões ou de comportamento de biblioteca citam o que foi verificado e quando (por exemplo, o Express 5 deixa `req.body` indefinido sem corpo e muda o *query parser* para `simple`; o Vitest 5 exige Node `^22.12`; o `node:sqlite` emite `ExperimentalWarning` no Node 22 e no 24; versões no npm em 2026-11-18). A etapa correspondente deve revalidar esses pontos antes de decidir.

## Risks / Trade-offs

- [O roteiro ficar desatualizado conforme as etapas avançam] → A convenção D5 no `AGENTS.md` obriga cada change de refatoração a atualizá-lo.
- [O roteiro ser tratado como decisão final e travar ajustes] → O texto diz que ele é uma referência: uma etapa pode mudar uma decisão, desde que registre a mudança no roteiro na mesma change.
- [As versões citadas envelhecerem] → O D6 data cada verificação, e cada etapa revalida.
