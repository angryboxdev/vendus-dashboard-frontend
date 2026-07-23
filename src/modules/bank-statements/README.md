# Módulo: bank-statements (Frontend)

> Status: ativo
> Última atualização: 2026-07-23

---

## O que é e para que serve (perspectiva de negócio)

Permite ao gestor importar extratos bancários (CSV/XLSX), ver o "espelho do banco" e conciliar cada movimento com documentos financeiros (faturas, contas a pagar) ou classificá-los manualmente com comprovativo, centro de custo, fornecedor e IVA.

**O problema que resolve:**
Sem este módulo, o gestor teria de reconciliar manualmente cada linha do extrato bancário contra documentos em papel ou noutra ferramenta, sem visibilidade de progresso nem deteção automática de padrões.

**O fluxo do ponto de vista do negócio:**

```
Gestor
──────────────────────────────────────────────────
1. Importa ficheiro CSV/XLSX do banco (+ metadados)
2. Vê lista de extratos importados
3. Abre extrato → espelho do banco
4. Aplica regras automáticas
5. Pede sugestões de correspondência
6. Por cada movimento não resolvido, clica "Classificar":
   a. Tab "Conciliar com sistema" — seleciona uma ou mais faturas/contas a pagar
      (candidatos automáticos + pesquisa livre por nome/número).
      O sistema só mostra entidades ainda não conciliadas com outro movimento;
      tentar associar uma fatura já tomada resulta em erro visível em toast.
   b. Tab "Justificar despesa" — escolhe sub-tipo, opcionalmente
      sobe comprovativo, seleciona fornecedor, centro de custo
      (grupo → categoria) e registo de IVA
7. Fecha extrato quando diferença = 0
```

**Conceitos-chave para o negócio:**

- **Extrato** — conjunto de movimentos de um período, de uma conta bancária.
- **Movimento** — linha do extrato (débito ou crédito) com estado de reconciliação.
- **Conciliação** — associação de um movimento a um ou mais documentos (faturas ou contas a pagar) ou classificação manual.
- **Conciliação parcial** — movimento já associado a entidades, mas com diferença de montante superior a 1€; não conta como resolvido.
- **Exclusividade de conciliação** — cada fatura ou conta a pagar só pode estar associada a um movimento de cada vez. O sistema oculta automaticamente entidades já tomadas e devolve erro (toast) se o utilizador tentar associar uma fatura já conciliada.
- **Progresso** — % de movimentos em estado "resolvido" (conciliado c/ ou s/ fatura, transferência interna, ignorado).
- **Regra automática** — padrão de texto que classifica movimentos automaticamente.
- **Comprovativo** — ficheiro (PDF/imagem) que justifica uma despesa sem fatura no sistema.
- **Centro de custo** — hierarquia grupo → categoria que classifica a despesa para efeitos de DRE/cashflow.
- **IVA** — taxa percentual + flag de inclusão (incluído/excluído/isento) registada no movimento.

---

## Propósito técnico

Adapter de entrada (UI) que expõe as operações do backend `bank-statements` ao gestor. Consome a API via `BankStatementsApiPort`; não contém lógica de negócio. Para as listas de fornecedores e centros de custo, delega directamente nos hooks de `financial-base`; para pesquisa de faturas, delega no hook de `invoices`.

## Conceitos do domínio

Definidos em `domain/entities/bank-statement.ts`:
- `ReconciliationStatus` — inclui `conciliado_parcial` (não resolvido), `JustificationType`, `RiskLevel`, `MovementType`, `StatementStatus`
- `EntityLinkDTO` — ligação entre um movimento e uma entidade (`entityType`, `entityId`, `amountCents`, `entityLabel`)
- `BankMovementDTO` — inclui `entityLinks: EntityLinkDTO[]` e `reconciliationAmountDiff: number | null` (diferença montante vs soma dos links; `null` se não aplicável)
- `BankStatementSummaryDTO`, `BankStatementDetailDTO`
- `ClassifyMovementPayload` — inclui `documentUrl?`, `costCenterGroupId?`, `costCenterCategoryId?`, `supplierId?`, `vatRate?`, `vatIncluded?`
- Label maps e `RESOLVED_STATUSES`

## Ports

### Saída (dependências do domínio)

