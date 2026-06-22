# Módulo: financial-base

> Status: ativo
> Última atualização: 2026-06-22

## O que é e para que serve (perspectiva de negócio)

A Angrybox tem custos que vêm de muitos sítios diferentes — fornecedores de
ingredientes, serviços de limpeza, rendas, plataformas de marketing, software. Sem
uma estrutura que organize esses custos, é impossível responder a perguntas simples
como "quanto gastámos em operações este mês?" ou "este custo entra na DRE ou é CAPEX?".

**O problema que resolve:**
Sem centros de custo, todos os gastos caem num balde único — o manager vê o total
mas não percebe onde o dinheiro vai. Sem fornecedores catalogados, cada vez que chega
uma fatura há que voltar a procurar o NIF, o IBAN, as condições de pagamento. Este
módulo cria e mantém essa estrutura base.

**O fluxo do ponto de vista do negócio:**

```
Manager (backoffice)
────────────────────────────────────────────────────
1. Seed inicial carrega os 7 grupos e 28 subcategorias padrão
   (ou manager cria manualmente novos grupos/subcategorias)
2. Cada subcategoria tem regras financeiras:
   afeta DRE? afeta fluxo de caixa? afeta rentabilidade?
3. Manager cria fornecedores com grupo+subcategoria por defeito
   (ex: Makro → OPD / CMV / Ingredientes)
4. À medida que entram faturas, o sistema usa a classificação
   do fornecedor para sugerir o centro de custo
5. Na tab "Análise", o manager vê quanto foi gasto por
   subcategoria, cruzando as linhas de fatura classificadas
```

**Conceitos-chave para o negócio:**

- **Grupo de Centro de Custo** — agrupamento gerencial de alto nível.
  Exemplos: "OPD" (Operação Direta), "PES" (Pessoal), "FDR" (Fora da DRE).
  São 7 grupos fixos no MVP, mas podem ser criados manualmente.
- **Subcategoria** — classificação específica dentro de um grupo.
  Exemplos: "OPD.01 — CMV / Ingredientes", "EST.01 — Renda / Aluguel".
  Cada subcategoria tem tipo financeiro e flags de impacto (DRE, cashflow, rentabilidade).
- **Tipo financeiro** — natureza da despesa: `cmv`, `variable_cost`, `fixed_opex`,
  `personnel`, `administrative`, `marketing`, `financial`, `capex`, `fiscal`,
  `off_dre`, `internal_transfer`, `transitory`.
- **Fornecedor** — entidade externa que emite faturas. Tem grupo e subcategoria por
  defeito para acelerar a classificação automática de novas faturas.

---

## Propósito técnico

Gere a UI de master data financeiros: **grupos de centros de custo**, **subcategorias**
com regras financeiras e **fornecedores**. É a base visual de que os módulos `invoices`
e `payable-entries` dependem para classificação e sugestão automática.

NÃO é responsável por mostrar faturas, calcular totais financeiros globais, nem gerir
contas a pagar — esses módulos existem separadamente.

## Conceitos do domínio

- **CostCenterGroup** — grupo principal com `id`, `code` (único, maiúsculas), `name`,
  `description`, `sortOrder`, `isActive`.
- **CostCenterCategory** — subcategoria com `groupId`, `code` (único), `name`,
  `financialType` e cinco flags booleanas: `affectsDre`, `affectsCashflow`,
  `affectsProfitability`, `requiresChannel`, `requiresAllocation`.
- **FinancialType** — union de 12 valores com labels (`FINANCIAL_TYPE_LABELS`) e cores
  de badge (`FINANCIAL_TYPE_COLORS`) definidos em `cost-center.ts`.
- **Supplier** — fornecedor com dados de contacto (NIF, email, telefone, morada, IBAN),
  `paymentTermsDays`, `defaultCostCenterGroupId` e `defaultCostCenterCategoryId`.
- **SeedResult** — resultado do seed: `groupsCreated`, `categoriesCreated`, `groupsSkipped`,
  `categoriesSkipped` (retornado por `seedDefaultCostCenters()`).

## Ports

### Saída (dependências do domínio)

`FinancialBaseApiPort` — todas as chamadas HTTP ao backend:

**Grupos**
- `listCostCenterGroups(params?)` — lista com filtro `isActive?`
- `getCostCenterGroup(id)` — detalhe
- `createCostCenterGroup(payload)` — criar
- `updateCostCenterGroup(id, payload)` — actualizar
- `setCostCenterGroupStatus(id, isActive)` — activar/desactivar

