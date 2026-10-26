# Módulo: stock-purchase-review

> Status: ativo
> Última atualização: 2026-09-30 (Fase 1 — lista + formulário simples, sem wizard)

## Propósito

Quando uma fatura (módulo Faturas) é finalizada, o backend decide — via
categoria do fornecedor/categoria da linha, **nunca** Centro de Custo — se essa
fatura deve gerar uma "Compra por rever": uma revisão de impacto em stock. Um
humano mapeia cada linha da fatura para um item de stock existente (com fator
de conversão), um item novo (criado a quantidade 0), ou "não afeta stock", e só
ao confirmar explicitamente é que o stock real se move.

**Não é** um CRUD de itens de stock (isso continua em `src/pages/stock`,
legado) nem um wizard multi-passo — é deliberadamente uma lista simples + um
formulário simples por linha (Fase 1). Uma Fase 2, com fidelidade total ao
mockup, fica para depois.

## Conceitos do domínio

- `StockPurchaseReviewDTO` — a revisão completa de uma fatura: estado
  (`pending → in_review/partial → ready → applied`, ou `cancelled` a qualquer
  momento não-terminal), origem da decisão automática (`decisionSource`), e a
  lista de linhas por resolver/resolvidas. Traz sempre `version` — obrigatório
  fazer round-trip em qualquer mutação (optimistic lock).
- `StockReviewLineDTO` — uma linha da fatura em revisão. `resolutionType`
  começa `unresolved` e passa a `existing_item` (item de stock existente +
  fator de conversão), `new_item` (item novo, criado a quantidade 0) ou
  `no_stock_effect`.
- `decisionSource: "unresolved"` — nenhuma categoria/fornecedor decidiu
  automaticamente; a UI pergunta explicitamente "afeta o stock?" antes de
  deixar resolver linhas.
- Sugestão de mapeamento (`getLineSuggestion`) — nunca aplicada
  automaticamente; a UI mostra-a como affordance ("sugestão: X, aplicar?") que
  o utilizador tem de aceitar.

## Ports

### Saída (dependências do domínio)

- `StockPurchaseReviewApiPort` — CRUD/transições da revisão (`listReviews`,
  `getReview`, `resolveLine`, `getLineSuggestion`, `decideUnresolved`,
  `confirmReview`, `cancelReview`) e dois métodos auxiliares que reaproveitam
  endpoints já existentes do módulo de stock legado — `listStockItemOptions`
  (`/api/stock/items`) e `listStockCategoryOptions` (`/api/stock/categories`)
  — para os pickers de "item existente" e "novo item". Não há endpoint
  dedicado de contagem: o badge "Compras por rever (N)" deriva a contagem da
  própria listagem, do lado do cliente.

## Adapters

### Entrada (UI)

- `StockPurchaseReviewsListView` — tabela simples (Fatura/Fornecedor/Data/
  Linhas/Estado/Ação) com filtros de período, fornecedor, estado e pesquisa
  por nº de fatura.
- `StockPurchaseReviewDetailView` — cabeçalho da fatura + formulário simples
  por linha (não um drawer/wizard), prompt "afeta o stock?" quando
  `decisionSource === "unresolved"`, botão de confirmação (só ativo com
  `status === "ready"`) e cancelamento (motivo obrigatório).

### Saída

- `HttpStockPurchaseReviewApiAdapter` → implementa `StockPurchaseReviewApiPort`
  via `apiGet`/`apiPost` (`src/lib/api.ts`), incluindo a tradução do formato
  `snake_case` legado de `/api/stock/items` e `/api/stock/categories` para os
  DTOs `camelCase` do módulo.

## Decisões de design

- **Conflito de versão (409 `{ error, currentVersion }`)**: qualquer mutação
  que receba este erro mostra um aviso "alterado por outra pessoa" e refaz o
  `getReview`, em vez de tentar resolver o conflito no cliente.
- **Loja obrigatória no confirm**: não se mostra um seletor de loja
  antecipadamente. Só quando o backend responde 400 a pedir loja (múltiplas
  lojas ativas, alguma linha sem loja própria) é que a UI pede a loja e repete
  o pedido.
- **Botão "Importar fatura" da vista legada `StockPage`** foi substituído por
  um link "Compras por rever (N)" que navega para
  `/stock/compras-por-rever` — troca mínima, sem reescrever a página legada.
  Fica como atalho.
- **«Compras por rever» é um separador do Inventário** (2026-10-25), ao lado de
  Stock atual, Movimentos e Contagens: é a entrada do stock (faturas →
  movimentos). O separador mostra o nº por tratar (`useOpenReviewsCount`, por
  isso o `InventoryLayout` vai montado dentro de `StockPurchaseReviewProvider`).
  «Importar fatura» está no cabeçalho do Inventário (canto superior direito, em
  todos os separadores), só para quem tem Gerir em `stock.purchase_reviews` — a
  mesma exigência do `POST /api/invoices/import-for-stock`. O detalhe `/stock/compras-por-rever/:id` abre fora
  dos separadores, em largura total. Mesmas rotas; quem só tem
  `stock.purchase_reviews` vê «Inventário» no menu e cai neste separador.

