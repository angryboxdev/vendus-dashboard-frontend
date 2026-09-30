# Módulo: financial-base

> Status: ativo
> Última atualização: 2026-09-30

## O que é e para que serve (perspectiva de negócio)

A Angrybox tem custos que vêm de muitos sítios diferentes — fornecedores de
ingredientes, serviços de limpeza, rendas, plataformas de marketing, software. Sem
uma estrutura que organize esses custos, é impossível responder a perguntas simples
como "quanto gastámos em operações este mês?" ou "este custo entra na DRE ou é CAPEX?".

**O problema que resolve:**
Sem centros de custo, todos os gastos caem num balde único — o manager vê o total
mas não percebe onde o dinheiro vai. Sem fornecedores catalogados, cada vez que chega
uma fatura há que voltar a procurar o NIF, o IBAN, as condições de pagamento. Este
módulo cria e mantém essa estrutura base — e mostra o histórico financeiro de cada
fornecedor (total faturado, pago, pendente, lista de faturas).

**O fluxo do ponto de vista do negócio:**

```
Manager (backoffice)
────────────────────────────────────────────────────
1. Seed inicial carrega os 7 grupos, 28+ subcategorias e 7 canais padrão
   (ou manager cria manualmente novos grupos/subcategorias)
2. Cada subcategoria tem regras financeiras:
   afeta DRE? afeta fluxo de caixa? afeta rentabilidade?
   requer canal? (ex: MKT.05 — Anúncios por Marketplace obriga
   a indicar a plataforma: Uber Eats, Glovo, Bolt…)
3. Manager cria fornecedores com grupo+subcategoria por defeito
   (ex: Makro → OPD / CMV / Ingredientes)
4. À medida que entram faturas, o sistema usa a classificação
   do fornecedor para sugerir o centro de custo
5. Quando a subcategoria exige canal, o selector aparece no
   formulário de classificação e é obrigatório antes de guardar
6. Na tab "Análise", o manager vê quanto foi gasto por
   subcategoria, cruzando as linhas de fatura classificadas
7. Na listagem de fornecedores, o manager vê KPIs globais
   (ativos, inativos, com pendentes, total faturado) e por
   fornecedor (faturado, pendente, nº faturas)
8. No detalhe do fornecedor, o manager vê o resumo financeiro
   completo e o histórico de faturas desse fornecedor
9. Quando necessário, o manager exporta um extrato PDF para
   enviar ao fornecedor — pode filtrar por período ou exportar
   o histórico completo
```

**Conceitos-chave para o negócio:**

- **Grupo de Centro de Custo** — agrupamento gerencial de alto nível.
  Exemplos: "OPD" (Operação Direta), "PES" (Pessoal), "FDR" (Fora da DRE).
  São 7 grupos fixos no MVP, mas podem ser criados manualmente.
- **Subcategoria** — classificação específica dentro de um grupo.
  Exemplos: "OPD.01 — CMV / Ingredientes", "EST.01 — Renda / Aluguel".
  Cada subcategoria tem tipo financeiro e flags de impacto (DRE, cashflow, rentabilidade).
- **Tipo financeiro** — natureza da despesa: `cmv`, `variable_cost`, `fixed_opex`,
  `personnel`, `administrative`, `marketing`, `financial`, `capex`, `fiscal`,
  `off_dre`, `internal_transfer`, `transitory`.
- **Fornecedor** — entidade externa que emite faturas. Tem grupo e subcategoria por
  defeito para acelerar a classificação automática de novas faturas. O detalhe inclui
  resumo financeiro (totalBilled, totalPaid, totalPending), lista de faturas emitidas
  e exportação de extrato PDF com filtro de período opcional.
- **SupplierStats** — agregados financeiros por fornecedor calculados no backend
  a partir da tabela `invoices`: invoiceCount, totalBilled, totalPaid, totalPending,
  lastInvoiceDate, lastPaymentDate. Excluem faturas com status `cancelled`, `draft_ai`,
  `pending_review`.

---

## Propósito técnico

