# Módulo: invoices

> Status: ativo
> Última atualização: 2026-06-22

## O que é e para que serve (perspectiva de negócio)

Todos os meses chegam dezenas de faturas à Angrybox — da Makro, da EDP, da NOS,
de plataformas de marketing, de fornecedores de embalagens. Sem um sistema, essas
faturas ficam em papel, em email ou numa pasta, e o manager não sabe o que deve,
quando vence, nem quanto gastou por área.

**O problema que resolve:**
Perder uma fatura vencida significa juros ou interrupção de serviço. Não saber o
total de custos por centro de custo impede qualquer análise financeira. Esta página
centraliza todas as faturas, dá visibilidade sobre o estado de cada uma e permite
classificar cada despesa pela área da empresa a que pertence.

**O fluxo do ponto de vista do negócio:**

```
Manager (backoffice)
────────────────────────────────────────────────────────────────
1. Chega uma fatura (email, papel, PDF)
2. Manager clica "Nova fatura" e introduz os dados:
   fornecedor, número, datas, valores (s/ IVA, IVA, total)
3. A fatura aparece na tabela com estado "Pendente"
4. Manager abre a fatura → tab "Linhas":
   — classifica cada linha por tipo e centro de custo
   — opcionalmente guarda como regra para futuras faturas
     do mesmo fornecedor
5. Quando a fatura é paga, clica "Marcar como paga"
   → estado passa para "Paga", fica registada a data
6. Faturas com prazo ultrapassado aparecem a vermelho nos KPIs
   e na tabela com estado "Vencida"
```

**Conceitos-chave para o negócio:**

- **Estado da fatura** — *Pendente* (a pagar), *Paga*, *Vencida* (prazo
  ultrapassado), *Parcial* (pagamento parcial), *Cancelada*, *Em revisão*.
- **Linha de fatura** — detalhe do que foi comprado. Uma fatura da Makro pode ter
  "Farinha T55" (stock, OPE) e "Material de limpeza" (operacional, OPE). Classificar
  por linha permite relatórios precisos por área.
- **Regra de classificação** — ao marcar "guardar como regra", o sistema memoriza
  como classificar futuras faturas desse fornecedor. A confiança cresce a cada
  confirmação manual.
- **KPIs** — total faturado (c/ e s/ IVA), total vencido (€ + contagem) e total
  pendente (€ + contagem). Dão ao manager visão imediata sobre o estado das contas.

---

## Propósito técnico

Gere a UI de faturas de fornecedores: listagem, criação, ciclo de vida (pendente →
pago/cancelado/vencido), e classificação de linhas por tipo e centro de custo.
NÃO é responsável por extratos bancários, reconciliação ou relatórios financeiros.

## Conceitos do domínio

- **InvoiceDTO** — fatura com cabeçalho (fornecedor, valores, datas, estado) e
  linhas opcionais.
- **InvoiceLineDTO** — linha de detalhe com `type`, `costCenterId` (legado),
  `costCenterCategoryId` (novo), `category` livre e valores monetários.
- **InvoiceStatus** — `pending | paid | overdue | partial | cancelled | review`.
- **InvoiceLineType** — `stock_purchase | operational_expense | fixed_cost |
  variable_cost | tax | bank_fee | salary | internal_transfer | service | mixed | other`.
- Todos os valores monetários em **cêntimos** (inteiros). Exibição usa `pt-PT` locale.

## Ports

### Saída (dependências do domínio)

- `InvoicesApiPort` — interface com os métodos HTTP:
  `listInvoices`, `listInvoiceLines`, `getInvoice`, `addLine`, `createInvoice`,
  `updateInvoice`, `markInvoicePaid`, `deleteInvoice`, `classifyLine`.

## Adapters

### Entrada (UI)

- `InvoicesView` — página `/financial/invoices`:
  - **KPIs** (4 cards): total de faturas, valor total (c/ IVA + s/ IVA como sub),
    vencidas (total € + contagem), pendentes (total € + contagem).
  - **Filtros**: pesquisa por nome de fornecedor ou nº de fatura; filtro por estado.
  - **Tabela**: estado (badge), fornecedor, nº fatura, datas, valores. Botão "Ver" abre detalhe.
  - **`CreateInvoiceDrawer`** — drawer lateral para criar nova fatura: campos de
    cabeçalho (obrigatórios + opcionais, seleção de fornecedor) e secção de linhas
    onde é possível adicionar linhas antes de submeter (tipo, categoria livre, qtd,
    preço unitário, IVA).
  - **`InvoiceDetailDrawer`** — drawer lateral com dois tabs:
    - *Detalhes*: campos de cabeçalho, botão "Marcar como paga".
    - *Linhas*: lista de `InvoiceLineDTO`; formulário `AddLineForm` para adicionar
      novas linhas (com seleção de `InvoiceLineType` e campo de categoria livre);
      `ClassifyPanel` inline por linha existente.
  - **`ClassifyPanel`** — painel inline por linha: seleccionar tipo (`InvoiceLineType`),
    subcategoria de CC (`costCenterCategoryId`) e categoria livre; opção de guardar
    como regra automática para o fornecedor.

### Saída

- `HttpInvoicesApiAdapter` — implementa `InvoicesApiPort` usando `apiGet`,
  `apiPost`, `apiPatch`, `apiDeleteNoContent` de `src/lib/api.ts`.

## Decisões de design (ADR resumido)

**`InvoicesProvider` envolve toda a rota `/financial/*`.**
O `CostCentersView` (módulo `financial-base`) também precisa de dados de faturas
para os KPIs globais. Em vez de duplicar a query, o `InvoicesProvider` foi movido
para envolver o nó pai `/financial/*` no `App.tsx`. Qualquer vista dentro do
grupo financeiro pode usar `useInvoicesModule()`.

**Linhas carregadas on-demand no detalhe.**
A listagem de faturas não inclui linhas (custo de rede desnecessário). As linhas
são carregadas apenas quando o tab "Linhas" é activado no `InvoiceDetailDrawer`,
com uma chamada a `getInvoice(id)` que retorna a fatura com linhas incluídas.

**`ClassifyPanel` inline por linha (sem modal separado).**
A classificação é frequente (uma linha de cada vez). Ter o painel directamente
visível na lista de linhas elimina um nível de navegação e torna o fluxo mais
rápido para o manager.

**Identidade visual consistente com o grupo financeiro.**
Bordas `border-[#F5C992]/40`, fundo `#FAF6F3`, botões com gradiente
`from-[#ED5C32] to-[#EF8935]`, KPI cards `px-5 py-4 shadow-sm text-xl`.
Título de página `text-xl font-bold text-stone-900` (igual a `CostCentersView`
e `SuppliersView`).

## Como testar

- Domínio: não há lógica de domínio no frontend — entidades são apenas interfaces TypeScript.
- Testes de UI: a implementar com Vitest + Testing Library.

## Pontos de atenção / dívidas conhecidas

- Testes de UI não implementados.
- Não há paginação na listagem — aceitável para o volume actual; adicionar se
  necessário (o backend já suporta `from`/`to` como filtros de data).
- Ao fechar um `InvoiceDetailDrawer` e reabri-lo, as linhas são recarregadas.
  Considerar manter as linhas em cache via `useQuery` com `queryKey: ["invoice-lines", id]`.
- `setInvoiceStatus` e `suggestClassification` existem no backend mas não estão expostos
  no `InvoicesApiPort` do frontend — adicionar quando necessário na UI.
