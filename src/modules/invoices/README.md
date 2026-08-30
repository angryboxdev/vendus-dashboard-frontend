# Módulo: invoices

> Status: ativo
> Última atualização: 2026-08-18 (delete linha; edit inline tipo+categoria em EditLineForm; edição inline do nº fatura; aviso de impacto na modal de delete; refreshFullInvoice após mutações de linha; alteração de fornecedor no ReviewDrawer)

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
4. Manager revê dados no drawer de revisão, corrige se necessário — incluindo
   alterar o fornecedor ligado sem ter de desligar primeiro
5. Manager confirma (quatro opções):
   — "Salvar como pendente" → estado Pendente
   — "Salvar e gerar conta a pagar" → estado Pendente + conta a pagar
   — "Fatura já paga" + data → estado Paga diretamente
   — "Débito direto" + data de débito → fica Pendente; cron processa na data e marca como Paga
6. Alertas de vencimento ficam ativos a partir daí

Fluxo manual:
1. Manager clica "Nova manual" e introduz os dados
2. A fatura fica em estado "Pendente"
3. Manager abre o tab "Linhas" e escolhe como pretende detalhar:
   — Modo simples (default): a fatura tem uma só linha, gerada automaticamente
     a partir dos totais do cabeçalho; a classificação é feita aí.
   — Modo detalhado: manager adiciona cada linha manualmente (ex: "Farinha T55",
     "Tampa Inox"); edita tipo, preço, IVA e subcategoria de CC por linha; pode
     eliminar linhas individualmente; o sistema verifica em tempo real se as somas
     fecham com os totais da fatura (painel de saldo em verde/vermelho).
4. Se necessário, o manager pode corrigir o número da fatura directamente no
   header do drawer (ícone de lápis) — o sistema avisa se houver duplicado.
5. Ao eliminar uma fatura, o sistema avisa quais dependências serão limpas
   automaticamente (conta a pagar cancelada; vínculos de conciliação removidos).
6. Quando paga, clica "Marcar como paga" → estado Paga

