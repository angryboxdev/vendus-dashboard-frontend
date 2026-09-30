# Módulo: bank-statements (Frontend)

> Status: ativo
> Última atualização: 2026-09-30

---

## O que é e para que serve (perspectiva de negócio)

Permite ao gestor importar extratos bancários (CSV/XLSX), ver o "espelho do banco" e conciliar cada movimento com documentos financeiros (faturas, contas a pagar) ou classificá-los manualmente com comprovativo, centro de custo, fornecedor e IVA.

**O problema que resolve:**
Sem este módulo, o gestor teria de reconciliar manualmente cada linha do extrato bancário contra documentos em papel ou noutra ferramenta, sem visibilidade de progresso nem deteção automática de padrões.

**O fluxo do ponto de vista do negócio:**

```
Gestor
──────────────────────────────────────────────────
1. Importa ficheiro CSV/XLSX do banco (+ metadados)
2. Vê lista de extratos importados
3. Abre extrato → espelho do banco
4. Aplica regras automáticas
5. Pede sugestões de correspondência
6. Por cada movimento não resolvido, clica "Classificar":
   a. Tab "Justificar com fatura" — seleciona uma ou mais faturas/contas a pagar
      (candidatos automáticos + pesquisa livre por nome/número).
      O sistema só mostra entidades com saldo em aberto;
      tentar associar uma fatura já totalmente conciliada resulta em erro visível em toast.
   b. Tab "Justificar despesa" — escolhe sub-tipo:
      • Comprovativo / recibo pontual — sobe ficheiro PDF ou imagem
      • Taxa bancária automática — regista sem documento
      • Contrato recorrente — seleciona a recorrência e a ocorrência do mês; a ocorrência
        fica marcada com badge "Banco" na lista de recorrências
      • Transferência interna — preenche notas
      • Empréstimo / financiamento — regista com centro de custo
   - Se já resolvido → o painel mostra um resumo com tipo de justificação, entidade
     associada (fatura ou ocorrência de contrato), fornecedor e centro de custo; com opções:
     • "Alterar classificação" — re-abre o formulário
     • "Anular conciliação" (se ligado a faturas) — remove links e repõe pendente
     • "Anular justificação" (se justificado sem fatura) — repõe pendente sem alterar faturas
7. Fecha extrato quando diferença = 0
```

**Conceitos-chave para o negócio:**

- **Extrato** — conjunto de movimentos de um período, de uma conta bancária.
- **Movimento** — linha do extrato (débito ou crédito) com estado de reconciliação.
- **Conciliação** — associação de um movimento a um ou mais documentos (faturas ou contas a pagar) ou justificação manual.
- **Justificado** — estado de um débito explicado manualmente sem fatura formal (comprovativo, taxa bancária, contrato recorrente, empréstimo). Conta como resolvido para efeitos de progresso, com label distinto de "Conciliado com fatura".
- **Conciliação parcial** — movimento já associado a entidades, mas com diferença de montante superior a 1€; não conta como resolvido.
- **Anular justificação** — ação distinta de "Anular conciliação": repõe o movimento como pendente sem tocar em nenhuma fatura (pois não havia fatura ligada).
- **Progresso** — % de movimentos em estado "resolvido" (conciliado c/ fatura, justificado, transferência interna, ignorado).
- **Regra automática** — padrão de texto que classifica movimentos automaticamente.
- **Comprovativo** — ficheiro (PDF/imagem) que justifica uma despesa sem fatura no sistema.
- **Centro de custo** — hierarquia grupo → categoria que classifica a despesa para efeitos de DRE/cashflow.
- **IVA** — taxa percentual + flag de inclusão (incluído/excluído/isento) registada no movimento.

---

## Propósito técnico

Adapter de entrada (UI) que expõe as operações do backend `bank-statements` ao gestor. Consome a API via `BankStatementsApiPort`; não contém lógica de negócio. Para as listas de fornecedores e centros de custo, delega directamente nos hooks de `financial-base`; para pesquisa de faturas, delega no hook de `invoices`.

## Conceitos do domínio

