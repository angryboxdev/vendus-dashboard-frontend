# Módulo: financial-base

> Status: ativo
> Última atualização: 2026-10-18 (v1.2 · F2: ficha do fornecedor com «Enviar para Stock», modo financeiro preferido, destino habitual e exceções por loja; «Aplicação em Faturas» com repartições «Por valores»)

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
- `getSupplierDetail(id)` — detalhe completo: dados base + stats + lista de faturas +
  `topItems` (artigos principais; opcional no tipo para tolerar um backend anterior);
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
  - *Tab 3 — Aplicação em Faturas*: despesa **líquida sem IVA** por subcategoria, somando
    as linhas de faturas «Por artigo» (`listInvoiceLines()`, que o servidor já limita a
    esse modo) e as repartições de faturas «Por valores» (`listInvoiceAllocations()`),
    via `domain/services/cost-center-application.ts`. Notas de crédito subtraem. Rows
    expandíveis mostram as faturas com a origem («Por artigo» / «Por valores»). Faturas
    «Única» não entram (lacuna anterior, igual à do backend).

- **`SuppliersView`** — página `/financial/suppliers`:
  - 4 KPI cards globais (Fornecedores ativos, Inativos, Com faturas pendentes,
    Total faturado) computados client-side a partir de `listSuppliersWithStats()`.
  - Seletor de estado (lista no início dos filtros): **Ativos por omissão**, Inativos, Todos
    (sem contadores — o card «Fornecedores ativos» já os mostra). O «Limpar filtros» não mexe
    no estado.
  - O card «Com faturas pendentes» é clicável: abre `/financial/invoices?pendentes=1`
    (separador «Por pagar», sem filtro de mês — ver `InvoicesView`).
  - Filtro adicional: pesquisa por nome/NIF/email (os filtros de CC padrão e Prazo
    foram retirados — essa informação vê-se nas colunas).
  - Tabela com colunas financeiras: Total faturado, Total pendente (laranja se > 0),
    Faturas. Paginação client-side (10 por página).
  - Botão «Colunas»: caixas de seleção para mostrar/esconder cada coluna (razão social,
    NIF, contacto, CC padrão, faturas, totais, última fatura, prazo, estado); fica sempre
    pelo menos uma. Preferência guardada por browser em `localStorage` (`suppliers.hiddenColumns`).
    Clicar em qualquer ponto da linha abre a ficha (o nome pode estar escondido).
  - Ordenação client-side ao clicar no cabeçalho de qualquer coluna (sobre a lista filtrada,
    antes da paginação): texto A→Z, valores e datas do maior/mais recente no 1.º clique;
    2.º inverte; 3.º volta à ordem original. Vazios ficam sempre no fim.
  - Ações por linha: olho (navega para detalhe), editar (abre drawer), toggle de estado.
  - Drawer lateral para criar/editar fornecedor (inclui seleção de grupo e subcategoria
    por defeito, IBAN, prazo de pagamento, notas). F2: política «Enviar para Stock»
    (seguir a subcategoria / enviar por defeito / não enviar / decidir no documento),
    modo financeiro preferido («Única | Por artigo | Por valores»), destino habitual
    (uma loja) e `SupplierLocationRulesPanel` — exceções por loja, só com mais de uma
    loja ativa; prevalecem sobre a regra geral para essa loja.

- **`ExportStatementModal`** — modal de exportação de extrato PDF. Campos opcionais de
  `startDate`/`endDate`; ao confirmar chama `downloadSupplierStatement` e força download do PDF.

