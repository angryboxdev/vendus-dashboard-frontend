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

- **Plataformas pelos extratos (F3b, 2026-10-28):** cada plataforma da DRE traz `source` (`statements` = extratos importados em «Plataformas de delivery»; `bank` = reconstituída do recebido). Com extratos, as promoções e os reembolsos/outras taxas entram numa linha própria, «Promoções e reembolsos das plataformas», que deduz à receita como as comissões; a dica das vendas diz a origem.
- **Ajustes manuais no Mapa (Menu V1, 2026-10-27)** — Custos Fixos e Custos Variáveis saíram do menu; a linha «Ajustes manuais» da DRE tem ligações para essas páginas (só as que a pessoa pode abrir; `useOptionalAuth`, para funcionar sem sessão nos testes).

- **Só o banco** (decisão do utilizador, 2026-10-26): as vendas do Vendus ficam para a DRE.
- **Nomes dos tipos de movimento** reutilizam `MOVEMENT_KIND_LABELS` do módulo `bank-statements` (o backend devolve só a chave), para coincidirem com a conciliação bancária.
- **Cores do gráfico em HEX** (`cash-flow-format.ts`): o recharts não aceita classes; verde/vermelho só como estados (entradas/saídas), como no kit.
- **Saídas: descida = verde** na variação (`Delta goodWhenDown`).

## Como testar

- `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/cash-flow`

## Para tratar

`ToHandleCard` no topo do painel lateral (`useCashFlowToHandle`, `GetCashFlowToHandlePort`): «A pagar» com o valor em atraso (→ `/financial/payable-entries`) e «N documentos por arrumar» = faturas por rever (→ `/financial/invoices`). Estado atual, não depende do mês. O endpoint exige a permissão de Contas a pagar: com 403 o adapter devolve `null` e o painel não aparece.

## DRE (Mapa)

`DreView` + `useDre` substitui o conteúdo de **Mapa de rentabilidade → Mapa** (`/dre/demonstrativo`). **DRE em cascata** (`composeDreStatement`, `domain/services/dre-statement.ts`): vendas do restaurante (cartão / dinheiro / outros) e das plataformas → receita bruta → (−) comissões das plataformas → (−) comissões do TPA (taxa do mês × vendido em cartão; chega com as vendas do restaurante) → receita líquida → (−) CMV → lucro bruto → (−) custos variáveis → margem de contribuição → (−) pessoal, estrutura, administrativo, marketing (+ marketing das plataformas), outros, outros gastos pelo extrato → resultado operacional → (−) resultado financeiro → **lucro líquido da operação** (antes de amortizações e IRC); depois, o bloco **«Fora da operação — não conta no lucro»** (CAPEX + `expenses.offOperation`: retiradas de sócios, capital de empréstimos, cauções) e o «Saldo depois de investimentos e retiradas». Cada rubrica de gastos do banco tem um botão «Ver pagamentos» (`DrePaymentsDrawer`, `GET /api/reports/dre/pagamentos`, só com «Bancos & conciliação» — `finance.banking`): os pagamentos agrupados pela categoria, com a data do pagamento e a da fatura (competência), o documento e a base do IVA (`groupDreEntries`); as faturas do mês ainda por pagar aparecem como «Por pagar» (`paidOn = null`) e o total delas no painel «Confiança dos gastos»; CAPEX à parte, fora do resultado; % da receita líquida em cada linha; detalhe abrível (categorias, ou o tipo do extrato quando não há fatura). Gastos só do extrato bancário (sem ajustes manuais — decisão do utilizador, 2026-10-27). IVA do mês e «Confiança dos gastos» no painel lateral.

**Carregamento independente** (`useDre`): dois pedidos em paralelo — os custos do banco (`GET /api/reports/dre/resultado?restaurante=0`, segundos) e as vendas do restaurante (`GET /api/reports/dre/vendas-restaurante`, Vendus, até um minuto na primeira abertura do mês). Cada linha aparece logo que a sua parte chega, por qualquer ordem; subtotais e lucro só com as duas. Avisos: «As vendas do restaurante estão a carregar» (mais demorado na primeira vez do mês) / «Os custos do banco estão a carregar»; erro de uma parte não esconde a outra.

**Parâmetros do mês** (botão no Mapa → `DreParametersDrawer`; `GetDreParametersPort` / `SaveDreParametersPort`, `GET|PUT /api/reports/dre/parametros`): IVA médio do delivery, comissão e IVA da comissão, base da comissão (com/sem IVA), IVA do marketing, taxa do TPA, IVA teórico dos gastos e marketing por plataforma (euros sem IVA → cêntimos com `parseEuroToCents` do `bank-statements`). Mostra se os valores são do mês, herdados ou de omissão. Gravar exige «Mapa» com gestão (ou Admin); sem ela o painel é só de consulta. Gravar invalida o Mapa e a conferência do mês. A conversão do formulário vive em `sales-reconciliation-view.ts` (`toForm` / `fromForm`).

## Conferência de vendas

`SalesReconciliationView` + `useSalesReconciliation` (`GetSalesReconciliationPort`, `GET /api/reports/dre/conferencia-vendas`), página **Financeiro → Conferência de vendas** (`/dre/conferencia-vendas`, menu ao lado do Fluxo de caixa, `pages/dre/ConferenciaVendasPage.tsx`, permissão `dre.statement`): venda restaurante cartão (Vendus) × créditos TPA — vendido, recebido, diferença, taxa implícita vs esperada, cada liquidação com os dias de venda que cobre e o estado (Taxa OK / Verificar / Sem vendas), e o que está por liquidar; venda restaurante dinheiro × depósitos — vendido, depositado, por depositar e cada depósito com o vendido desde o anterior. O cálculo é todo do backend.

## Lacunas conhecidas

- O seletor de período é o legado do Mapa (`DrePeriodSelector`).
