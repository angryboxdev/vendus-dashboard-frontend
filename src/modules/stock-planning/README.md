# Módulo: stock-planning

> Status: ativo
> Última atualização: 2026-09-30

## Propósito

UI de "Planeamento de stock" (Stock Intelligence 3.0): previsão de procura,
projeção de cobertura de stock, alertas automáticos (risco de rutura, possível
excesso, variação de preço, qualidade de dados) e lista de compras sugerida
agrupada por fornecedor. Consome os 10 endpoints do módulo backend homónimo
(`GET/POST /api/stock-planning/*`).

NÃO é responsável por criar encomendas, ajustar stock ou decidir sozinho —
tudo aqui é sugestão/alerta/explicação; qualquer ação real de compra continua a
acontecer nos módulos `stock-purchase-review` (quando a fatura chega) e
`stock-count` (contagem física). O único efeito de escrita direto deste módulo
é registar uma "revisão" de quantidade sugerida (`reviewRecommendation`) e
feedback de desvio de previsão (`submitForecastFeedback`) — nunca move stock.

## Conceitos do domínio

- **RiskLevel** (`critico`/`atencao`/`excesso`/`ok`) e **ConfidenceLevel**
  (`alta`/`media`/`baixa`) — transcritos literalmente dos serviços de domínio do
  backend (`risk-classification.service.ts`/`confidence.service.ts`); nunca
  reinventados no frontend.
- **PlanningItemRowDTO** / **PlanningItemDetailDTO** — item de stock com
  projeção (`ProjectionPoint[]`), pontos de procura (`DemandPointDTO[]`),
  produtos afetados, flags de qualidade e explicação da recomendação de compra.
- **PlanningAlertRowDTO** / **PlanningAlertDetailDTO** — alerta com tipo
  (`stockout_risk`/`excess_stock`/`price_anomaly`/`data_quality_warning`),
  severidade e estado (`active`/`acknowledged`/`silenced`/`resolved`).
- **SuggestedPurchaseListDTO** — lista de compras sugerida agrupada por
  fornecedor, com quantidade sugerida pelo sistema e campo de revisão manual.
- **ForecastHistoryDTO** — runs do forecast diário + desvios recentes
  (previsto vs. realizado), cada um associado a um `feedbackId` para
  `submitForecastFeedback`.

## Ports

### Saída (dependências do domínio)

`StockPlanningApiPort` — um método por rota do backend usada:
`listItems`, `getItemDetail`, `listAlerts`, `getAlertDetail`, `acknowledgeAlert`,
`silenceAlert`, `getPurchaseList`, `reviewRecommendation`,
`submitForecastFeedback`, `getForecastHistory`, mais `listStockCategoryOptions`
(reaproveita o endpoint legado `/api/stock/categories`, mesma fonte usada por
`stock-purchase-review`).

Não inclui `runDailyForecast`/`backfillDemandActuals`/`detectForecastDeviation`
— são operacionais/admin-only, disparados pelo cron interno; a task pediu para
não construir UI para eles nesta ronda.

## Adapters

### Entrada (UI)

- **`PlanningMainView`** (`/stock/planeamento`) — tabela principal de itens com
  filtros (loja/categoria/fornecedor/nível de risco/pesquisa), 4 cards de
  resumo e botão "Gerar lista de compras". Abre `PlanningItemDetailDrawer` ao
  clicar numa linha.
- **`PlanningItemDetailDrawer`** — drawer com 5 tabs (Visão geral / Projeção e
  forecast / Recomendação / Produtos afetados / Histórico e preço).
- **`PlanningAlertsView`** (`/stock/planeamento/alertas`) — cards de resumo,
  filtros rápidos e tabela de alertas com ações Reconhecer/Silenciar. Abre
  `PlanningAlertDetailDrawer`.
- **`PlanningAlertDetailDrawer`** — drawer com 3 tabs (Detalhes / Histórico /
  Produtos afetados), reaproveita `ProjectionChartCard`/`QualityChecklist`/
  `AffectedProductsGrid`.
- **`SuggestedPurchaseListView`** (`/stock/planeamento/lista-compras`) —
  grupos por fornecedor, stepper de revisão de quantidade (chama
  `reviewRecommendation` por linha), exportar CSV e copiar resumo (ambos
  puramente client-side).
- **`ForecastHistoryView`** (`/stock/planeamento/historico`) — 4 sub-tabs
  (Visão geral / Vendas previstas / Consumo por ingrediente / Desvios e
  feedback). Abre `ForecastFeedbackDrawer` a partir da tabela de desvios.
- **`ForecastFeedbackDrawer`** — formulário "Ontem as vendas foram diferentes
  do esperado" (grelha de motivos + comentário + disclaimer).
- **`PlanningSubNav`** — breadcrumb + navegação entre as 4 páginas do módulo
  (a sidebar só tem uma entrada "Planeamento").
- **`RiskBadge` / `ConfidenceBadge` / `SeverityBadge` / `StateBadge`** —
  badges de apresentação, mesma convenção pill já usada no resto do repo.
