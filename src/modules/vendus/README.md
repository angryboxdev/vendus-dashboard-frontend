# Módulo: vendus

> Status: ativo
> Última atualização: 2026-08-04

## Propósito

Página de faturação Vendus do dashboard. Consome o endpoint `/api/vendus/summary` para mostrar documentos fiscais com breakdown por canal (Salão / Eatz), categoria, IVA e produto, num layout análogo ao módulo AirMenu. Não emite nem altera documentos — apenas os lê e apresenta.

## Conceitos do domínio

- **Canal**: `salao` (restaurante + take-away agrupado) ou `eatz` (delivery próprio). Derivado pelo backend a partir dos métodos de pagamento.
- **Take-away**: sub-contado em `takeAwayCount` dentro do canal `salao`.
- **NC**: nota de crédito — anula uma FS/FT; contribui negativamente para a receita.
- **VendusDetailedDocument**: documento enriquecido com `channel`, já contém items, payments e taxes — sem necessidade de fetch adicional.

## Ports

### Entrada (use cases)

- `GetSummaryPort` — `execute(since, until)` → `VendusSummaryResult` (documentos + analytics completos).

### Saída (dependências do domínio)

- `VendusApiPort` — `fetchSummary(since, until)` → HTTP para o backend.

## Adapters

### Entrada (UI)

- `useVendusSummary` (hook) — consome `GetSummaryPort`, expõe `{ documents, analytics, loading, error, refresh }`.
- `VendusView` (componente) — view principal com date range selector, tabs Resumo/Análise/Documentos e drawer de detalhe.
- `VendusAnalytics` — componentes de analytics: `KpiCards`, `ChannelTable`, `CategoryTable`, `TopProductsTable`, `TemporalChart`, `Pagination`.

### Saída

- `HttpVendusApiAdapter` — implementa `VendusApiPort` usando `apiGet` de `lib/api.ts`.

## Decisões de design

- **Sem tabs de enterprise**: ao contrário do AirMenu (múltiplas empresas), o Vendus é sempre o mesmo restaurante — sem seletor de enterprise.
- **`VendusDetailedDocument` já inclui tudo**: o `/vendus/summary` devolve documentos completos (items + payments + taxes), por isso o drawer de detalhe não precisa de fetch adicional.
- **Canais em vez de plataformas**: `byChannel` (salao/eatz) é o análogo de `byPlatform` (Glovo/Uber/Bolt) no AirMenu. O takeAwayCount é apresentado como anotação no canal `salao`.
- **Filtro de documentos**: FS/FT agrupados como "Faturas", NC separadas — análogo a invoice/credit_note no AirMenu.

## Como testar

```bash
# Domínio/use cases (com fakes):
cd vendus-dashboard-frontend
npx vitest run src/modules/vendus
```

Teste manual:
```
GET /api/vendus/summary?since=2026-08-01&until=2026-08-03
→ Abre /vendus no dashboard
```

## Pontos de atenção / dívidas conhecidas

- **N+1 no backend**: o `/vendus/summary` faz um fetch de detalhe por documento. Para períodos longos pode ser lento (ver README do backend para detalhes).
- **Sem testes de UI**: nenhum teste de componente ainda. Pós-MVP: adicionar testes para `VendusView` com fakes do módulo.