- **`SupplierDetailView`** — página `/financial/suppliers/:id`, no Design System Mezza
  (kit `components/ui`), segundo o mockup do utilizador (2026-10-25):
  - Breadcrumb «Financeiro › Fornecedores › nome».
  - Header com logótipo ou iniciais, nome, estado e linha «Fornecedor | NIF | Cliente
    desde AAAA» (ano mais antigo entre a criação da ficha e o primeiro documento).
    Ações: Editar fornecedor, menu ⋮ (Exportar extrato → `ExportStatementModal`) e
    Inativar/Reativar.
  - `Tabs` do kit com 5 separadores:
    - **Visão geral** — faixa de KPIs (Compras líquidas = `totalBilled`, já líquido de
      notas de crédito; Liquidado; Saldo em aberto, com % do total); cartões
      Identificação e Condições comerciais (lápis abre o drawer; só campos que existem
      na ficha — prazo, IBAN, moeda, envio para stock, modo financeiro, loja habitual,
      último pagamento); «Resumo de atividade» — gráfico de linha (`recharts`, sem
      animação) só com as compras por mês do ano escolhido, calculado das faturas
      não anuladas; «Últimos documentos» (5 mais recentes, clique abre a fatura) e
      «Artigos principais» (`topItems` do detalhe; preço = unitário sem IVA da última compra).
    - **Documentos (N)** — tabela completa de documentos (`SupplierInvoicesSection`).
    - **Abastecimento** (antes «Planeamento de stock»; mockup do utilizador, 2026-10-25) —
      `SupplierSupplyTab`: KPIs (próxima entrega, prazo de pagamento, lead time,
      encomenda mínima); «Calendário de fornecimento» por loja (loja habitual por
      omissão) com dias de entrega, hora limite geral, ativo e regras por dia
      («Pedido até» + observação), só editável depois de «Editar calendário»;
      «Próximas oportunidades» (4 mais próximas no período escolhido, prazo de
      encomenda ainda por passar; lógica pura em `domain/services/supply-calendar.ts`);
      «Necessidades de reposição» (`stock-planning` → `listSupplierReplenishment`;
      filtro «só com necessidade»; ⋯ → Ver no planeamento); por baixo, «Resumo no
      planeamento» (`SupplierPlanningSummary`, `getSupplierPlanningSummary`; mockup do
      utilizador): itens com histórico de compra, compras dos últimos 3 meses, frequência
      de compra, categorias mais compradas (subcategorias financeiras), evolução de preços
      **por artigo** (seletor de artigo + 3/6/12 meses; série em `domain/services/supplier-planning.ts`)
      e itens recentes (iniciais em vez de fotografia — os artigos não têm imagem). Sem encomendas: o
      sistema ainda não as tem (decisão do utilizador). Layout compacto (2026-10-25):
      calendário e oportunidades lado a lado a partir de 1024 px (1,2 : 1), cada um
      só com a altura que precisa; oportunidades em lista de ~57 px por linha; a
      reposição começa a ~720 px do topo do conteúdo em 1366/1440/1920 (verificado
      no harness, sem scroll horizontal nem cortes, incluindo o modo de edição).
    - **Artigos associados** — `SupplierAssociatedItemsTab`: cruza com o
      módulo `stock-planning` (`listItems({ supplierId })`) para mostrar os itens de
      stock cujo fornecedor de referência é este. Instancia o seu próprio
      `StockPlanningProvider` local (ver Decisões de design).
    - **Contactos e notas** — blocos «Contacto» e «Observações» (`SupplierContactAndNotes`).

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
Os totais por subcategoria vêm de `listInvoiceLines()` (endpoint `GET /api/invoices/lines`)
e, desde a F2, de `listInvoiceAllocations()` (`GET /api/invoices/allocations`), cruzados com
`cost_center_category_id`. Desde a F2 conta-se o **líquido** (total c/ IVA − IVA da linha,
já com descontos) em vez de `preço unitário × quantidade` (bruto antes de descontos) —
necessário para somar com as repartições, que são líquidas; os totais de linhas com
desconto descem em conformidade. Para aceder sem duplicar a query, o `InvoicesProvider`
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

**Abastecimento: regras por dia em vez de uma hora limite única.** Cada dia de
entrega pode ter o seu dia/hora de pedido e uma observação (`dayRules`); sem regra,
encomenda-se na véspera à hora limite geral. O lead time e as próximas
oportunidades derivam destas regras (nada é guardado à parte).

## Como testar

- Domínio: `npx vitest run src/modules/financial-base` — `cost-center-application.test.ts`
  (líquido com descontos, linhas + repartições, nota de crédito) e
  `supply-calendar.test.ts` (regras por dia, lead time, próximas oportunidades).
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
- **Abastecimento — stock atual e consumo são da organização**, não da loja
  escolhida (como no ecrã de Planeamento); só a sugestão depende da loja.
- **Tab "Itens associados" só lista pelo `supplierId` de referência do item.**
  Não é um histórico de "o que já foi comprado a este fornecedor" — é "que itens de
  stock têm este fornecedor configurado como sugestão de compra" no módulo
  `stock-planning`. Requer seleção de loja (o endpoint de itens é sempre por loja).

## Abastecimento — encomenda em embalagens
- Com embalagem confirmada (Compras por rever), a sugestão mostra embalagens inteiras: «5 sacos — preciso de 12 kg → 12,5 kg» e a coluna da unidade «saco de 2,5 kg»; sem ela, «Embalagem por configurar».
