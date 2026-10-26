# Módulo: recipe-costing

> Status: ativo
> Última atualização: 2026-10-26

## Propósito

Fichas técnicas (V7): página `/fichas-tecnicas` (`TechnicalSheetsView`, montada em `src/pages/stock/FichasTecnicasPage.tsx`) com três separadores — **Pratos** (uma linha por prato; estado do custo, custo teórico, margem s/ IVA, PVP), **Preparações** (rendimento, custo do lote e por unidade útil) e **Análise de custos** (variação face a 4/8/12 semanas com detalhe e histórico) — e painéis laterais para o detalhe. Os custos dos ingredientes só se consultam aqui: corrigem-se em Artigos e ingredientes (aviso «N ingredientes sem custo conhecido» → `/stock/stock?custo=sem`; «Ver artigo» → `?artigo=<id>&painel=precos`).

## Ports

### Saída

- `TechnicalSheetsApiPort` — pratos, PVP, receita ativa e linhas, preparações e linhas, artigos (endpoints existentes `/api/pizzas`, `/api/preparations`, `/api/stock/items`).
- `RecipeCostingApiPort.getSettings/saveSettings` — IVA das vendas para a margem (`/api/recipe-costing/settings`).
- `RecipeCostingApiPort` — `getReport()`, `getPriceHistory`, `getDishWeeklyCost`, `getDishesImpact(compareWeeks)` (task V6, `GET /api/recipe-costing/dishes/impact`) e `setManualUnitCost(stockItemId, custo)`; este último usa o endpoint legado `PUT /api/stock/items/:id` (`purchase_reference_unit_cost_without_vat`, permissão `stock.items` MANAGE).

## Adapters

- Entrada: `TechnicalSheetsView`, `DishPanel` (Composição · Custos · Histórico), `PreparationPanel` (Composição · Rendimento e custos · Utilização), `CostAnalysis`, `DishWeeklyCost`, `IngredientPriceHistory` (usado em Artigos), `WeeklyLineChart`, `sheet-ui` / `sheet-format`.
- Saída: `HttpRecipeCostingApiAdapter`, `HttpTechnicalSheetsApiAdapter`.

## Decisões de design

- **Interface genérica**: «Pratos», «Preparações», «Variantes» (a API continua a dizer pizzas/preparos; nada foi renomeado na BD).
- **XS só nas doces e = metade da Pequena** (`variants.ts`): ao gravar uma linha, a XS segue a Pequena; «Adicionar variante XS» cria as linhas a partir da Pequena.
- **Margem** (backend): só com custo completo e PVP; PVP com IVA convertido à taxa da empresa. O PVP edita-se no separador Custos do prato (`pizza_prices`).
- **Rendimento da preparação é registado à parte** (não a soma das entradas); o painel oferece «usar a soma dos ingredientes» só como atalho. A criação pede o rendimento (antes nascia com 0,001).
- Sem editor de preços de ingredientes nesta página (o antigo «Preço dos ingredientes» saiu; os custos manuais vivem no artigo).
- O preço manual introduz-se por kg / l (`pricing-unit.ts` converte de/para g, ml, cl); o catálogo guarda por unidade base.
- A fatura importada passa sempre à frente do preço manual (regra do backend); a UI só o explica.
- Só pizzas ativas na tabela (a lista de pizzas tem «Inativar/Reativar»).
- Na ficha técnica, `dish-line-cost.ts` junta o custo por linha do backend (`DishSizeCost.lines`) às linhas agrupadas por artigo/preparo; o total mostra o PVP ao lado, sem percentagem (a taxa de IVA da venda não está modelada).

- Impacto: método do backend (ficha atual × preços de cada semana, reconstruído) mostrado por baixo do título; sem coluna de margem.

## Como testar

`npx vitest run src/modules/recipe-costing`