- `BankStatementsApiPort` — todas as operações HTTP:
  - `importStatement`, `listStatements`, `getStatement`
  - `applyAutoRules`, `suggestMatches`, `closeStatement`, `deleteStatement`, `updateBalances`
  - `reconcileMovement(movementId, entityLinks[])` — suporta multi-entidade; cada link tem `entityType`, `entityId`, `supplierId?`
  - `uploadMovementDocument(movementId, file)` → `{ documentUrl }` — upload de comprovativo (passo 1 de 2)
  - `findMovementCandidates`
  - `listRules`, `createRule`, `deleteRule`

## Adapters

### Entrada

- `BankStatementsView` — view principal; alternância lista ↔ detalhe por `selectedId`

  Sub-componentes internos:
  - `StatementsList` + `StatementCard` — grelha de extratos importados com barra de progresso
  - `StatementDetail` — espelho do banco: KPIs de saldos, tabs de movimentos, tabela com badges, ações
  - `ImportModal` — upload de CSV/XLSX + metadados (bankName, accountNumber, openingBalance, closingBalance, período)
  - `ClassifyDrawer` — painel lateral com dois tabs:
    - **"Conciliar com sistema"** — candidatos automáticos (`findMovementCandidates`) + pesquisa livre de faturas por nome do fornecedor ou número; deduplicação entre as duas listas
    - **"Justificar despesa"** — sub-tipos (`recibo_comprovativo`, `despesa_bancaria_automatica`, `contrato_recorrencia`, `transferencia_interna`, `emprestimo_financiamento`, `sem_justificativa`); upload de comprovativo em dois passos; combobox de fornecedor com auto-fill de centro de custo; cascata grupo→categoria; registo de IVA (três modos: incluído/excluído/isento + botões de taxa)
  - Linhas com status `sugestao` mostram apenas "Classificar" (não há botão "Confirmar" separado)

### Saída

- `HttpBankStatementsApiAdapter` — implementa `BankStatementsApiPort` usando `apiGet`, `apiPost`, `apiPatch`, `apiDeleteNoContent`, `apiPostFormData` de `lib/api.ts`; base URL `/api/bank-statements`

## Decisões de design (ADR resumido)

- **CSV/XLSX processado no backend**: o frontend faz `multipart/form-data` upload; não toca nos dados do ficheiro.
- **Sem sub-rotas**: a navegação lista ↔ detalhe é feita por estado local (`selectedId`) dentro de `BankStatementsView`, evitando URLs voláteis para um ecrã transacional.
- **React Query**: todas as queries e mutations usam `@tanstack/react-query` para cache e invalidação automática.
- **Provider aninhado dentro de `PayableEntriesProvider`**: segue o padrão dos outros módulos financeiros em `App.tsx`.
- **Upload de comprovativo em dois passos**: `POST /movements/:id/document` devolve `{ documentUrl }`; essa URL é depois incluída no `classifyMovement`. O domínio recebe um comando coeso sem dependência de I/O de storage.
- **Cross-module UI sem port dedicado**: `ClassifyDrawer` usa `useFinancialBaseModule()` e `useInvoicesModule()` directamente (válido porque todos os providers estão no scope da árvore). Os IDs ficam guardados no movimento; o lookup reverso (nomes) é feito no frontend via join local.
- **VAT como taxa + flag**: armazena `vatRate` (número %) + `vatIncluded` (boolean | null); o valor base é calculado nos relatórios sem necessidade de re-submissão.
- **Erros de negócio como toast, não como alert**: `onError` das mutations usa `showToast(e.message, "error")`. O `ToastContainer` tem `z-[200]` para aparecer acima de modais e drawers (`z-50`).
- **`balanceAfter` calculado ao vivo**: o backend recalcula a coluna "Saldo após" de cada movimento a partir do `openingBalance` — o frontend não precisa de recalcular nem de re-fetch extra ao editar o saldo inicial.

## Como testar

```bash
cd vendus-dashboard-frontend
npx vitest run
```

## Pontos de atenção / dívidas conhecidas

- Gestão de regras de reconciliação (listagem/criação/eliminação) ainda não está exposta na UI — os endpoints existem no backend mas não há ecrã dedicado no frontend.
- A ação "Sugerir correspondências" exibe resultados em toast; uma UI de confirmação por sugestão melhoraria a UX.
- O bucket `bank-statement-documents` no Supabase Storage deve ser criado manualmente com política de acesso público de leitura (necessário para o upload de comprovativos funcionar).
