# Módulo: documents

> Status: ativo
> Última atualização: 2026-10-20

## Propósito
Aba **Empresa & Estrutura → Documentos** (`/empresa/documentos`): documentos
cujo dono é a Empresa (apólices, certidões, licenças, contratos
institucionais), sobre o mesmo motor documental dos Colaboradores (módulo
`documents` do backend). Desde a fase 1 da ADR-0040 (2026-10-20) também os
**documentos de colaborador** da ficha do Novo RH (`EmployeeDocumentsPanel`)
e a **importação de recibos** (`ImportPayslipsModal`, em Novo RH →
Documentos), vindos do módulo `hr` (que mantém as suas cópias até à fase 3).

## Conceitos do domínio
- **`CompanyDocument`** — espelho do DTO do backend: categoria, ficheiro,
  emissão, validade, estado (Válido / A expirar / Expirado / …),
  visibilidade, versão, atual/substituído.
- **Visibilidade** — Gestão (gestores e admins) ou Só administração (só
  admins podem escolher; o backend recusa o resto).
- **Categoria** — partilhada com os Colaboradores; aqui só as de âmbito
  Empresa ou Ambos.
- `company-document.service.ts` — `validateCompanyDocumentUpload` (PDF/JPG/
  PNG, 20 MB, validade ≥ emissão), `visibilityOptionsFor`,
  `sortCompanyDocuments` (expirados e a expirar primeiro).
- **Documentos de colaborador** — `EmployeeDocument`, `EmployeeDocumentSummary`
  (resumo da ficha: obrigatórios, em falta, alertas — vem do backend),
  `isCategoryApplicable` (mesma regra do backend), importação de recibos
  (`payslip-import` entidade + serviço).

## Ports
### Entrada (use cases)
- Listar, enviar (valida antes do pedido), renovar, remover (lógico),
  URL de download, histórico; listar/criar/ativar categorias da Empresa.
- `EmployeeDocumentsPort` (`EmployeeDocumentsUseCases`) — documentos de
  colaborador, resumo, categorias, colaboradores e importação de recibos.
### Saída (dependências do domínio)
- `CompanyDocumentsApiPort` — `/api/company-documents` e
  `/api/document-categories?ownerType=company`.
- `EmployeeDocumentsApiPort` — `/api/novo-rh/people/:id/documents*` (+
  `/summary`), `/api/novo-rh/payslips/*`, `/api/novo-rh/people`,
  `/api/document-categories`.

## Adapters
### Entrada (UI)
- `useCompanyDocuments` / `useCompanyDocumentHistory` (react-query).
- `CompanyDocumentsView` — lista, renovar, histórico (linha expansível),
  remover com confirmação, gestão de categorias da Empresa.
- `CompanyDocumentDrawer` — novo documento ou renovação.
- `EmployeeDocumentsPanel` — separador Documentos da ficha do Novo RH; pastas (2026-10-22: Documentos pessoais, Contrato e trabalho, Recibos e faturas, Saúde e formação, Outros — `domain/services/document-folders.service.ts`) só agrupam e filtram a lista pela categoria; categorias periódicas vão para Recibos, as da empresa e «Outro» para Outros. Sem pasta de fotos do ponto (não há fotos nas marcações)
  (encaixado pelo slot `personDocuments`); sem histórico antigo.
- `ImportPayslipsModal` — «Importar recibos» (slot `payslipImport` em Novo
  RH → Documentos). `EmployeeDocumentsProvider` / `useEmployeeDocuments`.
### Saída
- `HttpCompanyDocumentsApiAdapter` (multipart via `apiPostFormData`).
- `InMemoryCompanyDocumentsApiAdapter` — testes (dados fictícios).
- `HttpEmployeeDocumentsApiAdapter` — rotas `/api/novo-rh/*` (em
  Demonstração seguem para a organização de demonstração).

## Decisões de design (ADR resumido)
- **Só gestão** — `hr_viewer` vê uma mensagem; o backend também só
  responde a `manager`+.
- **Renovar nunca apaga** — a UI diz-o explicitamente; o histórico mostra
  "Atual"/"Substituído".
- **Categorias partilhadas** — criar aqui uma categoria de âmbito Empresa ou
  Ambos usa o mesmo endpoint do ecrã dos Colaboradores; nunca há duas
  listas de categorias.
- **Documentos de colaborador sem histórico antigo** (decisão do utilizador,
  ADR-0040): o painel mostra versões, em falta e alertas; o «Histórico
  documental» do RH antigo (`hr_audit_logs`) não passou.

## Como testar
- `npx vitest run src/modules/documents`

## Pontos de atenção / dívidas conhecidas
- Sem pré-visualização inline do ficheiro — "abrir" usa um URL assinado de
  curta duração num separador novo.
- Prazos de validade ainda não aparecem no calendário (ticket 05).
