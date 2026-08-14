# Módulo: invoices

> Status: ativo
> Última atualização: 2026-08-14

## O que é e para que serve (perspectiva de negócio)

Todos os meses chegam dezenas de faturas à Angrybox — da Makro, da EDP, da NOS,
de plataformas de marketing, de fornecedores de embalagens. Sem um sistema, essas
faturas ficam em papel, em email ou numa pasta, e o manager não sabe o que deve,
quando vence, nem quanto gastou por área.

**O problema que resolve:**
Perder uma fatura vencida significa juros ou interrupção de serviço. Não saber o
total de custos por centro de custo impede qualquer análise financeira. Esta página
centraliza todas as faturas, dá visibilidade sobre o estado de cada uma, permite
importar PDFs/imagens com extração automática de dados via IA, e classifica cada
despesa pela área da empresa a que pertence.

**O fluxo do ponto de vista do negócio:**

```
Manager (backoffice)
────────────────────────────────────────────────────────────────
Fluxo de importação via IA:
1. Manager clica "Importar fatura" e envia PDF, JPG ou PNG
2. IA extrai: fornecedor, NIF, nº fatura, datas, valores, linhas
3. Fatura criada em estado "Rascunho IA"
4. Manager revê dados no drawer de revisão, corrige se necessário
5. Manager confirma (quatro opções):
   — "Salvar como pendente" → estado Pendente
   — "Salvar e gerar conta a pagar" → estado Pendente + conta a pagar
   — "Fatura já paga" + data → estado Paga diretamente
   — "Débito direto" + data de débito → fica Pendente; cron processa na data e marca como Paga
6. Alertas de vencimento ficam ativos a partir daí

Fluxo manual:
1. Manager clica "Nova manual" e introduz os dados
2. A fatura fica em estado "Pendente"
3. Manager classifica as linhas por tipo e centro de custo
4. Quando paga, clica "Marcar como paga" → estado Paga

Visibilidade diária:
- Tabs rápidos (Vencem hoje / Vencem em 7 dias / Vencidas) com contagem
- Vista calendário: faturas distribuídas por dia de vencimento
- Strip de alertas: vencidas, a vencer, baixa confiança IA, pendentes de revisão
```

**Conceitos-chave para o negócio:**

- **Estado da fatura** — *Rascunho IA* (aguarda revisão do manager), *Pendente Revisão*,
  *Pendente* (a pagar), *Paga*, *Vencida* (prazo ultrapassado), *Parcial*, *Cancelada*.
- **Estado de conciliação** — orthogonal ao estado da fatura. *none* (não paga ou DD pendente),
  *pending_reconciliation* (paga no sistema, ainda não confirmada no extrato bancário), *reconciled* (confirmada).
- **Modo de linhas** — *simple* (linha única automática, não editável) ou *detailed* (linhas editáveis pelo manager).
- **Importação via IA** — o manager envia o documento original; a IA extrai os dados
  automaticamente. O manager valida/corrige antes de confirmar.
- **Linha de fatura** — detalhe do que foi comprado. Uma fatura da Makro pode ter
  "Farinha T55" (stock) e "Tampa Inox" (equipamento). Classificar por linha permite
  relatórios precisos por área.
- **Regra de classificação** — ao marcar "guardar como regra", o sistema memoriza
  subcategoria, tipo de linha e canal para futuras faturas do mesmo fornecedor com
  descrição semelhante. A regra mais específica (descrição mais longa) tem prioridade;
  existe sempre uma regra genérica por fornecedor como fallback.
- **KPIs** — total faturado (c/ e s/ IVA), total vencido (€ + contagem), total
  pendente (€ + contagem). Visão imediata sobre o estado das contas.
- **CC Padrão** — centro de custo padrão do fornecedor (configurado no cadastro de
  fornecedores); mostrado na tabela como referência rápida de classificação.
- **Débito direto** — modalidade em que o fornecedor debita automaticamente a conta
  na data acordada. A fatura fica Pendente com `isDirectDebit=true`; identificada
  na tabela com o badge "DD". Um cron diário no backend processa-a e marca-a como Paga.

---

## Propósito técnico

