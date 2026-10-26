# Módulo: cash-flow

> Status: ativo
> Última atualização: 2026-10-26

## Propósito

Página **Mapa de rentabilidade → Fluxo de caixa** (`/dre/fluxo-caixa`), só a partir do banco: resultado do mês (entradas − saídas de todas as contas), gráfico acumulado com o período anterior a tracejado, % das saídas justificada, entradas por tipo e despesas por categoria (as 3 maiores + «Ver mais»; cada grupo abre o detalhe por categoria). Não calcula nada de negócio: o backend (módulo `cash-flow`, `GET /api/reports/dre/fluxo-caixa`) categoriza as saídas e faz os totais. O período vem do seletor do Mapa (`DrePeriodContext`, via `pages/dre/FluxoCaixaPage.tsx`).

## Conceitos do domínio

- **CashFlowReport** — contrato do endpoint (cêntimos): `days` / `previousDays`, `totals` / `previousTotals`, `inflowKinds`, `categories` (grupo de centro de custo ou «por classificar» pelo tipo do banco) e `justification`.
- **Comparação** — no mês corrente, com os mesmos dias do mês anterior; num mês fechado, com o mês anterior inteiro (decidido no backend).
- **Regras da vista** (`cash-flow-view.ts`, puras): linhas do gráfico acumuladas e alinhadas pelo dia do mês, variação em %, rótulos «1–16 out.», totais até um dia (tooltip), mês futuro.

## Ports

### Entrada (use cases)

- `GetCashFlowPort` — relatório de um mês.

### Saída (dependências do domínio)

- `CashFlowApiPort` — `getCashFlow(year, month)`.

## Adapters

### Entrada (UI)

- `CashFlowView` + `useCashFlow` (React Query, chave `["cash-flow", ano, mês]`; mês futuro não faz pedido).
- `CashFlowChartCard` (recharts), `CashFlowSidePanel`, `ExpenseCategoriesCard`.

### Saída

- `HttpCashFlowApiAdapter` → `GET /api/reports/dre/fluxo-caixa?year&month`.

## Decisões de design

- **Só o banco** (decisão do utilizador, 2026-10-26): as vendas do Vendus ficam para a DRE.
- **Nomes dos tipos de movimento** reutilizam `MOVEMENT_KIND_LABELS` do módulo `bank-statements` (o backend devolve só a chave), para coincidirem com a conciliação bancária.
- **Cores do gráfico em HEX** (`cash-flow-format.ts`): o recharts não aceita classes; verde/vermelho só como estados (entradas/saídas), como no kit.
- **Saídas: descida = verde** na variação (`Delta goodWhenDown`).

## Como testar

- `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/cash-flow`

## Lacunas conhecidas

- Painel «Para tratar» (a pagar / em atraso, documentos por arrumar) fica para a F3.
- O seletor de período é o legado do Mapa (`DrePeriodSelector`).
