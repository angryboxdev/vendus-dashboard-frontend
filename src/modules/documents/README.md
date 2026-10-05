# Módulo: documents

> Status: ativo
> Última atualização: 2026-10-05

## Propósito
Aba **Empresa & Estrutura → Documentos** (`/empresa/documentos`): documentos
cujo dono é a Empresa (apólices, certidões, licenças, contratos
institucionais), sobre o mesmo motor documental dos Colaboradores (módulo
`documents` do backend). Não gere os documentos dos colaboradores — esses
continuam no módulo `hr` (Colaboradores → Documentos / perfil), que usa as
mesmas categorias.

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

## Ports
### Entrada (use cases)
- Listar, enviar (valida antes do pedido), renovar, remover (lógico),
  URL de download, histórico; listar/criar/ativar categorias da Empresa.
### Saída (dependências do domínio)
- `CompanyDocumentsApiPort` — `/api/company-documents` e
  `/api/document-categories?ownerType=company`.

## Adapters
### Entrada (UI)
- `useCompanyDocuments` / `useCompanyDocumentHistory` (react-query).
- `CompanyDocumentsView` — lista, renovar, histórico (linha expansível),
  remover com confirmação, gestão de categorias da Empresa.
- `CompanyDocumentDrawer` — novo documento ou renovação.
### Saída
- `HttpCompanyDocumentsApiAdapter` (multipart via `apiPostFormData`).
- `InMemoryCompanyDocumentsApiAdapter` — testes (dados fictícios).

## Decisões de design (ADR resumido)
- **Só gestão** — `hr_viewer` vê uma mensagem; o backend também só
  responde a `manager`+.
- **Renovar nunca apaga** — a UI diz-o explicitamente; o histórico mostra
  "Atual"/"Substituído".
- **Categorias partilhadas** — criar aqui uma categoria de âmbito Empresa ou
  Ambos usa o mesmo endpoint do ecrã dos Colaboradores; nunca há duas
  listas de categorias.

## Como testar
- `npx vitest run src/modules/documents`

## Pontos de atenção / dívidas conhecidas
- Sem pré-visualização inline do ficheiro — "abrir" usa um URL assinado de
  curta duração num separador novo.
- Prazos de validade ainda não aparecem no calendário (ticket 05).