Gere a UI de master data financeiros: **grupos de centros de custo**, **subcategorias**
com regras financeiras e **fornecedores**. É a base visual de que os módulos `invoices`
e `payable-entries` dependem para classificação e sugestão automática.

NÃO é responsável por mostrar faturas globais, calcular totais financeiros globais,
nem gerir contas a pagar — esses módulos existem separadamente. A vista de detalhe
do fornecedor mostra as suas faturas, mas só lê — não gere o ciclo de vida das faturas.

## Conceitos do domínio

- **CostCenterGroup** — grupo principal com `id`, `code` (único, maiúsculas), `name`,
  `description`, `sortOrder`, `isActive`.
- **CostCenterCategory** — subcategoria com `groupId`, `code` (único), `name`,
  `financialType` e cinco flags booleanas: `affectsDre`, `affectsCashflow`,
  `affectsProfitability`, `requiresChannel`, `requiresAllocation`.
- **FinancialType** — union de 12 valores com labels (`FINANCIAL_TYPE_LABELS`) e cores
  de badge (`FINANCIAL_TYPE_COLORS`) definidos em `cost-center.ts`.
- **Supplier** — fornecedor com dados de contacto (NIF, email, telefone, morada, IBAN),
  `paymentTermsDays`, `defaultCostCenterGroupId` e `defaultCostCenterCategoryId`.
- **SupplierStats** — agregados financeiros: `invoiceCount`, `totalBilled`, `totalPaid`,
  `totalPending`, `lastInvoiceDate`, `lastPaymentDate`.
- **SupplierWithStats** — `Supplier` + `stats: SupplierStats`. Retornado por
  `listSuppliersWithStats()` (query param `includeStats=true`).
- **SupplierInvoiceRow** — linha de fatura simplificada: `id`, `invoiceNumber`,
  `invoiceDate`, `dueDate`, `totalWithoutVat`, `vatAmount`, `totalWithVat`, `status`, `paidAt`, `attachmentUrl`.
- **SupplierDetail** — `Supplier` + `stats: SupplierStats` + `invoices: SupplierInvoiceRow[]`.
  Retornado por `getSupplierDetail(id)`.
- **SuppliersKpis** — KPIs globais da listagem: `totalActive`, `totalInactive`,
  `totalWithPending`, `totalBilledAll`. Calculados no frontend a partir de
  `listSuppliersWithStats()` (sem chamada extra ao backend).
- **SeedResult** — resultado do seed: `groupsCreated`, `categoriesCreated`, `groupsSkipped`,
  `categoriesSkipped` (retornado por `seedDefaultCostCenters()`).
- **ChannelDTO** — canal de venda/distribuição com `id`, `code`, `name`, `isActive`.
  Usado na classificação de linhas de fatura que requerem canal (ex: Uber Eats, Glovo, SALON).
- **SupplierDeliveryScheduleDTO** (módulo Stock — Planeamento, D10) — calendário de
  entrega deste fornecedor numa loja: `weekdays` (ISO 1=segunda…7=domingo, `null`/`[]`
  = sem calendário), `cutoffTime`, `active`. Puramente informativo — nunca um
  compromisso contratual, só alimenta a projeção de "próxima janela de entrega" do
  módulo `stock-planning`. Uma linha por par fornecedor×loja.

## Ports

### Saída (dependências do domínio)

`FinancialBaseApiPort` — todas as chamadas HTTP ao backend:

**Grupos**
- `listCostCenterGroups(params?)` — lista com filtro `isActive?`
- `getCostCenterGroup(id)` — detalhe
- `createCostCenterGroup(payload)` — criar
- `updateCostCenterGroup(id, payload)` — actualizar
- `setCostCenterGroupStatus(id, isActive)` — activar/desactivar

**Subcategorias**
- `listCostCenterCategories(params?)` — lista com filtros `groupId?`, `isActive?`
- `getCostCenterCategory(id)` — detalhe
- `createCostCenterCategory(payload)` — criar
- `updateCostCenterCategory(id, payload)` — actualizar
- `setCostCenterCategoryStatus(id, isActive)` — activar/desactivar
- `seedDefaultCostCenters()` — popula 7 grupos + 28 subcategorias padrão (idempotente)