Definidos em `domain/entities/bank-statement.ts`:
- `ReconciliationStatus` — inclui `justificado` (novo, para justificações manuais sem fatura), `conciliado_parcial` (não resolvido), `JustificationType`, `RiskLevel`, `MovementType`, `StatementStatus`
- `RECONCILIATION_STATUS_LABELS` — inclui `justificado: "Justificado"`
- `RESOLVED_STATUSES` — inclui `justificado`
- `EntityLinkDTO` — ligação entre um movimento e uma entidade (`entityType`, `entityId`, `amountCents`, `entityLabel`)
- `BankMovementDTO` — inclui `entityLinks: EntityLinkDTO[]` e `reconciliationAmountDiff: number | null` (diferença montante vs soma dos links; `null` se não aplicável)
- `BankStatementSummaryDTO`, `BankStatementDetailDTO`
- `ClassifyMovementPayload` — inclui `documentUrl?`, `costCenterGroupId?`, `costCenterCategoryId?`, `supplierId?`, `vatRate?`, `vatIncluded?`, `matchedEntityId?`, `matchedEntityType?`
- Label maps e `RESOLVED_STATUSES`
- `MonthlySuggestionsDTO` — `{ entityMatches: MonthlyEntityMatchSuggestionDTO[], repeatJustifications: RepeatJustificationSuggestionDTO[] }`, devolvido por `getMonthlySuggestions`. `MonthlyEntityMatchSuggestionDTO` espelha `MovementCandidateDTO` + `movementId`; `RepeatJustificationSuggestionDTO` carrega os campos de classificação do movimento-fonte (`justificationType`, `costCenterGroupId/CategoryId`, `supplierId`, `notes`, `riskLevel`, `vatRate`, `vatIncluded`) mais `sourceMovementId/Description/Date` para a mensagem "Igual a … — repetir?".

## Ports

### Saída (dependências do domínio)

- `BankStatementsApiPort` — todas as operações HTTP:
  - `importStatement`, `listStatements`, `getStatement`
  - `applyAutoRules`, `suggestMatches`, `closeStatement`, `deleteStatement`, `updateBalances`
  - `reconcileMovement(movementId, entityLinks[])` — suporta multi-entidade; cada link tem `entityType`, `entityId`, `supplierId?`
  - **Liquidação agrupada** (novo): `getGroupedSettlementSuggestions(movementId)` → combinações de faturas/notas de crédito do mesmo fornecedor que somam exatamente o valor do movimento, mais o pool de documentos elegíveis para seleção manual (`GetGroupedSettlementSuggestionsResult`); `confirmGroupedSettlement(movementId, entityLinks[])` — cada `GroupedEntityLinkInput` leva `entityId`, `documentType` (`invoice`|`credit_note`), `allocatedAmountCents` (assinado) e `expectedOpenBalanceCents` (revalidado no backend; 409 se algum documento tiver mudado entretanto)
  - `uploadMovementDocument(movementId, file)` → `{ documentUrl }` — upload de comprovativo (passo 1 de 2)
  - `findMovementCandidates`
  - `listRules`, `createRule`, `deleteRule`
  - `getAccountCalendar`, `getAccountMonthDetail`, `getMonthlySuggestions(accountId, year, month)` — sugestões da vista de mês (ver `MonthDetailView` abaixo)

## Adapters

### Entrada