**Subcategorias**
- `listCostCenterCategories(params?)` — lista com filtros `groupId?`, `isActive?`
- `getCostCenterCategory(id)` — detalhe
- `createCostCenterCategory(payload)` — criar
- `updateCostCenterCategory(id, payload)` — actualizar
- `setCostCenterCategoryStatus(id, isActive)` — activar/desactivar
- `seedDefaultCostCenters()` — popula 7 grupos + 28 subcategorias padrão (idempotente)

**Fornecedores**
- `listSuppliers(params?)` — lista com filtros `status?`, `search?`
- `getSupplier(id)` — detalhe
- `createSupplier(payload)` — criar
- `updateSupplier(id, payload)` — actualizar
- `setSupplierStatus(id, status)` — activar/desactivar

## Adapters

### Entrada (UI)

- **`CostCentersView`** — página `/financial/cost-centers` com 3 tabs:
  - *Tab 1 — Grupos*: tabela de `CostCenterGroup` com código, nome, descrição,
    `sortOrder` e toggle de estado. Drawer lateral para criar/editar.
  - *Tab 2 — Subcategorias*: tabela de `CostCenterCategory` com filtro por grupo,
    badge de `financialType`, flags DRE/cashflow/rentabilidade e toggle de estado.
    Drawer lateral para criar/editar.
  - *Tab 3 — Análise*: tabela de analytics por subcategoria cruzando linhas de fatura
    classificadas com `costCenterCategoryId`. Dados vindos do módulo `invoices` via
    `useInvoicesModule()`. Rows expandíveis mostram o detalhe das linhas individuais.

- **`SuppliersView`** — página `/financial/suppliers`:
  - Tabela de fornecedores com pesquisa por nome e filtro de estado.
  - Drawer lateral para criar/editar fornecedor (inclui seleção de grupo e subcategoria por defeito).
  - Botão de activar/desactivar.

### Saída

- `HttpFinancialBaseApiAdapter` — implementa `FinancialBaseApiPort` usando
  `apiGet`, `apiPost`, `apiPatch` de `src/lib/api.ts`.

## Decisões de design (ADR resumido)

**Hierarquia Grupo + Subcategoria em vez de CostCenter plano.**
A estrutura anterior tinha um `CostCenter` com `category` enum e `subcategory` texto livre.
O novo modelo usa duas entidades separadas, alinhado com o backend redesenhado em Junho 2026.
Permite filtrar analytics por `financialType` e flags (`affectsDre`, etc.) em vez de inferir
comportamento de um enum de categoria.

**Tab 3 (Análise) usa dados do módulo `invoices` via `useInvoicesModule()`.**
Os totais por subcategoria vêm de `listInvoiceLines()` (endpoint `GET /api/invoices/lines`),
cruzado com `cost_center_category_id`. Para aceder sem duplicar a query, o `InvoicesProvider`
envolve toda a rota `/financial/*` no `App.tsx`. Qualquer vista dentro do grupo financeiro
pode usar `useInvoicesModule()`.

**`FinancialBaseProvider` e `InvoicesProvider` são co-dependentes.**
A Tab 3 de `CostCentersView` precisa de ambos os módulos. A solução é o `InvoicesProvider`
envolver o `FinancialBaseProvider` no `App.tsx`, em vez de estar apenas na rota `/financial/invoices`.

**`FINANCIAL_TYPE_LABELS` e `FINANCIAL_TYPE_COLORS` definidos no domínio.**
São constantes de apresentação (labels PT e classes Tailwind), mas pertencem ao domínio
porque expressam semântica de negócio (o que é CMV, CAPEX, etc.). Componentes importam-nos
directamente — evita props drilling e mantém a consistência visual em todos os sítios onde
um `financialType` é exibido.

## Como testar

- Domínio: não há lógica de domínio no frontend — entidades são interfaces TypeScript.
- Testes de UI: a implementar com Vitest + Testing Library.

## Pontos de atenção / dívidas conhecidas

- A pesquisa de fornecedores (`SuppliersView`) filtra apenas no lado do cliente.
  Para grandes listas (>500 fornecedores) seria necessário delegar o filtro ao backend.
- Tab 3 faz `listInvoiceLines()` sem paginação — aceitável para o volume actual; adicionar
  filtros de data se necessário.
- Testes de UI não implementados.
