# Módulo: financial-base

> Status: ativo
> Última atualização: 2026-06-16

## O que é e para que serve (perspectiva de negócio)

A Angrybox tem custos que vêm de muitos sítios diferentes — fornecedores de
ingredientes, serviços de limpeza, rendas, plataformas de marketing, software. Sem
uma estrutura que organize esses custos, é impossível responder a perguntas simples
como "quanto gastámos em operações este mês?" ou "quem é o fornecedor X e qual é o
IBAN dele?".

**O problema que resolve:**
Sem centros de custo, todos os gastos caem num balde único — o manager vê o total
mas não percebe onde o dinheiro está a ir. Sem fornecedores catalogados, cada vez
que chega uma fatura há que voltar a procurar o NIF, o IBAN, as condições de
pagamento. Este módulo cria e mantém essa estrutura base.

**O fluxo do ponto de vista do negócio:**

```
Manager (backoffice)
────────────────────────────────────────────────────
1. Cria os centros de custo da empresa
   (ex: ADM — Administração, OPE — Operações, MKT — Marketing)
2. Cria os fornecedores com os dados necessários
   (NIF, IBAN, condições de pagamento, CC por defeito)
3. À medida que entram faturas, os fornecedores e CCs ficam
   disponíveis para classificação automática e relatórios
4. O manager pode activar/desactivar CCs ou fornecedores
   sem os apagar (preserva o histórico financeiro)
```

**Conceitos-chave para o negócio:**

- **Centro de Custo (CC)** — área ou função da empresa que origina despesas.
  Exemplos: "ADM" (salários, contabilidade), "OPE" (ingredientes, embalagens),
  "MKT" (publicidade, redes sociais). Cada CC tem uma categoria que permite
  agrupamentos mais amplos nos relatórios.
- **Fornecedor** — entidade externa que emite faturas para a Angrybox. Ter o
  fornecedor catalogado com IBAN e condições de pagamento (ex: 30 dias) permite
  ao módulo de faturas alertar sobre vencimentos e pré-preencher dados.
- **CC por defeito do fornecedor** — quando a Makro emite uma fatura, o sistema
  pode sugerir automaticamente o CC "OPE". Poupa tempo na classificação.
- **KPIs por CC** — no detalhe de cada centro de custo é possível ver o total
  faturado, pago e por pagar, calculado a partir das linhas de fatura classificadas
  com esse CC.

---

## Propósito técnico

Gere a UI de master data financeiros: **centros de custo** e **fornecedores**.
É o ponto de entrada visual para classificar despesas por área e para gerir os
fornecedores associados a faturas. NÃO é responsável por mostrar faturas, calcular
totais financeiros globais, nem gerir contas a pagar — esses módulos existem separadamente.

## Conceitos do domínio

- **CostCenter** — entidade com `id`, `code`, `name`, `category`, `status` e campos
  opcionais (`subcategory`, `description`, `responsibleName`).
- **Supplier** — fornecedor com dados de contacto (NIF, email, telefone, morada,
  IBAN), condições de pagamento e `defaultCostCenterId`.
- **CostCenterCategory** — enum de categorias: `administration`, `operations`,
  `marketing`, `logistics`, `hr`, `technology`, `finance`, `real_estate`,
  `app_delivery`, `other`.

## Ports

### Entrada (use cases)

Não há use cases de cliente separados. O módulo expõe `api` diretamente via context,
com os métodos do `FinancialBaseApiPort`.

### Saída (dependências do domínio)

- `FinancialBaseApiPort` — interface com os métodos HTTP:
  `listCostCenters`, `getCostCenter`, `createCostCenter`, `updateCostCenter`,
  `toggleCostCenterStatus`, `listSuppliers`, `createSupplier`, `updateSupplier`,
  `toggleSupplierStatus`.

## Adapters

### Entrada (UI)

- `CostCentersView` — página `/financial/cost-centers`:
  - KPIs globais de faturas (total faturado, pago, por pagar, vencido) — dados
    vindos do módulo `invoices` via `useInvoicesModule()`.
  - Tabela de CCs com código, nome, categoria e estado.
  - Painel lateral de detalhe (`DetailPanel`): dados gerais do CC + tabela lazy
    de faturas associadas (carregadas apenas quando o painel é aberto).
  - Sidebar de vencimentos próximos (`UpcomingDue`).
  - Formulário de criar/editar CC num drawer lateral.
- `SuppliersView` — página `/financial/suppliers`:
  - Tabela de fornecedores com pesquisa por nome.
  - Formulário de criar/editar fornecedor num drawer lateral.
  - Botão de activar/desactivar.

### Saída

- `HttpFinancialBaseApiAdapter` — implementa `FinancialBaseApiPort` usando
  `apiGet`, `apiPost`, `apiPatch` de `src/lib/api.ts`.

## Decisões de design (ADR resumido)

**KPIs de faturas no `CostCentersView` vêm do módulo `invoices`.**
Os totais financeiros por CC são calculados a partir das faturas do módulo `invoices`
(cruzando `invoice_lines.cost_center_id`). Para aceder a esses dados sem duplicar
lógica, o `CostCentersView` usa `useInvoicesModule()`. Isto é possível porque o
`InvoicesProvider` envolve toda a rota `/financial/*` no `App.tsx`.

**Dados de faturas por CC carregados de forma lazy.**
Carregar todas as faturas de todos os CCs na listagem implicaria N queries. Em vez
disso, as faturas por CC só são buscadas quando o painel de detalhe daquele CC é
aberto (`enabled: open && cc !== null`). Os KPIs globais usam a query de todas as
faturas (uma só chamada).

**`FinancialBaseProvider` e `InvoicesProvider` são co-dependentes.**
O `CostCentersView` precisa de ambos os módulos. A solução é o `InvoicesProvider`
envolver o `FinancialBaseProvider` no `App.tsx`, em vez de estar apenas na rota
`/financial/invoices`. Desta forma qualquer vista dentro de `/financial/*` pode
chamar `useInvoicesModule()`.

## Como testar

- Domínio: não há lógica de domínio no frontend — entidades são apenas interfaces TypeScript.
- Testes de UI: a implementar com Vitest + Testing Library.

## Pontos de atenção / dívidas conhecidas

- A pesquisa de fornecedores (`SuppliersView`) filtra apenas no lado do cliente.
  Para grandes listas (>500 fornecedores) seria necessário delegar o filtro ao backend.
- O `DetailPanel` do CC carrega faturas via `useQuery` lazy. Se o utilizador abrir
  e fechar rapidamente vários painéis, podem existir múltiplas queries em paralelo.
  Actualmente aceitável dado o volume esperado.
- Testes de UI não implementados.
