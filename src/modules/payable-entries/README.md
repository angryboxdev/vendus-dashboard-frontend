# Módulo: payable-entries

> Status: ativo
> Última atualização: 2026-06-17

## Propósito

Interface de gestão de contas a pagar: listagem, KPIs, calendário de vencimentos, criação de pagamentos manuais e acções por entrada (marcar pago, cancelar).

Não é responsável por conciliação bancária nem por relatórios financeiros.

## Conceitos do domínio

- **PayableEntryDTO** — representação de uma conta a pagar.
- **PayableSummaryDTO** — KPIs calculados no backend: totalDue, totalOverdue, dueSoon7Days, paidThisMonth (todos em cents).
- **PayableCalendarDayDTO** — entradas agrupadas por data de vencimento (para o mini-calendário lateral).
- Todos os valores monetários em cents; apresentação via `fromCents` com locale pt-PT.

## Ports

### Saída (dependências)

- `PayableEntriesApiPort` — todas as chamadas HTTP ao backend (`/api/payable-entries/*`).

## Adapters

### Entrada (UI)

- `PayableEntriesView` — página principal: KPIs, tabela com filtros, mini-calendário lateral, drawer de criação, drawer de detalhe com ações.

### Saída

- `HttpPayableEntriesApiAdapter` — implementa `PayableEntriesApiPort` via `apiGet/apiPost/apiPatch/apiDeleteNoContent`.

## Decisões de design

**D1 — Sem domain services no frontend.**
O cálculo dos KPIs e o agrupamento por dia são responsabilidade do backend (`GetPayableSummaryPort`, `GetPayableCalendarPort`). O frontend apenas apresenta o que recebe — não recalcula.

**D2 — Mini-calendário filtra sempre o mês corrente.**
O range `from`/`to` é calculado uma vez com `monthRange()` no render da view. É suficiente para a vista operacional diária.

## Como testar

- Domínio: sem lógica de domínio no frontend — não há testes unitários de domínio.
- View: `npx vitest` (ou runner configurado) com fake do `PayableEntriesApiPort`.

## Pontos de atenção / dívidas conhecidas

- Não há paginação na tabela (ok para volumes actuais).
- A view de calendário é um mini-calendário simples (lista por dia); a vista visual de grelha mensal está no plano para sessões futuras.