Gere a UI de faturas de fornecedores: listagem (tabela e calendário), importação via
IA, criação manual, ciclo de vida (draft_ai → pending → paid/cancelled/overdue),
classificação de linhas por tipo e centro de custo, e alertas operacionais.
NÃO é responsável por extratos bancários, reconciliação ou relatórios financeiros.

## Conceitos do domínio

- **InvoiceDTO** — fatura com cabeçalho (fornecedor, NIF snapshot, valores, datas,
  estado, source, aiConfidence, requiresReview, costCenterGroupId, financialType,
  flags DRE/cashflow/profitability, currency, `isDirectDebit`, `directDebitDate`) e linhas opcionais.
- **InvoiceLineDTO** — linha de detalhe com `type`, `costCenterCategoryId`, valores monetários,
  flags `affectsDre`/`affectsCashflow`/`affectsProfitability`, e campos V2: `financialType` (herdado
  da subcategoria), `channelId`, `requiresChannel`, `requiresAllocation`, `dreValue` (s/ IVA, cêntimos),
  `cashflowValue` (c/ IVA, cêntimos).
- **SuggestClassificationResult** — sugestão de classificação para uma linha: `costCenterCategoryId`,
  `defaultLineType`, `channelId` (todos anuláveis). Retornado por `suggestLineClassification()`.
- **InvoiceImportResultDTO** — resultado do import: `invoice` (draft_ai), `aiConfidence`,
  `validationIssues`, `supplierMatch`, `extractedLines`.
- **InvoiceAlertsDTO** — contagens e totais para: `overdue`, `dueToday`, `dueIn7Days`,
  `noDueDateCount`, `noSupplierCount`, `pendingReviewCount`, `lowAiConfidenceCount`,
  `valueDiscrepancyCount`.
- **InvoiceStatus** — `draft_ai | pending_review | pending | paid | overdue | partial | cancelled | review`.
- **InvoiceSource** — `manual | pdf_import | image_import`.
- **VALIDATION_ISSUE_LABELS** — mapa de chaves de validação para texto PT:
  `no_due_date`, `no_supplier_match`, `low_ai_confidence`, `value_discrepancy`, `duplicate_invoice`.
- **InvoiceLineType** — `stock_purchase | operational_expense | fixed_cost |
  variable_cost | tax | bank_fee | salary | internal_transfer | service | mixed | other`.
- Todos os valores monetários em **cêntimos** (inteiros). Exibição usa `pt-PT` locale.

## Ports

### Saída (dependências do domínio)

- `InvoicesApiPort` — métodos HTTP:
  - CRUD base: `listInvoices(params?)`, `getInvoice(id)`, `createInvoice`, `updateInvoice`, `deleteInvoice`
  - Linhas: `listInvoiceLines()`, `addLine`, `classifyLine` (aceita `channelId` no payload)
  - Ciclo de vida: `markInvoicePaid(id, paidAt?)`
  - Import IA: `importInvoice(file)` → `InvoiceImportResultDTO`; `confirmImportedInvoice(id, payload)`
  - Alertas: `getInvoiceAlerts()` → `InvoiceAlertsDTO`
  - Sugestão: `suggestLineClassification(supplierId, description?)` → `SuggestClassificationResult | null`

## Adapters

### Entrada (UI)