- `BankStatementsView` — view principal; alternância lista ↔ detalhe por `selectedId`

  Sub-componentes internos:
  - `StatementsList` + `StatementCard` — grelha de extratos importados com barra de progresso
  - `StatementDetail` — espelho do banco: KPIs de saldos, tabs de movimentos, tabela com badges, ações
  - `ImportModal` — upload de CSV/XLSX + metadados (bankName, accountNumber, openingBalance, closingBalance, período)
  - `ClassifyDrawer` — painel lateral com dois tabs:
    - **"Justificar com documentos"** (renomeado de "Justificar com fatura"/"Conciliar com sistema") — candidatos automáticos (`findMovementCandidates`, "Sugestões automáticas", inalterado) mais a "Liquidação agrupada":
      - Se `getGroupedSettlementSuggestions` devolve `singleExactMatch`, a UI antiga (candidatos + pesquisa livre de faturas por `invApi.listInvoices`) fica exatamente como estava — não há nada a mostrar de novo.
      - Caso contrário, e se houver `primaryCombination`, mostra o cartão "Liquidação agrupada encontrada" (`GroupedSettlementSuggestions` em `GroupedSettlementSection.tsx`) com o breakdown Faturas/Notas de crédito/Total líquido, badge "Correspondência exata" e "Ver documentos"; se também houver `alternateCombinations`, o mesmo componente mostra antes um seletor por rádio ("Encontrámos N liquidações possíveis") em vez do cartão único.
      - Por baixo (sempre que não há `singleExactMatch`), `ManualMultiSelectSearch` substitui a pesquisa antiga: tabela com checkboxes sobre `eligibleDocuments` (nunca `invApi.listInvoices` — esse pool já vem filtrado e inclui notas de crédito), pills Todos/Faturas/Notas de crédito, ordenação, e painel "Seleção atual" com diferença sempre visível (nunca escondida/absorvida automaticamente).
      - "Usar sugestão" / escolher uma combinação / terminar a seleção manual apenas fazem *staging* em `allocations` (como o clique único de sempre) — nunca chamam o endpoint de liquidação diretamente.
      - Submissão (botão "Classificar"): `needsGroupedEndpoint` decide o endpoint — ver "Decisões de design" abaixo.
      - 409 (`expectedOpenBalanceCents` desatualizado) → `StaleDocumentsModal` ("Não foi possível concluir a liquidação…" / Cancelar / "Atualizar documentos"); "Atualizar documentos" remove só as entradas assinaladas como stale e reinvalida `grouped-settlement-suggestions`/`movement-candidates`/`invoice-open-balances`.
    - **"Justificar despesa"** — sub-tipos (`recibo_comprovativo`, `despesa_bancaria_automatica`, `contrato_recorrencia`, `transferencia_interna`, `emprestimo_financiamento`, `sem_justificativa`); upload de comprovativo em dois passos; combobox de fornecedor com auto-fill de centro de custo; cascata grupo→categoria; registo de IVA (três modos: incluído/excluído/isento + botões de taxa); para `contrato_recorrencia`, lista de ocorrências de recorrências candidatas via `GET /bank-statements/occurrences/candidates`
  - `GroupedSettlementSection.tsx` — sub-componentes usados só pelo `ClassifyDrawer`: `GroupedSettlementSuggestions` (cartão único / seletor de combinações), `ManualMultiSelectSearch` (pesquisa multi-seleção), `StaleDocumentsModal` (conflito 409), `DocumentTypeTag` (badge "Fatura"/"NC")
  - Vista de resumo (movimento já classificado): exibe card da ocorrência de recorrência vinculada quando `matchedEntityType === "recurrence_occurrence"`
  - Botão "Anular justificação" exibido quando `justificationType` está definido mas não há `entityLinks` (distinto de "Anular conciliação" que aparece quando há links)
  - Linhas com status `sugestao` mostram apenas "Classificar" (não há botão "Confirmar" separado)

- **`BankAccountCalendarView`** — grelha de 12 (ou até ao mês corrente, no ano em curso) `MonthCard`, um por mês, via `getAccountCalendar`. Seletor de ano com setas (limite inferior 2020, superior o ano corrente). Cada `MonthCard`:
  - Duas barras de progresso: **"Vendas conciliadas"** (`salesReconciledPercent`) e **"Despesas conciliadas"** (`expensesReconciledPercent`) — separadas porque hoje só a segunda reflete trabalho manual pendente (créditos ficam `conciliado_sem_fatura` automaticamente na importação, por isso a primeira anda quase sempre nos 100%).
  - Contagem `{reconciledMovements}/{totalMovements} conciliados`.
  - **Saldo do mês** (`balanceCents = totalCreditCents − totalDebitCents`) a verde quando ≥ 0, a vermelho quando negativo, com sinal `+`/`−` explícito.
  - Clicar num cartão navega para `MonthDetailView` desse mês.
