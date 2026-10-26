# Módulo: recipe-costing

> Status: ativo
> Última atualização: 2026-10-26

## Propósito

Frontend do custo das fichas técnicas (backend `recipe-costing`, `GET /api/recipe-costing`): secção «Custo das fichas técnicas» na página de Pizzas, com o custo s/ IVA por pizza e tamanho ao lado do PVP, o preço de cada ingrediente com a origem («Fatura» / «Manual») e um alerta dos ingredientes sem preço, onde se pode preencher o preço à mão.

## Ports

### Saída

- `RecipeCostingApiPort` — `getReport()`, `getPriceHistory`, `getDishWeeklyCost`, `getDishesImpact(compareWeeks)` (task V6, `GET /api/recipe-costing/dishes/impact`) e `setManualUnitCost(stockItemId, custo)`; este último usa o endpoint legado `PUT /api/stock/items/:id` (`purchase_reference_unit_cost_without_vat`, permissão `stock.items` MANAGE).

## Adapters

- Entrada: `RecipeCostingSection` (montado em `src/pages/stock/PizzasPage.tsx`, recarrega ao fechar uma receita ou preparo via `refreshKey`).
- Entrada: `useDishCosting(pizzaId, refreshKey)` — custo de um prato para a ficha técnica (modal «Ver receita» da `PizzasPage`), relido a cada alteração gravada nas linhas.
- Entrada: `DishesImpact` — «Impacto nas pizzas» (task V6) na página de Pizzas, acima do custo das fichas: custo atual vs há 4/8/12 semanas, variação, fator principal e diferença por ingrediente ao expandir; «Não comparável» quando falta preço numa das semanas.
- Saída: `HttpRecipeCostingApiAdapter`.

## Decisões de design

- O preço manual introduz-se por kg / l (`pricing-unit.ts` converte de/para g, ml, cl); o catálogo guarda por unidade base.
- A fatura importada passa sempre à frente do preço manual (regra do backend); a UI só o explica.
- Só pizzas ativas na tabela (a lista de pizzas tem «Inativar/Reativar»).
- Na ficha técnica, `dish-line-cost.ts` junta o custo por linha do backend (`DishSizeCost.lines`) às linhas agrupadas por artigo/preparo; o total mostra o PVP ao lado, sem percentagem (a taxa de IVA da venda não está modelada).

- Impacto: método do backend (ficha atual × preços de cada semana, reconstruído) mostrado por baixo do título; sem coluna de margem.

## Como testar

`npx vitest run src/modules/recipe-costing`
