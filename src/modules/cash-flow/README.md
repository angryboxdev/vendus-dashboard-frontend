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

`DreView` + `useDre` (`GetDrePort`, `GET /api/reports/dre/resultado`) substitui o conteúdo de **Mapa de rentabilidade → Mapa** (`/dre/demonstrativo`, `pages/dre/DemonstrativoPage.tsx` passou a só embrulhar a vista). Tudo sem IVA, calculado no backend a partir da conciliação bancária: resultado e margem; demonstração (receita = restaurante pelo Vendus + plataformas pelo recebido no banco, com o vendido no AirMenu e as comissões estimadas; gastos por categoria, abríveis, com «IVA por confirmar» / «Por classificar»; ajustes manuais; resultado); IVA do mês (vendas − compras = estimativa a entregar); «Confiança dos gastos» (`dreConfidencePct`: gastos com categoria e IVA conhecido) com atalho para a conciliação. As páginas antigas de custos fixos/variáveis continuam para lançar os ajustes manuais.

## Lacunas conhecidas

- O seletor de período é o legado do Mapa (`DrePeriodSelector`).