- **`MonthDetailView`** — vista de mês de uma conta (rota `/financial/bank-statements/banks/:bankId/accounts/:accountId/:year/:month`), a navegação primária real hoje (paradigma de calendário — ver "Pontos de atenção" sobre `BankStatementsView` acima estar desactualizado/órfão). Timeline de movimentos agrupada por dia + painel `ClassifyDrawer` inline (ecrãs ≥1280px) ou drawer portal.
  - **Tabs "Movimentos" / "Sugestões"** acima da timeline. A aba "Sugestões" mostra um badge com a contagem total quando não está activa.
  - **Toggle "Por conciliar" / "Todos"** (só visível na aba "Movimentos"; default **"Por conciliar"**) — filtra `day.movements` client-side por `!m.isResolved`; dias sem movimentos pendentes desaparecem da lista. Sem chamada extra ao backend — `getAccountMonthDetail` já devolve tudo, o filtro é só sobre os dados já carregados.
  - **Aba "Sugestões"** — chama `getMonthlySuggestions` (sempre activa, não só quando a aba está aberta, para o badge de contagem aparecer de imediato). Duas secções:
    - *Faturas / contas a pagar* — clicar na linha abre o `ClassifyDrawer` (tab "Justificar com fatura") já com a entidade sugerida alocada, para o gestor rever/ajustar o valor ou trocar de fatura antes de confirmar.
    - *Movimentos recorrentes* — clicar na linha abre o `ClassifyDrawer` (tab "Justificar despesa") já preenchido com os campos do movimento-fonte (`RepeatJustificationSuggestionDTO` → `ClassifyDrawerSuggestion`), pronto a confirmar ou a corrigir.
  - Aplicar uma sugestão invalida também a query `["bank-month-suggestions", accountId, year, month]` (além das de `bank-month`/`bank-calendar` já existentes), para a sugestão aplicada desaparecer da lista.

### Saída

- `HttpBankStatementsApiAdapter` — implementa `BankStatementsApiPort` usando `apiGet`, `apiPost`, `apiPatch`, `apiDeleteNoContent`, `apiPostFormData` de `lib/api.ts`; base URL `/api/bank-statements`

## Decisões de design (ADR resumido)

