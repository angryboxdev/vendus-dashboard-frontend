# Módulo: stock-catalog

> Status: ativo
> Última atualização: 2026-10-26

## Propósito

«Artigos e ingredientes» (task V6): a lista única do Stock com três vistas da mesma tabela — **Geral** (categoria, tipo, stock, mínimo, situação, último custo), **Reposição** (só o que está em falta, com a sugestão de compra pela embalagem do fornecedor habitual) e **Custos** (último custo, referência de 12 semanas, variação, tendência, fornecedor, última compra, custo manual) — e o painel lateral do artigo (Stock, Preços e histórico, Compras, Fichas técnicas, Movimentos).

## Ports

### Saída

- `StockCatalogApiPort` — artigos e categorias (legado `/api/stock/*`), resumo de custos (`/api/recipe-costing/ingredients/overview`), embalagens confirmadas (`/api/stock-purchase-reviews/presentations`, `[]` sem permissão), movimentos, fichas que usam o artigo e compras confirmadas.

## Adapters

- Entrada: `ArticlesView` (montada em `src/pages/stock/StockPage.tsx`, que junta as ações e os formulários existentes: Novo artigo, Editar, Regras de entrada), `ArticleDrawer`, `Sparkline`.
- Saída: `HttpStockCatalogApiAdapter`.

## Decisões de design

- **Situação** (`stock-rules.ts`): sem movimentos ≠ stock 0 («Sem movimentos»); «Próximo do mínimo» até 1,2 × mínimo; inativo à parte.
- **Sugestão de compra**: falta = mínimo − stock, arredondada para cima à embalagem confirmada do fornecedor da última compra (mínimo e incremento de encomenda); sem embalagem → «Por confirmar». Só sugestão: não cria compras nem movimentos.
- **Custos**: «Último custo» só de compras confirmadas (nunca o manual; sem compra → «Sem custo conhecido»); o manual aparece em «Custo manual». Preços por kg / l / un (`unit-cost.ts`), nunca «0,00» para custos pequenos.
- Ordenação por omissão: nome, com o que precisa de atenção primeiro; paginação 25/50/100; filtros numa faixa (estado por omissão: ativos).
- O importador antigo do Stock foi retirado (a entrada de faturas é pelas Compras por rever).

## Como testar

`npx vitest run src/modules/stock-catalog`
