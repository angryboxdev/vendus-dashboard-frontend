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
- **Margem por plataforma** — da venda com IVA à margem bruta (depois da plataforma) e à margem líquida (depois da comida, estimada em 30%), com IVA a entregar; exporta em Excel e PDF. Documentos que atravessam o mês contam só a parte do mês (pelo SAF-T diário).
- **Conferência com o SAF-T** — o faturado no SAF-T do AirMenu (as três plataformas juntas) contra vendas − promoções dos extratos, já só com a parte do mês.
- **Transferências** — cada transferência que paga vendas do mês (semana da Uber, quinzena da Glovo, semana da Bolt) contra o crédito que entrou no banco: bate, diferença, por receber ou em falta; créditos sem documento à parte.
- A lista dos documentos mostra os valores **com IVA**, como vêm.

---

## Propósito técnico

UI de importação e consulta sobre `POST /api/delivery-platforms/import` e `GET /api/delivery-platforms/statements` (backend `delivery-platforms`). Não lê os PDF nem faz contas de negócio: isso é do backend; aqui só se valida a seleção e se somam os totais por plataforma para os cartões.

## Conceitos de domínio

- `PlatformStatementSummary` — contrato da listagem (cêntimos).
- `ImportPlatformDocumentsResult` — `imported` / `rejected` com motivo.
- Regras da vista (`platform-statements-view.ts`, puras): seleção válida (1–20 ficheiros, PDF, CSV ou XML), período «01/09 – 15/09», «atravessa o mês», totais por plataforma (sem o SAF-T); `margin-report-view.ts` — linhas do quadro da margem (as mesmas do PDF/Excel). O cálculo da margem e a repartição pelo mês são do backend (`MarginReport`).

## Portas

### Entrada (casos de uso)

- `ImportPlatformDocumentsPort` — valida a seleção e envia.
- `ListPlatformStatementsPort` — extratos do mês.
- `GetPayoutReconciliationPort` — conferência das transferências do mês (`PayoutsCard`).
- `GetPlatformMarginReportPort` / `ExportPlatformMarginReportPort` — margem do mês; descarregar em Excel/PDF.

### Saída (dependências do domínio)

- `DeliveryPlatformsApiPort` — `importDocuments`, `listStatements`, `getMarginReport`, `exportMarginReport`, `getPayoutReconciliation`.
- `FileDownloaderPort` — entrega o ficheiro exportado (`BrowserFileDownloaderAdapter`).

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

- Os cartões e a tabela dos documentos mostram os documentos inteiros (com IVA); só o quadro da margem reparte pelo mês.
- A DRE ainda não usa este relatório (F3b).