**Fornecedores**
- `listSuppliers(params?)` — lista básica com filtros `status?`, `search?`
- `listSuppliersWithStats(params?)` — lista com agregados financeiros por fornecedor;
  chama `GET /api/financial-base/suppliers?includeStats=true`
- `getSupplier(id)` — detalhe básico
- `getSupplierDetail(id)` — detalhe completo: dados base + stats + lista de faturas;
  chama `GET /api/financial-base/suppliers/:id/detail`
- `downloadSupplierStatement(id, params?)` — gera e descarrega um PDF do extrato do fornecedor;
  chama `GET /api/financial-base/suppliers/:id/statement-pdf?startDate=&endDate=`
- `createSupplier(payload)` — criar
- `updateSupplier(id, payload)` — actualizar
- `setSupplierStatus(id, status)` — activar/desactivar

**Canais**
- `listChannels()` — lista todos os canais (SALON, TAKEAWAY, UBER_EATS, GLOVO, etc.)

**Calendário de entrega (D10)**
- `listSupplierDeliverySchedules(supplierId)` — calendário deste fornecedor em todas
  as lojas; chama `GET /api/financial-base/suppliers/:id/delivery-schedule`
- `upsertSupplierDeliverySchedule(supplierId, payload)` — cria/actualiza o calendário
  de um par fornecedor×loja; chama `PUT /api/financial-base/suppliers/:id/delivery-schedule`

## Adapters

### Entrada (UI)

- **`CostCentersView`** — página `/financial/cost-centers` com 3 tabs:
  - *Tab 1 — Grupos*: tabela de `CostCenterGroup` com código, nome, descrição,
    `sortOrder` e toggle de estado. Drawer lateral para criar/editar.
  - *Tab 2 — Subcategorias*: tabela de `CostCenterCategory` com filtro por grupo,
    badge de `financialType`, flags DRE/cashflow/rentabilidade e toggle de estado.
    Drawer lateral para criar/editar — ganhou o flag "IVA dedutível"
    (módulo `accounting`, default ligado) no mesmo `FLAGS` array dos
    outros flags de impacto; decisão sempre manual do gestor, nunca
    inferida automaticamente.
  - *Tab 3 — Análise*: tabela de analytics por subcategoria cruzando linhas de fatura
    classificadas com `costCenterCategoryId`. Dados vindos do módulo `invoices` via
    `useInvoicesModule()`. Rows expandíveis mostram o detalhe das linhas individuais.

- **`SuppliersView`** — página `/financial/suppliers`:
  - 4 KPI cards globais (Fornecedores ativos, Inativos, Com faturas pendentes,
    Total faturado) computados client-side a partir de `listSuppliersWithStats()`.
  - Tabs Todos / Ativos / Inativos com contador.
  - Filtros adicionais: pesquisa por nome/NIF/email, CC padrão (por grupo),
    Prazo de pagamento (com / sem).
  - Tabela com colunas financeiras: Total faturado, Total pendente (laranja se > 0),
    Faturas. Paginação client-side (10 por página).
  - Ações por linha: olho (navega para detalhe), editar (abre drawer), toggle de estado.
  - Drawer lateral para criar/editar fornecedor (inclui seleção de grupo e subcategoria
    por defeito, IBAN, prazo de pagamento, notas).

- **`ExportStatementModal`** — modal de exportação de extrato PDF. Campos opcionais de
  `startDate`/`endDate`; ao confirmar chama `downloadSupplierStatement` e força download do PDF.

