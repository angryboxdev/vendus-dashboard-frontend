# Módulo: cash-flow

> Status: ativo
> Última atualização: 2026-10-27 (conferência de vendas; parâmetros do mês no Mapa; DRE com delivery em bruto)

## Propósito

Página **Mapa de rentabilidade → Fluxo de caixa** (`/dre/fluxo-caixa`), só a partir do banco: resultado do mês (entradas − saídas de todas as contas), gráfico acumulado com o período anterior a tracejado, % das saídas justificada, entradas por tipo e despesas por categoria (as 3 maiores + «Ver mais»; cada grupo abre o detalhe por categoria). Não calcula nada de negócio: o backend (módulo `cash-flow`, `GET /api/reports/dre/fluxo-caixa`) categoriza as saídas e faz os totais. O período vem do seletor do Mapa (`DrePeriodContext`, via `pages/dre/FluxoCaixaPage.tsx`).

## Conceitos do domínio

- **CashFlowReport** — contrato do endpoint (cêntimos): `days` / `previousDays`, `totals` / `previousTotals`, `inflowKinds`, `categories` (grupo de centro de custo ou «por classificar» pelo tipo do banco) e `justification`.
- **Comparação** — no mês corrente, com os mesmos dias do mês anterior; num mês fechado, com o mês anterior inteiro (decidido no backend).
- **Regras da vista** (`cash-flow-view.ts`, puras): linhas do gráfico acumuladas e alinhadas pelo dia do mês, variação em %, rótulos «1–16 out.», totais até um dia (tooltip), mês futuro.

## Ports

### Entrada (use cases)

- `GetCashFlowPort` — relatório de um mês.
- `GetDrePort`, `GetSalesReconciliationPort`, `GetDreParametersPort` / `SaveDreParametersPort` — DRE, conferência de vendas e parâmetros do mês.

### Saída (dependências do domínio)

- `CashFlowApiPort` — `getCashFlow`, `getToHandle`, `getDre`, `getSalesReconciliation`, `getDreParameters`, `saveDreParameters`.

## Adapters

### Entrada (UI)

- `CashFlowView` + `useCashFlow` (React Query, chave `["cash-flow", ano, mês]`; mês futuro não faz pedido).
- `CashFlowChartCard` (recharts), `CashFlowSidePanel`, `ExpenseCategoriesCard`.

### Saída

- `HttpCashFlowApiAdapter` → `GET /api/reports/dre/fluxo-caixa`, `/resultado`, `/conferencia-vendas`, `GET|PUT /parametros` (sempre `?year&month`) e `/fluxo-caixa/para-tratar`.

## Decisões de design

- **Só o banco** (decisão do utilizador, 2026-10-26): as vendas do Vendus ficam para a DRE.
- **Nomes dos tipos de movimento** reutilizam `MOVEMENT_KIND_LABELS` do módulo `bank-statements` (o backend devolve só a chave), para coincidirem com a conciliação bancária.
- **Cores do gráfico em HEX** (`cash-flow-format.ts`): o recharts não aceita classes; verde/vermelho só como estados (entradas/saídas), como no kit.
- **Saídas: descida = verde** na variação (`Delta goodWhenDown`).

## Como testar

- `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/cash-flow`

## Para tratar

`ToHandleCard` no topo do painel lateral (`useCashFlowToHandle`, `GetCashFlowToHandlePort`): «A pagar» com o valor em atraso (→ `/financial/payable-entries`) e «N documentos por arrumar» = faturas por rever (→ `/financial/invoices`). Estado atual, não depende do mês. O endpoint exige a permissão de Contas a pagar: com 403 o adapter devolve `null` e o painel não aparece.

## DRE (Mapa)

`DreView` + `useDre` (`GetDrePort`, `GET /api/reports/dre/resultado`) substitui o conteúdo de **Mapa de rentabilidade → Mapa** (`/dre/demonstrativo`, `pages/dre/DemonstrativoPage.tsx` passou a só embrulhar a vista). Tudo sem IVA, calculado no backend a partir da conciliação bancária: resultado e margem; demonstração (receita = restaurante pelo Vendus (cartão / dinheiro / outros) + plataformas em bruto, reconstituídas do recebido no banco pelos parâmetros do mês (sem AirMenu), com o recebido e a margem por plataforma; custos das plataformas (comissões, marketing); gastos por categoria, abríveis, com «IVA por confirmar» / «Por classificar»; ajustes manuais; resultado); IVA do mês (vendas − compras = estimativa a entregar, com a parte estimada); «Confiança dos gastos» (`dreConfidencePct`: gastos com categoria e IVA conhecido) com atalho para a conciliação. As páginas antigas de custos fixos/variáveis continuam para lançar os ajustes manuais.

**Parâmetros do mês** (botão no Mapa → `DreParametersDrawer`; `GetDreParametersPort` / `SaveDreParametersPort`, `GET|PUT /api/reports/dre/parametros`): IVA médio do delivery, comissão e IVA da comissão, base da comissão (com/sem IVA), IVA do marketing, taxa do TPA, IVA teórico dos gastos e marketing por plataforma (euros sem IVA → cêntimos com `parseEuroToCents` do `bank-statements`). Mostra se os valores são do mês, herdados ou de omissão. Gravar exige «Mapa» com gestão (ou Admin); sem ela o painel é só de consulta. Gravar invalida o Mapa e a conferência do mês. A conversão do formulário vive em `sales-reconciliation-view.ts` (`toForm` / `fromForm`).

## Conferência de vendas

`SalesReconciliationView` + `useSalesReconciliation` (`GetSalesReconciliationPort`, `GET /api/reports/dre/conferencia-vendas`), página **Mapa de rentabilidade → Conferência de vendas** (`/dre/conferencia-vendas`, `pages/dre/ConferenciaVendasPage.tsx`, permissão `dre.statement`): venda restaurante cartão (Vendus) × créditos TPA — vendido, recebido, diferença, taxa implícita vs esperada, cada liquidação com os dias de venda que cobre e o estado (Taxa OK / Verificar / Sem vendas), e o que está por liquidar; venda restaurante dinheiro × depósitos — vendido, depositado, por depositar e cada depósito com o vendido desde o anterior. O cálculo é todo do backend.

## Lacunas conhecidas

- O seletor de período é o legado do Mapa (`DrePeriodSelector`).