- **CSV/XLSX processado no backend**: o frontend faz `multipart/form-data` upload; não toca nos dados do ficheiro.
- **Sem sub-rotas**: a navegação lista ↔ detalhe é feita por estado local (`selectedId`) dentro de `BankStatementsView`, evitando URLs voláteis para um ecrã transacional.
- **React Query**: todas as queries e mutations usam `@tanstack/react-query` para cache e invalidação automática.
- **Provider aninhado dentro de `PayableEntriesProvider`**: segue o padrão dos outros módulos financeiros em `App.tsx`.
- **Upload de comprovativo em dois passos**: `POST /movements/:id/document` devolve `{ documentUrl }`; essa URL é depois incluída no `classifyMovement`. O domínio recebe um comando coeso sem dependência de I/O de storage.
- **Cross-module UI sem port dedicado**: `ClassifyDrawer` usa `useFinancialBaseModule()` e `useInvoicesModule()` directamente (válido porque todos os providers estão no scope da árvore). Os IDs ficam guardados no movimento; o lookup reverso (nomes) é feito no frontend via join local.
- **Candidatos de ocorrências via endpoint dedicado**: `contrato_recorrencia` chama `GET /bank-statements/occurrences/candidates` (não `GET /payable-recurrences/occurrences`) — o backend expõe o endpoint no próprio módulo para evitar dependência directa do frontend em dois módulos distintos para a mesma acção de classificação. A query só é activada quando `subType === "contrato_recorrencia"` (flag `enabled` no `useQuery`).
- **`justificado` como status distinto de `conciliado_sem_fatura`**: `STATUS_COLORS` em `ClassifyDrawer`, `BankStatementsView` e `MonthDetailView` mapeiam `justificado → bg-sky-50 text-sky-700`.
- **VAT como taxa + flag**: armazena `vatRate` (número %) + `vatIncluded` (boolean | null); o valor base é calculado nos relatórios sem necessidade de re-submissão.
- **Erros de negócio como toast, não como alert**: `onError` das mutations usa `showToast(e.message, "error")`. O `ToastContainer` tem `z-[200]` para aparecer acima de modais e drawers (`z-50`).
- **`balanceAfter` calculado ao vivo**: o backend recalcula a coluna "Saldo após" de cada movimento a partir do `openingBalance` — o frontend não precisa de recalcular nem de re-fetch extra ao editar o saldo inicial.
- **Toggle "Por conciliar/Todos" é só um filtro client-side, sem endpoint novo**: `getAccountMonthDetail` já devolve o mês completo (`DaySlot[]`); o `MonthDetailView` deriva `visibleDays` com `useMemo` em vez de pedir ao backend uma lista já filtrada. Mais simples e evita duplicar a lógica de "resolvido" (`!m.isResolved`) no backend só para este filtro.
- **Clicar numa sugestão abre o `ClassifyDrawer` pré-preenchido, não aplica directamente**: `ClassifyDrawerSuggestion` (exportado por `ClassifyDrawer.tsx`) carrega os valores da sugestão (entidade a alocar, ou tipo de justificação + centro de custo + fornecedor + IVA) e é passado como prop `suggestion` ao abrir o drawer a partir de uma linha da aba "Sugestões" (`openEntityMatchSuggestion`/`openRepeatJustificationSuggestion` em `MonthDetailView`). O drawer usa-o só para semear o `useState` inicial dos seus campos (aloc­ações já com a fatura/conta sugerida, ou tab "Justificar despesa" já preenchida) — a submissão continua a passar pelos mesmos `onReconcile`/`onSave` de sempre, por isso o utilizador vê exactamente o que vai ser gravado e pode alterar qualquer campo (ex: trocar a fatura sugerida, ajustar o centro de custo) antes de confirmar. Decisão revista depois do pedido inicial (que tinha sido "aplicar com um clique") — o gestor precisava de poder corrigir a sugestão antes de guardar, não só confirmá-la às cegas.
- **`ClassifyDrawer` ganha `key={movement.id}` em ambos os pontos onde é montado**: antes, trocar de movimento reutilizava a mesma instância do componente — o `useEffect` só repunha `isEditMode`/`activeTab`, deixando `allocations`, `subType`, `notes`, centro de custo, fornecedor e IVA por resetar (bug latente, agravado por `suggestion` variar por movimento). Forçar remount por `movement.id` faz todos os `useState(() => …)` recalcularem a partir do `movement`/`suggestion` correctos sempre que o utilizador muda de sugestão ou de linha.
- **Sugestões de mês calculadas ao vivo, sem novo estado no movimento**: ao contrário do fluxo antigo (`suggestMatches`, que grava `reconciliationStatus: "sugestao"` no movimento), `getMonthlySuggestions` não muta nada — é chamado em cada abertura da vista de mês e invalidado depois de aplicar uma sugestão via a mutation existente.
- **"Liquidação agrupada" — `AllocationEntry` ganha `documentType?`/`expectedOpenBalanceCents?` opcionais**: presentes só nas entradas vindas do fluxo novo (sugestão agrupada, combinação alternativa, ou seleção manual multi-documento); ausentes nas entradas do fluxo antigo (clique único em candidato/pesquisa). `ClassifyDrawer` usa essa presença para decidir, no submit, qual endpoint chamar — não há um "modo" explícito na UI, é derivado do conteúdo real de `allocations`.
- **Regra de escolha de endpoint no submit (`needsGroupedEndpoint`)**: submete via `onConfirmGroupedSettlement` (novo) sempre que o conjunto final de alocações tem mais de uma entrada, OU inclui uma nota de crédito, OU inclui qualquer entrada com `documentType` definido (veio do fluxo agrupado/multi-seleção); uma alocação legacy verdadeiramente única (uma só fatura, vinda do clique único de sempre) continua a usar `onReconcile` sem alterações. `payable_entry` nunca é enviado ao endpoint agrupado (o `GroupedEntityLinkInput` do backend não tem esse conceito) — bloqueado em `addAllocation`/`stageGroupedDocs` para os dois tipos não poderem ficar misturados na mesma submissão.
- **`onConfirmGroupedSettlement` devolve uma Promise e é chamado pelo próprio `ClassifyDrawer` (não pelo `onReconcile` existente)**: o `ClassifyDrawer` precisa de interceptar um 409 para mostrar o seu próprio modal de conflito (`StaleDocumentsModal`) sem que o chamador (`MonthDetailView`/`BankStatementsView`) precise de conhecer essa forma de erro; o chamador continua dono da mutation real (`groupedSettlementMut`), da invalidação de queries e do toast de sucesso — só ignora o toast de erro quando é um 409 (o drawer já mostra o modal).
- **Entradas de origem agrupada não são editáveis linha-a-linha**: ao contrário do fluxo antigo (`NumericInput` por entrada), uma entrada com `documentType` definido mostra o valor (assinado, a vermelho se negativo) como texto estático — o valor a usar é sempre o saldo em aberto completo do documento (`allocatedCents = openBalanceCents`), coerente com o conceito de "documentos que somam exatamente o movimento"; só pode ser removida, não editada.
- **`ManualMultiSelectSearch` nunca bloqueia "Associar N documentos" por diferença ≠ 0**: espelha o comportamento existente do fluxo antigo (`reconcileMovement` já permite alocação parcial/inexata — ver "Restam X por alocar" no resumo) — a diferença é sempre mostrada (nunca escondida ou absorvida), mas só um "Diferença" a vermelho, sem impedir a submissão.
- **Coluna "Total original" da tabela de seleção manual mostra sempre "—"**: `GroupedSettlementDocDTO` só traz `openBalanceCents` (saldo em aberto), não o total original do documento; não há endpoint barato para obter os totais originais em lote para a pool inteira de `eligibleDocuments`. Documentado na própria UI (nota abaixo da tabela) em vez de fabricar um número. Revisitar se o backend passar a incluir o total original no DTO.
- **`MonthCard` do calendário: vendas e despesas separadas, sem indicador de "cobertura" (set/2026)**: as duas barras deixaram de ser "Cobertura" (dias com movimento / total de dias do mês) e "Conciliação" (todos os movimentos, misturando créditos e débitos), e passaram a ser `salesReconciledPercent`/`expensesReconciledPercent` vindos do backend. Motivo: misturar créditos e débitos escondia o sinal — créditos ficam resolvidos automaticamente na importação, por isso uma % combinada ficava sempre alta mesmo com dezenas de despesas por classificar. "Dias cobertos/total de dias" também saiu — não dizia se havia trabalho pendente, só se o extrato tinha sido importado; o `{reconciledMovements}/{totalMovements}` já cobre essa necessidade de forma mais directa. O saldo do mês (`balanceCents`, verde/vermelho) é novo — antes só aparecia no detalhe do mês (`MonthDetailView`), não na vista de calendário.

