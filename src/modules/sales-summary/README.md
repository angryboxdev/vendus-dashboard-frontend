# Módulo: sales-summary

> Status: ativo
> Última atualização: 2026-09-06

## Propósito

Exibe ao gestor uma visão consolidada da faturação mensal combinando dados Vendus e AirMenu. Resolve a `/results` page — o ponto de entrada principal do dashboard. Não é responsável pelos detalhes de cada fonte (Vendus/AirMenu), nem por dados de custo ou DRE.

## Conceitos do domínio

- **SalesPeriod** — par (ano, mês). Não há intervalos livres de datas; sempre um mês completo.
- **SalesSummaryResult** — resultado consolidado retornado pelo backend (valores em cêntimos).
- **Período de comparação** — sempre o mês anterior ao período seleccionado (fixo no MVP).
- **TTL / cache** — gerido pelo backend; o frontend mostra `cachedAt` e expõe botão "Actualizar" (POST refresh).

## Ports

### Entrada (use cases)
- `GetSalesSummaryPort` — busca o resultado consolidado de um período (GET, usa cache do backend).
- `RefreshSalesSummaryPort` — força recálculo a partir das APIs de origem e actualiza a cache (POST).

### Saída (dependências do domínio)
- `SalesSummaryApiPort` — interface HTTP; duas operações: `getSummary` e `refreshSummary`.

## Adapters

### Entrada (UI)
- `SalesSummaryProvider` (composition root + state) — cria as instâncias de use case, gere o período seleccionado, corre as duas queries (período principal + período de comparação) e expõe `refresh`.
- `SalesSummaryView` — página shell: cabeçalho, `PeriodSelector`, `CacheStatusBar`, `KpiHeaderSection`.
- `PeriodSelector` — dois `<select>` (mês + ano) que actualizam o período no provider.
- `KpiHeaderSection` — 8 KPI cards com valor do período seleccionado e delta % face ao período de comparação.
- `CacheStatusBar` — tempo relativo ("há X minutos") com timestamp absoluto em tooltip; botão "Actualizar".

### Saída
- `HttpSalesSummaryApiAdapter` — implementa `SalesSummaryApiPort` via `apiGet` / `apiPost`.

## Decisões de design

- **Estado no Provider** — `SalesSummaryProvider` gere o período seleccionado e corre ambas as queries. Isso permite que `PeriodSelector`, `CacheStatusBar` e `KpiHeaderSection` leiam o mesmo contexto sem prop-drilling.
- **Duas queries em paralelo** — `Promise.allSettled` corre a query do período principal e do período de comparação em paralelo. Se a comparação falhar, os cards mostram-se sem delta (degradação graciosa).
- **Valores em cêntimos** — o backend retorna todos os valores monetários em cêntimos; a UI divide por 100 antes de formatar com `formatEUR`.
- **Período de comparação fixo** — sempre mês anterior; não é configurável no MVP (alinhado com a spec do backend).

## Como testar

- Domínio/use cases: `npx vitest run src/modules/sales-summary` (rápido, sem rede).
- Componentes/hooks: não incluídos nesta iteração (ver dívidas conhecidas).

## Pontos de atenção / dívidas conhecidas

- Sem testes de componente para `KpiHeaderSection`, `CacheStatusBar`, `PeriodSelector`.
- Secções de canal/categoria, top produtos e gráfico de crescimento serão adicionadas nas issues 04 e 05.
- O seletor de ano está limitado a 2023–ano corrente; expandir se necessário.
