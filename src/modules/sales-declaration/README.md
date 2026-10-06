# Módulo: sales-declaration

> Status: ativo
> Última atualização: 2026-10-06

## Propósito

Página **Financeiro → Declaração de Vendas** (`/financial/sales-declaration`): o gestor escolhe os SAF-T (Vendus e AirMenu) e descarrega o Excel do Mercado Bom Sucesso com o valor diário sem IVA. Não lê nem calcula nada: o backend interpreta os SAF-T (módulo `sales-declaration`). Não mostra pré-visualização.

## Conceitos do domínio

- **SaftUpload** — `{ name, content: ArrayBuffer }`.
- **Ficheiros válidos** — de 1 a 10, todos `.xml` (`validateSaftFiles`, mesmo limite do backend).

## Ports

### Entrada (use cases)

- `ExportSalesDeclarationPort` — valida os ficheiros, envia-os, e entrega o Excel ao utilizador; lança `InvalidSalesDeclarationRequestError` se inválidos.

### Saída (dependências do domínio)

- `SalesDeclarationApiPort` — `exportFromSaft(files)` → ficheiro gerado (`ArrayBuffer` + nome).
- `FileDownloaderPort` — `save(file)` → entrega o ficheiro ao utilizador.

## Adapters

### Entrada (UI)

- `SalesDeclarationView` (componente) + `useSalesDeclaration` (hook): escolha/remoção de ficheiros (sem duplicar nomes), estado "A gerar…" e erros.

### Saída

- `HttpSalesDeclarationApiAdapter` → `POST /api/sales-declaration/export` (multipart) via `apiPostFormDataFile` (`lib/api.ts`), que devolve o blob e o nome do `Content-Disposition`.
- `BrowserFileDownloaderAdapter` → `Blob` + `<a download>`.

## Decisões de design (ADR resumido)

- **Upload de SAF-T em vez de consultar as APIs** (2026-10-06): as páginas Vendus/AirMenu e o fiscal divergiam (IVA do catálogo AirMenu, emparelhamento FS/NC); o SAF-T é exato. Ver o README do backend.
- **`ArrayBuffer` no domínio, `File`/`Blob` só nos adapters**: o domínio não pode depender de APIs de browser.
- **Nome do ficheiro vem do backend** (período dos SAF-T); se o cabeçalho não for legível, usa `SalesReport_SAFT.xlsx`.
- **Dentro de Financeiro, sem item de topo no menu.**

## Como testar

- Domínio/use cases/UI: `npx vitest run src/modules/sales-declaration`

## Pontos de atenção / dívidas conhecidas

- Sem pré-visualização dos valores antes de descarregar.
- O front só valida a extensão `.xml`; a validação do conteúdo é do backend.