- **Progresso da conciliação** (`ReviewProgressCard`, `reviewProgress` em `compact-review.ts`): no topo do detalhe, «40 / 44 linhas resolvidas» + barra segmentada (resolvidas · por resolver · fora do Stock), contando **linhas da fatura** (o Cheddar de dois lotes conta 2). Barra em vez de gráfico circular: com uma categoria dominante, as fatias pequenas ficam ilegíveis numa pizza. A legenda filtra a lista (estado do filtro no detalhe; outro clique = todas). Substitui o indicador «Linhas do documento».

## Como testar

- Não há testes automatizados dedicados nesta Fase 1 (módulo novo, sem lógica
  de domínio pura além de mapeamento de DTOs) — validação feita via
  `npx tsc --noEmit`, `eslint` e `vite build`. Uma Fase 2 com lógica de domínio
  mais rica (ex.: cálculo local de `stockQuantity`) deve trazer testes
  unitários dos use cases equivalentes.

## Pontos de atenção / dívidas conhecidas

- O filtro "fornecedor" na lista depende de `FinancialBaseProvider` estar
  montado na mesma árvore de rotas (está, em `/stock/compras-por-rever`).
- A contagem do badge (link em `StockPage` e separador do Inventário) repete o `GET /stock-purchase-reviews` completo sem
  paginação — aceitável no volume atual; se crescer muito, considerar um
  endpoint de contagem dedicado no backend.

## F3a (task v1.2)
- Detalhe: cada linha com referência, quantidade × preço, desconto, base, IVA e total; ações **«Associar artigo» / «Criar artigo» / «Não é item de stock»**; linhas resolvidas mostram artigo, fator, quantidade e destino, com «Alterar» enquanto a revisão não termina.
- **Divisão por lojas** (só com mais de uma loja): quantidades explícitas por loja, soma conferida no ecrã e no servidor (`locationSplits`).
- Painel com as **três conferências** (`review.conference`): Documento (diferença bloqueia o botão de confirmar), Stock (só inventariáveis), Categorias (pendência para o Financeiro, não bloqueia). Depois de confirmar, as divergências gravadas aparecem como pendência.
- Sugestões aprendidas marcadas «não confirmada»; com `packagingChanged` o fator antigo não é aplicado.
- Estado `excluded` («Excluída — não afeta Stock») e botão «Confirmar — não afeta Stock» quando todas as linhas não são item de stock.
- Teste: `adapters/in/StockPurchaseReviewDetailView.test.tsx`.

## F3b (task v1.2)
- Ao abrir uma revisão com linhas por resolver sem proposta, chama `suggestMappings` (histórico do fornecedor → nome no catálogo → IA, no servidor). Cada linha mostra a **conciliação proposta (não confirmada)** com artigo, fator e origem (histórico / nome / IA com %), «Aceitar» (só quando completa: artigo + fator, ou não é item de stock) e «Ajustar» (preenche o formulário). Barra com «Aceitar as N propostas» (resolve em sequência, versão a versão) e «Procurar de novo».
- Lista = fila: «Por tratar | Histórico», fornecedor, documento, data, destino, origem, valor, progresso de linhas e estado (Por mapear, Em revisão, Pronto, Movimentado, Excluída, Retirada). Saiu «Cancelar revisões sem linhas».
- «Retirar de Compras por rever» (motivo; não mexe no Financeiro) e «Repor em Compras por rever» nas retiradas.

## F3c (task v1.2)
- «Importar fatura» na lista (`StockImportInvoiceModal`): `importInvoiceForStock` (`POST /api/invoices/import-for-stock`). Nova → abre a revisão; `already_in_stock` → aviso vermelho e bloqueio (só «Abrir a revisão»); `already_in_review` → abrir; `exists_not_routed` → «Enviar para Compras por rever» (`routeExisting`); `extraction_failed` → «Tentar de novo» (máx. 2).
- Lista: origem «Stock» e etiqueta «Aguarda Financeiro»; detalhe: aviso de pendência e das condições para dar entrada antes do Financeiro.

## Embalagem de compra
- `PackagingPanel` em cada linha da revisão: «Fatura: 20 kg × 6,20 €/kg − 12,40 € desconto = 111,60 € (sem IVA)», «Embalagem confirmada: 1 saco = 2,5 kg → 8 sacos», «Stock após confirmar: +20 000 g · custo líquido: 5,58 €/kg · 13,95 €/saco · 0,00558 €/g»; ou «Embalagem por configurar». O editor (vem em…, cada saco tem…, a fatura conta sacos/kg, mínimo e incremento) mostra as equivalências antes de gravar (`domain/services/presentation.ts`, mesmas regras do servidor) e preenche o fator da linha — nunca se escreve um fator opaco.
- API: `listPresentations(supplierId)`, `savePresentation(payload)`.