- **`InvoicesView`** — página `/financial/invoices`:
  - **KPIs** (4 cards): total de faturas, valor total (c/ IVA + s/ IVA), vencidas (€ + contagem), pendentes (€ + contagem).
  - **Toggle Tabela / Calendário** — segmented control no header para alternar entre as duas vistas.
  - **Alert strip** — aparece quando há alertas ativos: vencidas, a vencer em 7 dias, baixa confiança IA, pendentes de revisão. Clicável (filtra tabela por estado).
  - **Vista Tabela**:
    - Tabs com badge de contagem: *Todas*, *Vencem hoje*, *Vencem em 7 dias*, *Vencidas*.
      - "Vencem hoje": `dueDate === hoje` e status não `paid`/`cancelled`.
      - "Vencem em 7 dias": `dueDate > hoje` e `<= hoje+7` e status não `paid`/`cancelled`.
      - "Vencidas": `status === "overdue"`.
      - Mudar para tab não-"Todas" limpa o filtro de estado.
    - Filtros: pesquisa (fornecedor/nº); dropdown de estado (só visível na tab "Todas"); toggle **"Débito direto"** (filtra client-side por `isDirectDebit=true`).
    - Colunas: Estado, Fornecedor (com badge **DD** e tooltip para faturas de débito direto), Nº Fatura, Emissão, Vencimento, Pago em, S/ IVA, IVA, Total, **CC Padrão**.
      - **CC Padrão**: mostra o `code` da categoria de CC padrão do fornecedor (derivado de `supplier.defaultCostCenterCategoryId`); tooltip com o nome completo; `—` se não configurado.
  - **Vista Calendário**:
    - Grid mensal Seg→Dom com navegação mês a mês e botão "Hoje".
    - Cada célula mostra chips das faturas com `dueDate` nesse dia (fallback: `paidAt` se não houver `dueDate`). Cor do chip = status da fatura.
    - Máximo 3 chips por célula; `+N mais` se houver mais.
    - Dia de hoje destacado com círculo laranja (`#ED5C32`); dia selecionado com anel laranja e círculo escuro; dias com faturas vencidas com número a vermelho.
    - **Clicar numa célula de dia** (célula inteira, não chip individual) abre o `CalendarDayPanel` à direita do calendário. Clicar no mesmo dia novamente fecha o painel. Navegar de mês limpa a seleção.
    - **`CalendarDayPanel`**: painel lateral em grid responsivo (`xl:grid-cols-[1fr,360px]`).
      - Cabeçalho: data completa em português (ex: "Quinta-feira, 6 de agosto de 2026") + contagem de faturas + botão fechar.
      - Resumo do dia: Total · Pendente · Em atraso (valores em euros).
      - Faturas agrupadas em secções colapsáveis: **Em atraso** → **Pendentes** → **Aguardando conciliação** → **Pagas**. Só mostra grupos com faturas. "Aguardando conciliação" = `status === "paid"` e `reconciliationStatus === "pending_reconciliation"`.
      - Por fatura: nome do fornecedor, número, data de vencimento, valor + ações **Pagar** (abre `MarkPaidModal`), **Ver** (abre `InvoiceDetailDrawer`), **PDF** (link externo, só se `attachmentUrl` existir).
      - Dados derivados via `useMemo` sobre a query principal — ficam frescos se os dados mudarem.
    - **Legenda** no rodapé do calendário: Em atraso (vermelho) · Pendente (âmbar) · Paga (verde) · Ag. conciliação (violeta).
    - Secção abaixo: faturas sem `dueDate` nem `paidAt` em pills (apenas visuais — para abrir, usar a vista tabela).