## Como testar

```bash
cd vendus-dashboard-frontend
npx vitest run
```

## Pontos de atenção / dívidas conhecidas

- Gestão de regras de reconciliação (listagem/criação/eliminação) ainda não está exposta na UI — os endpoints existem no backend mas não há ecrã dedicado no frontend.
- **`BankStatementsView` (e a acção "Sugerir correspondências" que descreve, via `suggestMatches`) não está roteada em `App.tsx`** — a navegação real é o paradigma de calendário (`BanksView` → `BankAccountsView` → `BankAccountCalendarView` → `MonthDetailView`). O texto acima que descreve `BankStatementsView` como "view principal" está desactualizado; mantido por documentar código que ainda existe no repo (não eliminado), não o fluxo em uso. A aba "Sugestões" do `MonthDetailView` (`getMonthlySuggestions`) é o equivalente actual, com clique-para-abrir-o-drawer-pré-preenchido em vez de toast.
- O bucket `bank-statement-documents` no Supabase Storage deve ser criado manualmente com política de acesso público de leitura (necessário para o upload de comprovativos funcionar).
- **`getMonthlySuggestions` não filtra por `movementType`**: ao contrário do `suggestMatches` antigo (só débitos), a aba "Sugestões" tenta match de fatura/payable para qualquer movimento pendente do mês, débito ou crédito — na prática quase sempre débitos, já que créditos se auto-resolvem na importação, mas um crédito reposto manualmente a pendente (ex: nota de crédito) também entraria nas sugestões de fatura, o que pode não fazer sentido de negócio. Revisitar se surgir um caso real.