- **`ProjectionChartCard` / `QualityChecklist` / `AffectedProductsGrid`** —
  componentes partilhados entre a drawer de item e a drawer de alerta (o
  mockup pede o mesmo bloco visual nos dois sítios).

### Saída

- `HttpStockPlanningApiAdapter` — implementa `StockPlanningApiPort` usando
  `apiGet`/`apiPost` de `src/lib/api.ts`.

## Decisões de design (ADR resumido)

**Navegação entre as 4 páginas via `PlanningSubNav`, não via sidebar.** A
sidebar (`nav-state.service.ts`) só ganhou uma entrada "Planeamento" — replicar
o padrão de "Compras por rever" (só alcançável por botão em página). As 4
páginas (Itens/Alertas/Lista de compras/Histórico) navegam entre si por uma
barra local, espelhando o breadcrumb "Stock &gt; Planeamento &gt; …" dos mockups.

**Filtros de loja usam `LocationSelect` (auto-seleciona a única loja).** Mesmo
componente e convenção já usados em todo o repo (D4/D15) — organizações
mono-loja não veem seletor nenhum.

**Paginação client-side.** Os endpoints de listagem (`/items`, `/alerts`) não
paginam no backend; a UI pagina a lista já carregada em memória (20 por
página), igual ao padrão já aceite noutros módulos deste round
(`stock-purchase-review`, `stock-count`).

## Simplificações e gaps conhecidos (vs. mockups de referência)

Documentados aqui em vez de fabricados como dado real:

- **"Principais produtos com maior variação" (drawer de feedback, screenshot
  1) — omitido.** `ForecastDeviationRowDTO` só tem o agregado do dia
  (`forecastValue`/`actualValue`/`deviationPercent`); não há endpoint de
  desvio por produto.
- **"Evolução do dia" / curva intradiária (mesma drawer) — omitido.** Não há
  dado horário por trás do agregado diário.
- **Sub-tabs "Vendas previstas" e "Consumo por ingrediente" (Histórico de
  previsões) — profundidade reduzida.** "Vendas previstas" reaproveita os
  mesmos pontos agregados de "Desvios recentes" (não há uma curva diária
  própria ao nível do histórico, só ao nível de cada item). "Consumo por
  ingrediente" é um placeholder com uma nota a apontar para a drawer de item
  (que tem, essa sim, uma projeção por ingrediente).
- **"Próxima janela" na tabela principal de itens — omitida.**
  `PlanningItemRowDTO` não traz a data da próxima entrega (só a
  `recommendation.nextDeliveryDate` do detalhe); a coluna "Fornecedor" mostra
  o nome, a janela de entrega só aparece na drawer.
- **Lista de compras sugerida — colunas "Stock atual"/"Consumo previsto"/
  "Cobertura" omitidas.** `SuggestedPurchaseListLineDTO` não devolve esses
  campos (só quantidades sugeridas/revistas e custo estimado); mostradas em
  vez disso as colunas que a DTO suporta.
- **"+ Adicionar item a esta lista" (lista de compras) — desativado de
  propósito.** Não há endpoint para adicionar um item arbitrário à lista
  sugerida; o botão fica visível mas desativado com tooltip a explicar.
- **"Guardar revisão" (lista de compras) — não é uma gravação em lote.** Cada
  linha já grava de imediato ao clicar "Guardar" (chama
  `reviewRecommendation` por recomendação); o botão de topo só confirma isso
  visualmente, porque o backend não tem um endpoint de revisão em lote.
- **Histórico detalhado de transições de um alerta (tab "Histórico" da drawer
  de alerta) — placeholder.** Só se mostra `firstDetectedAt`/`lastUpdatedAt`/
  `resolvedAt`; não há um log de reconhecimentos/silenciamentos anteriores
  exposto por API.
- **Cartões "Risco crítico"/"Atenção"/"Variação de vendas" (Alertas) — mapeamento
  aproximado.** O backend não tem literalmente um `alertType` "variação de
  vendas"; a UI mapeia `stockout_risk` para esse cartão (risco de rutura
  nasce de variação de procura) e usa `severity` para os cartões
  crítico/atenção. Documentado aqui para não ser lido como um campo literal
  do backend.

## Como testar

- Este módulo ainda não tem testes de UI (Vitest + Testing Library) — a
  implementar num próximo round. Verificação feita nesta ronda: `tsc --noEmit`,
  `vitest run` (suite existente do repo, sem regressões) e `vite build`.

## Pontos de atenção / dívidas conhecidas

- Sem testes de UI próprios ainda.
- `PlanningMainView`/`PlanningAlertsView`/`ForecastHistoryView` cada um busca a
  lista de fornecedores/categorias separadamente (sem cache partilhado entre
  páginas) — aceitável para o volume atual, mas repete pedidos ao navegar
  entre as 4 páginas do módulo.
- Ver também os gaps documentados em `src/modules/financial-base/README.md`
  (tab "Planeamento de stock" do detalhe de fornecedor, e a tab "Itens
  associados" que consome este módulo).
