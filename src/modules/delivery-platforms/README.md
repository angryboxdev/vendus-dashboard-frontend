# Módulo: delivery-platforms

> Status: active
> Last updated: 2026-10-28

---

## O que é e para que serve (perspetiva do negócio)

Página **Mapa de rentabilidade → Plataformas de delivery** (`/dre/plataformas`, menu Financeiro): o gestor envia os documentos da Uber Eats, da Glovo e da Bolt Food (e, opcionalmente, o SAF-T do AirMenu) e vê, para o mês do seletor do Mapa, quanto se vendeu em cada plataforma, quanto ela ficou e quanto transferiu.

**O problema que resolve:**
Sem os extratos só se vê o que chega ao banco; não se sabe quanto custaram promoções, comissões e anúncios.

**O fluxo do ponto de vista do negócio:**

```
Gestor                                   Sistema
──────────────────────                  ──────────────────────
1. Escolhe os PDF (até 20)
2. Carrega em «Importar»            →   3. Lê cada extrato e confere com o transferido
                                        4. Mostra importados e rejeitados (com motivo)
5. Vê os extratos do mês            →   6. Totais por plataforma + tabela por extrato
```

**Conceitos-chave para o negócio:**

- **Extrato** — documento da plataforma para um período (Uber: mês; Glovo: quinzena).
- **Atravessa o mês** — o período do extrato tem dias de outro mês; aparece nos dois meses.
- **Bolt** — o relatório de pedidos traz as vendas e as faturas semanais as taxas; o «líquido» é calculado (vendas − faturas).
- **Conferência com o SAF-T** — o faturado no SAF-T do AirMenu (as três plataformas juntas) contra vendas − promoções dos extratos; dá também o IVA médio exato das vendas.
- Valores **com IVA**, como nos extratos. A margem sem IVA é o relatório da fase seguinte.

---

## Propósito técnico

UI de importação e consulta sobre `POST /api/delivery-platforms/import` e `GET /api/delivery-platforms/statements` (backend `delivery-platforms`). Não lê os PDF nem faz contas de negócio: isso é do backend; aqui só se valida a seleção e se somam os totais por plataforma para os cartões.

## Conceitos de domínio

- `PlatformStatementSummary` — contrato da listagem (cêntimos).
- `ImportPlatformDocumentsResult` — `imported` / `rejected` com motivo.
- Regras da vista (`platform-statements-view.ts`, puras): seleção válida (1–20 ficheiros, PDF, CSV ou XML), período «01/09 – 15/09», «atravessa o mês», totais por plataforma (sem o SAF-T), `saftCheck` (faturado × vendas − promoções, IVA médio).

## Portas

### Entrada (casos de uso)

- `ImportPlatformDocumentsPort` — valida a seleção e envia.
- `ListPlatformStatementsPort` — extratos do mês.

### Saída (dependências do domínio)

- `DeliveryPlatformsApiPort` — `importDocuments`, `listStatements`.

## Adapters

### Entrada

- `DeliveryPlatformsView` + `use-delivery-platforms` (React Query; depois de importar invalida a lista). Página `pages/dre/PlataformasPage.tsx`.

### Saída

- `HttpDeliveryPlatformsApiAdapter` → `apiPostFormData` (campo `files`) e `apiGet`.

## Decisões de design

- Mostra os valores com IVA tal como nos extratos, para o gestor os reconhecer; a margem sem IVA fica no relatório por plataforma (F3).
- Permissão da página: `dre.statement` (igual à DRE).

## Como testar

- `npx vitest run src/modules/delivery-platforms` (dados fictícios em `domain/services/fixtures.ts`).

## Lacunas conhecidas / dívida

- A conferência usa os documentos que tocam o mês inteiros (quinzenas/semanas que atravessam o mês distorcem a diferença) — a repartição por dia entra no relatório (F3).
- Relatório de margem por plataforma e exportação Excel/PDF: F3.
