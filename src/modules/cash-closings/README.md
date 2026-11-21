# Módulo: cash-closings

> Status: ativo
> Última atualização: 2026-11-21

## Propósito

Gere a UI do fecho de caixa em dois contextos distintos: o kiosk de submissão
(funcionário, sem auth) e o backoffice de revisão (manager, autenticado). NÃO é
responsável pela autenticação nem pela navegação — apenas pelas operações e
vistas do fecho de caixa.

## Conceitos do domínio

- **CashClosing** — interface com todos os campos de um fecho: canais de
  pagamento (tpa, uber, glovo, bolt, eatz, cashSales), gaveta, totais derivados
  (`totalCalculated`, `vendusCalculated`, `airMenuCalculated`), referências de API
  (`vendusTotal`, `airMenuUber/Glovo/Bolt`, `airMenuTotal`) e estado de revisão.
  `vendusCalculated` = TPA + Eatz + dinheiro; `airMenuCalculated` = Uber + Glovo + Bolt;
  `airMenuTotal` = soma dos três totais AirMenu (null se AirMenu indisponível).
- **CashClosingStatus** — `"pending" | "approved" | "rejected"`.
- **closings-summary.ts** — regras puras das diferenças e do agrupamento por dia:
  `vendusDiff` = `vendusCalculated − vendusTotal` (só canal próprio — o Vendus não
  regista Uber/Glovo/Bolt); `airMenuDiff` = `airMenuCalculated − airMenuTotal`;
  `worstStatus`; `groupClosingsByDay` junta os fechos da mesma data num `ClosingDay`
  (somas, nomes, estado pior, última submissão).
  `shortName` (primeiro + último nome) e `sumClosingDays` (totais do período para o
  rodapé; dias sem referência não entram na coluna respetiva).
- **closings-period.ts** — serviço puro de datas: `getMondayOfWeek`,
  `getWeekDays`, `getMonthRange`, helpers de navegação (next/prev semana/mês)
  e formatação (`formatWeekLabel`, `formatMonthLabel`, `formatDayLabel`).

## Ports

### Entrada (use cases)

- `ListClosingsPort` — lista fechos com filtros `from`/`to`/`date`, `status`,
  `employeeId`, paginação. A week view e a month view pedem o período inteiro de
  uma vez (`limit: 200`).
- `ReviewClosingPort` — manager aprova/rejeita e/ou edita valores.

### Saída (dependências do domínio)

- `CashClosingApiPort` — todas as operações HTTP do módulo: `listClosings`,
  `getClosing`, `reviewClosing`, `verifyPin`, `getVendusTotal`, `submitClosing`.
  A operação `getAirMenuTotals` vive em `cashClosingApi.ts` (legado do kiosk)
  por ser usada no contexto de pré-submissão do funcionário.

## Adapters

### Entrada (UI)

- `CashClosingsHubView` — backoffice page com dois modos:
  - **Semana**: 7 cards (Seg–Dom) com resumo por dia. Click num card abre
    `DayDrawer` (múltiplos fechos) ou `ClosingDetailModal` directamente (1 fecho).
  - **Mês**: tabela com **um dia por linha** (`groupClosingsByDay`); dias com vários
    fechos mostram a etiqueta «N fechos» e abrem o `DayDrawer`; um só fecho abre o
    `ClosingDetailModal`. Colunas Total, Vendus, Dif. Vendus, Dif. AirMenu, Sangria.
    Cada linha cabe numa só linha (`whitespace-nowrap`, scroll horizontal em ecrãs
    estreitos); o funcionário aparece com o primeiro e o último nome (nome completo no
    `title`); rodapé com o total de cada coluna.
- `ClosingDetailModal` — painel lateral partilhado pelos dois modos; permite
  aprovar/rejeitar e editar valores. Exibe os campos em três secções:
  **Canal Próprio** (TPA, Eatz, dinheiro → subtotal declarado, Total Vendus, Diferença),
  **Canais Externos** (Uber, Glovo, Bolt com referência AirMenu por plataforma →
  subtotal declarado, Total AirMenu, Diferença AirMenu) e
  **Movimentos de Caixa** (entradas/saídas/gaveta/diferença de gaveta/sangria).
- `StatusBadge` — componente exportado para reutilização.

### Saída

- `HttpCashClosingApiAdapter` — implementa `CashClosingApiPort` usando `apiGet`,
  `apiPatch` (autenticados) e `fetch` directo para as rotas públicas do kiosk.

## Decisões de design (ADR resumido)

**Dois modos de visualização no mesmo componente.**
Week view (cards) e month view (tabela) partilham estado de filtro de status e o
mesmo `ClosingDetailModal`. Manter tudo num componente evita sincronização de
estado e simplifica as queries TanStack.

**Diferenças por canal, nunca total vs Vendus (2026-11-21).**
A coluna «Dif.» comparava o total declarado (todos os canais) com o Total Vendus,
que só tem TPA + Eatz + dinheiro — a diferença saía inflacionada todos os dias pelo
valor das apps de entregas (ex.: 1–20/11: +5 461,50 € mostrados vs +12,18 € reais).
Agora a lista usa `vendusDiff` (como o detalhe) e mostra à parte a `airMenuDiff`.

**Mês agrupado por dia, sem paginação (2026-11-21).**
O mês é pedido inteiro (`limit: 200`) para que um dia nunca fique partido entre
páginas. O AirMenu é consultado por data (não por sessão): todos os fechos do mesmo
dia trazem o total do dia inteiro, por isso o `ClosingDay` conta-o **uma vez** (o
mais recente), enquanto as referências Vendus (por sessão) se somam.

**Week view carrega a semana inteira (limit: 200).**
A query usa `from`/`to` para cobrir os 7 dias. O `limit: 200` é generoso mas
seguro (máx. ~14 funcionários × 7 dias). O agrupamento por dia é feito em memória
no componente, sem endpoint específico.

**`api` exposto directamente no módulo context para operações do kiosk.**
`verifyPin`, `submitClosing` e `getVendusTotal` são pass-through sem lógica de
cliente. Expô-los via `api` (sem use case wrapper) mantém o módulo simples sem
violar a regra "sem fetch nos componentes" — o kiosk chama `module.api` via hook.
`getAirMenuTotals` vive em `cashClosingApi.ts` (legado) e é chamado diretamente
no step de review do kiosk para mostrar a referência AirMenu antes da submissão.

**Identidade visual da marca.**
Paleta `#A3211A → #ED5C32 → #EF8935 → #F1A93F → #F5C992` usada como accent;
fundo `#FAF6F3` (off-white quente). O sistema é backoffice — discreto. As cores
de marca aparecem em títulos, bordas activas, botões de acção e status badges,
nunca como fundo dominante.

## Como testar

- `npx vitest run src/modules/cash-closings` (com `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` fictícias): domínio puro, use cases e vista Mês do hub.

## Pontos de atenção / dívidas conhecidas

- `CashClosingPage` (kiosk, `/fecho`) ainda usa as funções legadas de
  `src/pages/cashClosing/cashClosingApi.ts`. Migração para `module.api` prevista.
- Testes de UI do `ClosingDetailModal` não implementados.
- No `ClosingDetailModal`, num dia com dois fechos, a «Diferença AirMenu» de cada
  fecho compara as apps dessa sessão com o total AirMenu do **dia inteiro** (a
  referência é por data). A vista Mês já soma bem; o detalhe por fecho ainda não.
- O `DayDrawer` reabre sempre que se volta da `ClosingDetailModal` para a week
  view. Considerar manter o `DayDrawer` visível em background enquanto o modal
  está aberto.