- **`ImportInvoiceModal`** — modal de drag-and-drop para envio de PDF/imagem:
  - Aceita `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
  - Chama `POST /api/invoices/import` (multipart). Em caso de sucesso, fecha e abre o `ReviewImportedInvoiceDrawer`.

- **`ReviewImportedInvoiceDrawer`** — drawer de revisão de fatura importada por IA:
  - Exibe `aiConfidence` como barra de progresso colorida.
  - Lista `validationIssues` com labels PT; cada issue desaparece dinamicamente conforme o utilizador corrige os campos.
  - Permite editar todos os campos do cabeçalho (fornecedor via dropdown ou texto livre, NIF, nº fatura, datas, valores).
  - Permite ligar a um fornecedor do cadastro (atualiza nome + NIF snapshot automaticamente).
  - **"Fatura já paga"** — checkbox que oculta `dueDate`, mostra campo `paidAt` (default: `invoiceDate`), e envia `markAsPaid: true` ao confirmar.
  - **"Débito direto"** — checkbox mutuamente exclusivo com "Fatura já paga": substitui o campo `dueDate` pelo campo "Data de débito" (`directDebitDate`); suprime o alerta `no_due_date`; força `saveAsPayable: false`; mostra botão "Salvar com débito direto".
  - Edição de linhas: adicionar, editar quantidade/preço/IVA, eliminar.
  - Chama `POST /api/invoices/:id/confirm` ao confirmar.

- **`CreateInvoiceDrawer`** — drawer para criação manual:
  - Seleção de fornecedor (dropdown) ou nome livre.
  - Campos de cabeçalho + secção de linhas inline.

- **`InvoiceDetailDrawer`** — drawer de detalhe com dois tabs:
  - *Detalhes*: campos do cabeçalho; para faturas de débito direto mostra "Débito direto em" em vez de "Data de vencimento"; botão "Marcar como paga"; conta a pagar associada (se existir) com link para `/financial/payable-entries`.
  - *Linhas*: `AddLineForm` para adicionar novas linhas; `ClassifyPanel` inline por linha existente.

- **`ClassifyPanel`** — painel inline por linha: tipo (`InvoiceLineType`), subcategoria de CC
  (`costCenterCategoryId`), canal (`channelId` — obrigatório quando `requiresChannel=true`);
  badge do `financialType` herdado da subcategoria selecionada; erro inline se backend rejeitar
  por canal em falta; botão desabilitado quando canal obrigatório mas não selecionado;
  opção de guardar como regra automática para o fornecedor.

### Saída

- `HttpInvoicesApiAdapter` — implementa `InvoicesApiPort` usando `apiGet`,
  `apiPost`, `apiPatch`, `apiDeleteNoContent`, `apiPostFormData` de `src/lib/api.ts`.

## Decisões de design (ADR resumido)

**`InvoicesProvider` envolve toda a rota `/financial/*`.**
Em vez de duplicar queries, o provider foi movido para o nó pai `/financial/*` no
`App.tsx`. Qualquer vista dentro do grupo financeiro pode usar `useInvoicesModule()`.

**Linhas carregadas on-demand no detalhe.**
A listagem não inclui linhas. São carregadas apenas quando o tab "Linhas" é
activado no `InvoiceDetailDrawer` via `getInvoice(id)`.

**Vista calendário usa `dueDate ?? paidAt` como base temporal.**
O calendário mostra faturas no seu dia de vencimento. Se não houver `dueDate`
(ex: fatura já paga sem prazo definido), usa `paidAt` como fallback. Faturas sem
nenhuma data ficam numa secção separada abaixo do calendário.

**Tabs de filtragem temporal não usam o servidor.**
As contagens e filtros de "Vencem hoje / 7 dias / Vencidas" são calculados
client-side sobre os dados já carregados. Evita chamadas adicionais à API.

**Coluna CC Padrão derivada do fornecedor, não da fatura.**
A coluna mostra `supplier.defaultCostCenterCategoryId` resolvido via `categoryById`
(mapa de categorias já carregado). É informativa — serve de referência visual para
o manager saber se a classificação esperada está configurada.

**`ClassifyPanel` inline por linha (sem modal separado).**
A classificação é frequente. Ter o painel directamente visível elimina um nível
de navegação e torna o fluxo mais rápido.

**Identidade visual consistente com o grupo financeiro.**
Bordas `border-[#F5C992]/40`, fundo `#FAF6F3`, gradiente `from-[#ED5C32] to-[#EF8935]`,
KPI cards `px-5 py-4 shadow-sm text-xl`.

## Como testar

- Domínio: não há lógica de domínio no frontend — entidades são apenas interfaces TypeScript.
- Testes de UI: a implementar com Vitest + Testing Library.

## Pontos de atenção / dívidas conhecidas

- Testes de UI não implementados. A lógica de filtragem dos tabs e agrupamento do
  calendário são candidatas a extração para um serviço puro e testes unitários.
- Não há paginação na listagem — aceitável para o volume actual; o backend já suporta
  `from`/`to` como filtros de data.
- Ao fechar e reabrir o `InvoiceDetailDrawer`, as linhas são recarregadas. Considerar
  cache via `useQuery` com `queryKey: ["invoice-lines", id]`.
- `suggestLineClassification` está exposto no port/adapter mas ainda não é chamado
  automaticamente ao abrir o `ClassifyPanel` — candidato a auto-preencher o formulário.
- A regra de classificação guarda apenas uma entrada por fornecedor. Para fornecedores
  mistos (ex: Makro), o último "guardar como regra" sobrescreve o anterior.
