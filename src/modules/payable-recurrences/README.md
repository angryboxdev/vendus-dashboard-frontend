# Módulo: payable-recurrences

> Status: ativo
> Última atualização: 2026-08-21

## Propósito
Gere recorrências financeiras (contratos, serviços recorrentes, salários, etc.) e as suas ocorrências mensais no frontend. Permite listar, criar, editar e controlar o ciclo de vida de cada recorrência, bem como gerir as ocorrências associadas (vincular faturas, gerar contas a pagar, anexar documentos). Não é responsabilidade deste módulo criar faturas diretamente nem gerir contas a pagar fora do contexto de uma ocorrência.

## Conceitos do domínio

- **RecurrenceDTO** — compromisso periódico com fornecedor; tem tipo, frequência, valor estimado e dia de vencimento.
- **OccurrenceDTO** — instância mensal de uma recorrência; passa por estados: `forecast | awaiting_invoice | invoice_linked | paid | cancelled`. Estado terminal: `paid`. Inclui `linkedBankMovement: { id, bookingDate, amountCents, description } | null` — preenchido quando um débito bancário foi justificado com esta ocorrência.
- **linkedBankMovement** — quando presente, indica que o pagamento desta ocorrência foi identificado no extrato bancário. Exibido como badge "Banco" na coluna homónima da tabela de ocorrências de `RecurrenceDetailView`.
- **nextDueDate** — calcula a próxima data de vencimento a partir do `dayOfMonth` e da data atual.
- **expectedDocumentLabel** — deriva o tipo de documento esperado (Fatura, Contrato, etc.) a partir de `requireInvoice` e `type`.
- **autoCreatePayable** — só disponível para tipos que não sejam `variable_invoice` ou `fiscal`; enforçado no UI.

## Ports

### Entrada (use cases)
Não há use cases formais; a lógica de UI é orquestrada diretamente nos adapters de entrada usando TanStack Query.

### Saída (dependências do domínio)
- `RecurrencesApiPort` — todas as operações REST:
  - `getSummary()` — `awaitingInvoiceCount` para KPI do header.
  - CRUD de recorrências + ações de estado (`pause/resume/close`) + upload de documento.
  - `listOccurrences`, `getOccurrence`, `generateOccurrence`, `cancelOccurrence`.
  - `linkInvoiceToOccurrence` — vincula fatura e actualiza valor real.
  - `markOccurrenceAsPaid` — regista pagamento directo na ocorrência (`paidAt?`, `paymentMethod?`, `paymentBankAccountId?`).
  - `getLinkedInvoiceIds()` — IDs de faturas já vinculadas (para filtrar o seletor de faturas no UI).
  - `getOccurrenceByInvoiceId()` — lookup inverso: dada uma fatura, devolve a ocorrência + nome da recorrência.
  - Upload/delete de documento por ocorrência.

## Adapters

### Entrada (UI)
- `RecurrencesView` — página de listagem em `/financial/payable-recurrences`, com KPIs, filtros e tabela.
- `RecurrenceDetailView` — página de detalhe em `/financial/payable-recurrences/:id`, com resumo, ocorrências mensais, documentos e próximos pagamentos. A tabela de ocorrências inclui coluna "Banco": quando `linkedBankMovement` está preenchido, exibe badge com valor e data do débito bancário identificado; caso contrário exibe "—".
- `RecurrenceDrawer` — drawer lateral reutilizável para criar e editar recorrências; usa `useFinancialBaseModule` para obter fornecedores e centros de custo.

### Saída
- `HttpRecurrencesApiAdapter` — implementa `RecurrencesApiPort` usando os helpers `apiGet/apiPost/apiPatch/apiPostFormData/apiDeleteNoContent` de `src/lib/api.ts`. Base URL: `/api/payable-recurrences`.

## Decisões de design

- **D1**: RecurrenceDetailView é uma página roteada (não um drawer), pois o volume de informação (resumo + ocorrências + documentos + próximos pagamentos) justifica o espaço de ecrã completo.
- **D2**: `RecurrenceDrawer` é reutilizado para criação e edição; o campo `startDate` é omitido no modo de edição (imutável no backend).
- **D3**: KPIs da listagem: contagens de recorrências (activa/pausada/encerrada) calculadas client-side a partir da lista. "Aguardando fatura" vem do endpoint `GET /summary` (`awaitingInvoiceCount`) — sem N+1 queries.
- **D4**: Upload de documento na criação: a recorrência é criada primeiro e depois o documento é enviado num segundo pedido. Se o upload falhar, a recorrência existe mas sem documento.
- **D5**: `autoCreatePayable` é desabilitado no UI para tipos `variable_invoice` e `fiscal` (o backend rejeita, mas prevenimos antes).
- **D6**: O módulo usa `useFinancialBaseModule()` para aceder à lista de fornecedores e grupos de centros de custo no drawer — não duplica a lógica de supplier/CC.

## Como testar
- Funções puras: `npx vitest run src/modules/payable-recurrences` — cobre `expectedDocumentLabel`, `nextDueDate`, `formatPeriod` (15 testes, 0 falhos).
- Componentes React: sem testes automatizados (requerem DOM + mocks de API — fora do scope actual).

## Pontos de atenção / dívidas conhecidas
- Sidebar test `nav-state.service.test.ts` verifica a contagem de entradas de topo-nível — este teste já falhava antes deste módulo (air-menu e vendus foram adicionados à árvore sem actualizar o teste). A adição de "Recorrências" é um sub-item do grupo `financial` e não afecta a contagem de topo.
- Vista de Calendário (toggle na listagem) — fora de scope, não implementada.
- Geração em lote (`/batch/generate`) — sem UI, é funcionalidade de cron/admin.
- "Vincular fatura" pede o ID da fatura manualmente; não há lookup por número de fatura no backend ainda.