- **`SupplierDetailView`** — página `/financial/suppliers/:id`:
  - Breadcrumb "← Fornecedores" com link para a listagem.
  - Header (fora das tabs, sempre visível) com avatar de iniciais, nome, badge de
    estado. Botões Exportar (abre `ExportStatementModal`), Editar e Inativar/Reativar.
  - Tab switcher local (botão + render condicional — não existe um componente de
    Tabs partilhado no repo, ver Decisões de design) com 5 tabs:
    - **Dados gerais** — conteúdo histórico da página, inalterado: 4 KPI cards
      (Total faturado, Total pago, Total pendente, Faturas) + tabela de faturas à
      esquerda + sidebar à direita (Contacto, Classificação e definições, Observações).
    - **Planeamento de stock** (NOVO, módulo Stock — Planeamento D10) —
      `SupplierPlanningTab`: calendário de entrega por loja (checkboxes de dia da
      semana + hora limite + "próximas oportunidades de fornecimento" calculadas
      client-side) com botão próprio "Guardar alterações"; sidebar com resumo dos
      stats já carregados, evolução do valor faturado por mês (gráfico `recharts`)
      e faturas recentes. Ver gaps documentados abaixo.
    - **Histórico de compras** (NOVO) — reaproveita o mesmo componente de tabela de
      faturas da tab "Dados gerais" (`SupplierInvoicesSection`, extraído para não
      duplicar markup).
    - **Itens associados** (NOVO) — `SupplierAssociatedItemsTab`: cruza com o
      módulo `stock-planning` (`listItems({ supplierId })`) para mostrar os itens de
      stock cujo fornecedor de referência é este. Instancia o seu próprio
      `StockPlanningProvider` local (ver Decisões de design).
    - **Contactos e notas** (NOVO) — reaproveita os blocos "Contacto" e
      "Observações" da tab "Dados gerais" (`SupplierContactAndNotes`).
  - *Nota*: os blocos "Faturas"/"Contacto"/"Observações" aparecem tanto em "Dados
    gerais" (como sempre estiveram) como nas suas tabs dedicadas — nunca foram
    removidos de "Dados gerais", só ficaram também acessíveis diretamente.

### Saída

- `HttpFinancialBaseApiAdapter` — implementa `FinancialBaseApiPort` usando
  `apiGet`, `apiGetBlob`, `apiPost`, `apiPatch` de `src/lib/api.ts`.
  - `listSuppliersWithStats` → `GET /api/financial-base/suppliers?includeStats=true`
  - `getSupplierDetail` → `GET /api/financial-base/suppliers/:id/detail`
  - `downloadSupplierStatement` → `GET /api/financial-base/suppliers/:id/statement-pdf`; recebe blob e dispara download do browser
  - `listSupplierDeliverySchedules` / `upsertSupplierDeliverySchedule` → `GET`/`PUT /api/financial-base/suppliers/:id/delivery-schedule` (usa `apiPut`, novo import neste adaptador)

## Rotas

```
/financial/cost-centers          → CostCentersView
/financial/suppliers             → SuppliersView
/financial/suppliers/:id         → SupplierDetailView
/financial/invoices              → InvoicesView  (módulo invoices)
/financial/payable-entries       → PayableEntriesView  (módulo payable-entries)
/financial/bank-statements/...   → BankAccountsView / BankAccountCalendarView / MonthDetailView
```

Todas as rotas `/financial/*` estão envolvidas por `FinancialBaseProvider` e
`InvoicesProvider` no `App.tsx`.

## Decisões de design (ADR resumido)

**Hierarquia Grupo + Subcategoria em vez de CostCenter plano.**
A estrutura anterior tinha um `CostCenter` com `category` enum e `subcategory` texto livre.
O novo modelo usa duas entidades separadas, alinhado com o backend redesenhado em Junho 2026.
Permite filtrar analytics por `financialType` e flags (`affectsDre`, etc.) em vez de inferir
comportamento de um enum de categoria.

**KPIs da listagem calculados client-side, sem endpoint separado.**
O backend expõe `GET /api/financial-base/suppliers/kpis` mas o frontend não o usa.
`listSuppliersWithStats()` já traz todos os dados necessários (stats por fornecedor);
os KPIs globais são derivados client-side com `useMemo`. Evita um pedido extra em cada
carregamento da página.

**Filtragem e paginação de fornecedores client-side.**
A `SuppliersView` faz um único `GET suppliers?includeStats=true` e filtra localmente.
Aceitável para o volume actual da Angrybox. Se a lista crescer além de ~500 fornecedores,
os filtros devem ser delegados ao backend (query params `status`, `search`).