Visibilidade operacional:
- Tabs de estado (Por pagar / Aguardando conciliação / Concluídas / Todas) com contagem
- Vista calendário: faturas distribuídas por dia de vencimento
- Urgência de vencimento por linha: "Em atraso" (vermelho) / "Hoje" (laranja) / "N dias" (âmbar/cinzento)
```

**Conceitos-chave para o negócio:**

- **Estado da fatura** — *Rascunho IA* (aguarda revisão do manager), *Pendente Revisão*,
  *Pendente* (a pagar), *Paga*, *Vencida* (prazo ultrapassado), *Parcial*, *Cancelada*.
- **Estado de conciliação** — orthogonal ao estado da fatura. *none* (não paga ou DD pendente),
  *pending_reconciliation* (paga no sistema, ainda não confirmada no extrato bancário), *reconciled* (confirmada).
- **Modo de linhas** — cada fatura tem o seu próprio toggle. *Resumo* (default): o sistema gera automaticamente uma linha única com base nos totais da fatura; o manager classifica-a no próprio cabeçalho. *Detalhado*: o manager introduz cada artigo ou serviço separadamente, classifica linha a linha por tipo e subcategoria de CC, e pode eliminar linhas individualmente. Mudar para resumo apaga as linhas do modo detalhado — o manager pode voltar a detalhado quando quiser e começar de novo.
- **Conferência de totais** — em modo detalhado, o rodapé da lista de linhas mostra o somatório das linhas (subtotal s/IVA, IVA, total c/IVA) lado a lado com os totais do cabeçalho da fatura. Enquanto os valores não coincidirem (tolerância de 1 cêntimo), o painel fica a vermelho — sinal de que faltam ou sobram linhas.
- **Importação via IA** — o manager envia o documento original; a IA extrai os dados
  automaticamente. O manager valida/corrige antes de confirmar.
- **Linha de fatura** — detalhe do que foi comprado. Uma fatura da Makro pode ter
  "Farinha T55" (stock) e "Tampa Inox" (equipamento). Classificar por linha permite
  relatórios precisos por área.
- **Regra de classificação** — ao marcar "guardar como regra", o sistema memoriza
  subcategoria, tipo de linha e canal para futuras faturas do mesmo fornecedor com
  descrição semelhante. A regra mais específica (descrição mais longa) tem prioridade;
  existe sempre uma regra genérica por fornecedor como fallback.
- **CC Padrão** — centro de custo padrão do fornecedor (configurado no cadastro de
  fornecedores); mostrado na tabela como referência rápida de classificação.
- **Débito direto** — modalidade em que o fornecedor debita automaticamente a conta
  na data acordada. A fatura fica Pendente com `isDirectDebit=true`; identificada
  na tabela com o badge "DD". Um cron diário no backend processa-a e marca-a como Paga.
- **Número de fatura editável** — o manager pode corrigir o número directamente no
  header do drawer (ícone de lápis); o sistema valida duplicados e actualiza
  automaticamente a conta a pagar e os vínculos de conciliação associados.
- **Eliminação segura de fatura** — ao apagar uma fatura, o sistema mostra um aviso
  listando o que será feito automaticamente: cancelar a conta a pagar (se existir
  e não estiver paga) e remover os vínculos de conciliação bancária (se existirem).

---

## Propósito técnico

Gere a UI de faturas de fornecedores: listagem (tabela e calendário), importação via
IA, criação manual, ciclo de vida (draft_ai → pending → paid/cancelled/overdue),
classificação de linhas por tipo e centro de custo, e alertas operacionais.
NÃO é responsável por extratos bancários, reconciliação ou relatórios financeiros.

## Conceitos do domínio

- **InvoiceDTO** — fatura com cabeçalho (fornecedor, NIF snapshot, valores, datas,
  estado, source, aiConfidence, requiresReview, costCenterGroupId, financialType,
  flags DRE/cashflow/profitability, currency, `isDirectDebit`, `directDebitDate`, `lineDetailMode`) e linhas opcionais.
  - `classificationSummary` (obrigatório): `{ mode: "unique"|"mixed"|"none", entries: [...] }`. Derivado das linhas reais em `GetInvoice`; derivado do `costCenterCategoryId` do cabeçalho em `ListInvoices`. O drawer faz eager fetch de `getInvoice` ao abrir para garantir o summary com base nas linhas reais.
  - `linesSummary` (opcional): presente apenas quando `lineDetailMode=detailed` e linhas carregadas. `{ subtotalWithoutVat, totalVat, totalWithVat, totalsMismatch }` — usado para o painel de comparação de totais no tab Linhas.
- **InvoiceLineDTO** — linha de detalhe com `type`, `costCenterCategoryId`, valores monetários,
  flags `affectsDre`/`affectsCashflow`/`affectsProfitability`, e campos V2: `financialType` (herdado
  da subcategoria), `channelId`, `requiresChannel`, `requiresAllocation`, `dreValue` (s/ IVA, cêntimos),
  `cashflowValue` (c/ IVA, cêntimos). `locationId` (`string | null`) — a loja a que o custo pertence;
  `null` é um estado válido e propositado (um custo pode ser da organização inteira e de nenhuma loja
  — spec B2 D4). Nunca é preenchido por omissão a partir da primeira loja.
- **SuggestClassificationResult** — sugestão de classificação para uma linha: `costCenterCategoryId`,
  `defaultLineType`, `channelId` (todos anuláveis). Retornado por `suggestLineClassification()`.
- **InvoiceImportResultDTO** — resultado do import: `invoice` (draft_ai), `aiConfidence`,
  `validationIssues`, `supplierMatch`, `extractedLines`.
- **InvoiceAlertsDTO** — contagens e totais para: `overdue`, `dueToday`, `dueIn7Days`,
  `noDueDateCount`, `noSupplierCount`, `pendingReviewCount`, `lowAiConfidenceCount`,
  `valueDiscrepancyCount`.
- **InvoiceStatus** — `draft_ai | pending_review | pending | paid | overdue | cancelled | review`.
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
  - Linhas: `listInvoiceLines()`, `addLine`, `updateLine`, `deleteLine(invoiceId, lineId)`, `classifyLine` (aceita `channelId` no payload). `addLine`/`updateLine` aceitam `locationId?: string | null` — omitir/`null` significa "organização, sem loja"; nunca é assumido a partir da primeira loja (D4, ticket 19).
  - Modo de linhas: `setLineDetailMode(id, mode)` → `InvoiceDTO` — transição *simple → detailed* é livre; *detailed → simple* apaga as linhas no backend
  - Ciclo de vida: `markInvoicePaid(id, paidAt?)`; `setInvoiceStatus(id, status)` — usado pelo "Desfazer pagamento" para repor `pending`
  - Import IA: `importInvoice(file)` → `InvoiceImportResultDTO`; `confirmImportedInvoice(id, payload)`
  - Alertas: `getInvoiceAlerts()` → `InvoiceAlertsDTO`
  - Sugestão: `suggestLineClassification(supplierId, description?)` → `SuggestClassificationResult | null`

## Adapters

### Entrada (UI)

- **`InvoicesView`** — página `/financial/invoices`:
  - **Toggle Tabela / Calendário** — segmented control no header para alternar entre as duas vistas.
  - **Vista Tabela**:
    - Tabs com badge de contagem: *Por pagar*, *Aguardando conciliação*, *Concluídas*, *Todas*.
      - "Por pagar": status `pending | overdue | draft_ai | pending_review | review` **e** `reconciliationStatus !== "pending_reconciliation"`.
      - "Aguardando conciliação": `reconciliationStatus === "pending_reconciliation"`.
      - "Concluídas": status `paid | cancelled` **e** `reconciliationStatus !== "pending_reconciliation"`.
      - "Todas": todas as faturas sem filtro de estado.
      - Mudar de tab preserva todos os filtros ativos; só reseta `page` e seleção de linhas.
    - **Barra de filtros**:
      - Pesquisa (fornecedor/nº fatura).
      - *Todos os estados*: select com `appearance-none` + chevron SVG customizado; filtra por `InvoiceStatus`.
      - *Todas as contas*: select com `appearance-none` + chevron SVG customizado; filtra por `paymentBankAccountId` (contas bancárias cadastradas na conciliação bancária).
      - *Month picker*: botão que abre dropdown com navegação de ano + grelha 3×4 de meses; filtra por `issueDate ?? dueDate ?? paidAt` com `startsWith(YYYY-MM)`.
      - *Filtros*: abre painel lateral (drawer) com filtros avançados — Fornecedor, Intervalo de valor, Classificação (CC padrão do fornecedor), Data de vencimento (De/Até), Débito direto. O botão fica laranja e exibe badge com contagem quando há filtros avançados ativos.
    - **Colunas**: Checkbox | Fatura (`invoiceNumber` + `issueDate` abaixo) | Fornecedor | Vencimento (data + urgência: "Em atraso" vermelho / "Hoje" laranja / "N dias" âmbar) | Classificação (CC padrão do fornecedor: `● CODE — Name`) | Valor total | Ações.
      - **Coluna Estado** (badges `StatusBadge` + `ReconciliationBadge`): visível **apenas** na tab "Todas".
      - **Badge DD**: aparece junto ao `invoiceNumber` para faturas com `isDirectDebit=true` (roxo, texto "DD").
      - **Coluna Classificação**: mostra o `code` e `name` da categoria de CC padrão do fornecedor (derivado de `supplier.defaultCostCenterCategoryId` → `categoryById`); `—` se não configurado.
    - **Ações por linha**: kebab menu ("...") via `createPortal` em `document.body` com posicionamento `fixed` (escapa do contexto `overflow-x-auto` da tabela). Overlay transparente fecha o menu ao clicar fora.
    - **Paginação client-side**: 10 linhas por página; mostra "Mostrando X a Y de Z faturas"; botões Anterior/Próxima.
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

- **`InvoiceDetailDrawer`** — drawer de detalhe com dois tabs: **Detalhes** e **Linhas**.
  - *Header*: fornecedor, nº fatura, data de emissão, data de vencimento, data de pagamento, notas — sempre visíveis.
  - *Detalhes* — layout masonry de 2 colunas; os cards são distribuídos esquerda→direita por ordem fixa:
    1. **Totais da fatura** (sempre) — subtotal s/IVA, IVA, total.
    2. **Classificação** (sempre) — badge *única/mista/nenhuma*; editor inline de CC + subcategoria; "Editar nas Linhas →" para modo misto.
    3. **Pagamento** (quando paga) — Pago em / Método / Conta; botões "Editar pagamento" (abre `MarkPaidModal` pré-preenchido) e "Desfazer pagamento" (abre `UndoPaidConfirmModal` → `setInvoiceStatus("pending")`).
    4. **Conta a Pagar associada** (quando existe) — Vencimento / Pago em / Valor; link para `/financial/payable-entries`.
    5. **Conciliação bancária** (quando conciliada/parcialmente) — badge de estado; lista de movimentos bancários associados.
    - Card **Informação em falta**: aparece sempre em último; lista os cards opcionais ausentes (sem pagamento, sem conta a pagar, sem conciliação).
    - **Impacto financeiro**: barra no rodapé — `DRE: Sim|Não | Fluxo de Caixa: Sim|Não | Rentabilidade: Sim|Não`.
    - Botão "Marcar como paga" visível apenas para faturas `pending` ou `overdue`.
  - *Linhas* — igual ao comportamento anterior: toggle simples/detalhado, lista editável, painel de comparação de totais.
  - Recebe prop `bankAccounts: { id, label }[]` do pai para resolver o nome da conta de pagamento.

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

**Eager fetch do invoice completo ao abrir o drawer.**
Ao abrir o `InvoiceDetailDrawer`, é feito imediatamente um `getInvoice(id)` para obter o `classificationSummary` calculado a partir das linhas reais. Os dados da listagem têm `classificationSummary` calculado apenas a partir do `costCenterCategoryId` do cabeçalho (sem linhas). O eager fetch sobrepõe esses dados assim que a resposta chega; entretanto o drawer usa os dados da listagem como fallback.

**Linhas carregadas on-demand no tab Linhas.**
As linhas detalhadas são carregadas apenas quando o tab "Linhas" é activado.

**Vista calendário usa `dueDate ?? paidAt` como base temporal.**
O calendário mostra faturas no seu dia de vencimento. Se não houver `dueDate`
(ex: fatura já paga sem prazo definido), usa `paidAt` como fallback. Faturas sem
nenhuma data ficam numa secção separada abaixo do calendário.

**Tabs e filtros calculados client-side.**
As contagens e filtros de estado/conciliação são calculados client-side sobre os
dados já carregados. Evita chamadas adicionais à API. Os filtros persistem entre
tabs — só `page` e seleção de linhas são resetados ao mudar de tab.

**Kebab menu via createPortal.**
O menu de ações ("...") de cada linha é renderizado em `document.body` via
`createPortal` com posicionamento `fixed` calculado por `getBoundingClientRect()`.
Resolve o problema de clipping causado pelo `overflow-x-auto` da tabela.

**Coluna Classificação derivada do CC padrão do fornecedor, não da fatura.**
A coluna mostra `supplier.defaultCostCenterCategoryId` resolvido via `categoryById`
(mapa de categorias já carregado). É informativa — serve de referência visual para
o manager saber se a classificação esperada está configurada.

**`ClassifyPanel` inline por linha (sem modal separado).**
A classificação é frequente. Ter o painel directamente visível elimina um nível
de navegação e torna o fluxo mais rápido.

**Toggle de modo de linhas destrói sem pedir confirmação (detailed → simple).**
Ao voltar para modo simples, o backend apaga todas as linhas. Não é apresentado
nenhum diálogo de confirmação — o utilizador pode voltar a detailed e recomeçar
o detalhamento sem perder os dados do cabeçalho da fatura. Esta opção evita
fricção desnecessária: linhas de uma sessão de detalhamento a meio não têm valor
enquanto os totais não fecharem.

**Painel de comparação de totais calculado client-side.**
Em modo detailed, o rodapé do tab Linhas mostra subtotal s/IVA, IVA e total das
linhas calculados sobre o estado local `lines` (não sobre `linesSummary` do DTO).
Isto garante que o painel reflecte imediatamente adições/edições de linhas sem
aguardar um refetch. `linesSummary` do DTO é usado pelo card de Totais no tab Detalhes.
O tab Detalhes mostra "Saldo das linhas" (diferença entre `linesSummary.totalWithVat` e
`invoice.totalWithVat`) em verde se equilibrado (≤ 1 cêntimo) ou vermelho se divergente.

**`EditLineForm` edita tipo e subcategoria de CC inline.**
O formulário de edição de linha faz `updateLine` seguido de `classifyLine` numa
sequência — assim o tipo e a subcategoria ficam persistidos sem precisar de um passo
separado de classificação. O resultado retornado é sempre o da classificação (último).

**Delete de linha com confirmação inline e refreshFullInvoice.**
Ao eliminar uma linha, o drawer faz `api.deleteLine` e refaz `api.getInvoice` para
actualizar o `linesSummary` e o `classificationSummary` no cabeçalho. O mesmo
`refreshFullInvoice` é chamado após `handleLineUpdated` e `handleLineAdded` — garantindo
que o tab Detalhes fica sempre em sincronia sem forçar um refetch global.

**Edição inline do número de fatura no drawer.**
O nº de fatura no header do `InvoiceDetailDrawer` tem um botão de lápis que activa
um campo de input inline. Gravar chama `api.updateInvoice({ invoiceNumber })` e
notifica o pai via `onInvoiceUpdated`. Erros de duplicado são exibidos inline junto
ao campo.

**Modal de delete mostra aviso de impacto automático.**
`DeleteConfirmModal` inspecciona `invoice.reconciliationStatus` e `invoice.status`
para determinar se há payable ou links de reconciliação associados e avisa o
utilizador do que será feito automaticamente ao confirmar.

**Seletor de loja por linha (`LocationSelect`, ticket 19).**
`AddLineForm`, `EditLineForm`, o line builder do `CreateInvoiceDrawer` e o
`EditableLinesSection` do `ReviewImportedInvoiceDrawer` usam o mesmo
`LocationSelect` (`src/components/LocationSelect.tsx`, módulo `locations`)
com `allowUnset` — nunca escondem a possibilidade de deixar a linha sem loja.
O componente não renderiza nada enquanto a organização tiver 0 ou 1 location,
por isso a Angrybox (uma só loja) não vê qualquer campo novo.

**Alteração de fornecedor no ReviewImportedInvoiceDrawer.**
Quando um fornecedor já está ligado, o `SupplierPanel` passa a mostrar um botão
"Alterar" que activa um select para escolher outro fornecedor do cadastro. Evita
ter de desligar antes de religar manualmente.

**`MarkPaidModal` pré-preenchido ao editar pagamento.**
Ao clicar "Editar pagamento" no card Pagamento, o modal inicializa com os valores actuais da fatura (`paidAt`, `paymentBankAccountId`, `paymentMethod`, `paymentNotes`). O mesmo modal serve para registar e editar pagamentos — o título muda consoante `invoice.status === "paid"`.

**`UndoPaidConfirmModal` inline no drawer.**
O modal de confirmação de "Desfazer pagamento" é renderizado dentro do `createPortal` do drawer (z-60, acima do drawer z-50). Ao confirmar, chama `api.setInvoiceStatus(id, "pending")` e notifica o pai via `onInvoiceUpdated`.

**Identidade visual consistente com o grupo financeiro.**
Bordas `border-[#F5C992]/40`, fundo `#FAF6F3`, gradiente `from-[#ED5C32] to-[#EF8935]`.
Selects com `appearance-none` + chevron SVG customizado para uniformidade visual com
outros inputs da app.

## Como testar

- Domínio: não há lógica de domínio no frontend — entidades são apenas interfaces TypeScript.
- Testes de UI: a implementar com Vitest + Testing Library.

## Pontos de atenção / dívidas conhecidas

- Testes de UI não implementados. A lógica de filtragem (tabs, filtros avançados,
  agrupamento do calendário) é candidata a extração para funções puras e testes
  unitários com Vitest.
- Ao fechar e reabrir o `InvoiceDetailDrawer`, as linhas são recarregadas. Considerar
  cache via `useQuery` com `queryKey: ["invoice-lines", id]`.
- `suggestLineClassification` está exposto no port/adapter mas ainda não é chamado
  automaticamente ao abrir o `ClassifyPanel` — candidato a auto-preencher o formulário.
- A regra de classificação guarda apenas uma entrada por fornecedor. Para fornecedores
  mistos (ex: Makro), o último "guardar como regra" sobrescreve o anterior.