**Tab 3 (Análise) usa dados do módulo `invoices` via `useInvoicesModule()`.**
Os totais por subcategoria vêm de `listInvoiceLines()` (endpoint `GET /api/invoices/lines`),
cruzado com `cost_center_category_id`. Para aceder sem duplicar a query, o `InvoicesProvider`
envolve toda a rota `/financial/*` no `App.tsx`. Qualquer vista dentro do grupo financeiro
pode usar `useInvoicesModule()`.

**`FinancialBaseProvider` e `InvoicesProvider` são co-dependentes.**
A Tab 3 de `CostCentersView` precisa de ambos os módulos. A solução é o `InvoicesProvider`
envolver o `FinancialBaseProvider` no `App.tsx`, em vez de estar apenas na rota `/financial/invoices`.

**`FINANCIAL_TYPE_LABELS` e `FINANCIAL_TYPE_COLORS` definidos no domínio.**
São constantes de apresentação (labels PT e classes Tailwind), mas pertencem ao domínio
porque expressam semântica de negócio (o que é CMV, CAPEX, etc.). Componentes importam-nos
directamente — evita props drilling e mantém a consistência visual em todos os sítios onde
um `financialType` é exibido.

**`SupplierAssociatedItemsTab` instancia o seu próprio `StockPlanningProvider`.**
A árvore de rotas `/financial/*` não monta o módulo `stock-planning` (só
`/stock/planeamento/*` o faz). Em vez de acoplar `App.tsx` a mais um provider só
para uma tab, a tab instancia localmente `<StockPlanningProvider>` em volta do seu
próprio conteúdo — acoplamento explícito e contido a um único ficheiro
(`SupplierAssociatedItemsTab.tsx`), sem alterar a composição global de rotas.

**"Evolução do valor faturado" em vez de "Evolução de preços"/"Categorias mais
compradas" (tab Planeamento de stock).** O mockup de referência mostra um
gráfico de evolução de preço unitário e uma repartição por categoria mais
comprada. `SupplierInvoiceRow` (retornado por `getSupplierDetail`) só tem
totais ao nível do documento — sem preço por linha/produto nem categoria por
linha de fatura. Inventar essas séries seria fabricar dados. A tab mostra por
isso a evolução real e honesta que os dados suportam — valor total faturado por
mês, agregando `supplier.invoices` já carregado — e omite "Categorias mais
compradas" com uma nota explícita em vez de um gráfico vazio ou inventado.

## Como testar

- Domínio: não há lógica de domínio no frontend — entidades são interfaces TypeScript.
- Testes de UI: a implementar com Vitest + Testing Library.

## Pontos de atenção / dívidas conhecidas

- **Botão "Editar fornecedor" no detalhe** — navega para `/financial/suppliers` com
  `state: { editId }`, mas `SuppliersView` não lê esse estado para abrir o drawer
  automaticamente. O drawer de edição não é acionado a partir do detalhe.
- **Tabs "Pagamentos" e "Regras" no detalhe** — placeholder "em breve". Pagamentos
  precisará de integração com `payable-entries`; Regras de classificação estão a aguardar
  definição de requisitos.
- **Filtragem client-side** — aceitável para o volume actual; para listas grandes (>500)
  delegar filtros ao backend.
- **Tab 3 (Análise) sem paginação** — `listInvoiceLines()` traz todas as linhas; adicionar
  filtros de data se o volume crescer.
- **Testes de UI não implementados** — `SuppliersView` e `SupplierDetailView` sem cobertura
  de testes.
- **Tab "Planeamento de stock" — "Categorias mais compradas" não implementada.**
  Sem dado de categoria por linha de fatura nesta API; ver Decisões de design.
- **Tab "Itens associados" só lista pelo `supplierId` de referência do item.**
  Não é um histórico de "o que já foi comprado a este fornecedor" — é "que itens de
  stock têm este fornecedor configurado como sugestão de compra" no módulo
  `stock-planning`. Requer seleção de loja (o endpoint de itens é sempre por loja).
