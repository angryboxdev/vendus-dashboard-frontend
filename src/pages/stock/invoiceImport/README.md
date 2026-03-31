# Importação de fatura de fornecedor

Fluxo em duas fases alinhado com o backend: **upload/parsing** e **confirmação manual** antes de criar movimentações de stock.

## Comportamento no frontend

1. **Upload** — `POST /api/stock/invoice-imports` com `multipart/form-data` e campo `file`. Formatos aceites no UI: **PDF** (com texto selecionável; PDF digitalizado sem texto pode ser rejeitado pelo backend), **JPG, PNG, WebP** (visão). A resposta pode vir já como `ready_for_review` ou `failed` com `header` + `lines`, ou `processing` — nesse caso segue-se o polling.
2. **Polling** — `GET /api/stock/invoice-imports/:id` enquanto `status === processing`.
3. **Revisão** — `needs_review`: escolher `stock_item_id`, ajustar **quantidade de stock** (conversão ex.: 1 PC → 10 un — o servidor aprende o mapeamento), corrigir preço/IVA se necessário. `matched`: sugestão automática (mapeamento anterior); o utilizador pode alterar qtd., unidade, preço, IVA e item antes de confirmar. `ignored`: excluída da aplicação. Cada linha pode trazer **`discount_pct`** (número ou null; 10 = 10%): preços/totais já vêm **após** desconto; o UI mostra valor pré-desconto riscado só para referência. Se `duplicate_warning: true`, o modal de confirmação exige aceitar a substituição.
4. **Confirmação** — `POST .../confirm` com `override_duplicate`, `lines[]` e opcionalmente **`movement_date`** (`YYYY-MM-DD` ou ISO; o servidor normaliza para fim do dia em Lisboa). Se omitido, o backend usa o dia da confirmação. O modal de confirmação permite escolher a data (pré-preenchida com a data da fatura ou hoje).

Nada é aplicado ao stock antes do passo 4.

## Persistência de URL

O `import_id` é guardado na query `?invoice_import=<uuid>` para poder fechar o modal ou atualizar a página e retomar o mesmo fluxo (dependendo do backend devolver o mesmo estado para o `GET`).

## Modo mock (predefinido)

Com `VITE_INVOICE_IMPORT_MOCK` **omitido** ou diferente de `false`/`0`, o frontend usa `invoiceImport.mock.ts`:

- Estado guardado em **sessionStorage** (sobrevive a refresh na mesma sessão).
- Simula ~1,8 s de `processing` antes de `ready_for_review`.
- Ficheiro cujo nome contém `fail` simula erro de parsing.
- Nome com `duplicate` simula `duplicate_warning` e exige `override_duplicate` no confirm.

Para ligar a API real:

```env
VITE_INVOICE_IMPORT_MOCK=false
```

## Ficheiros principais

| Ficheiro | Função |
|----------|--------|
| `invoiceImport.types.ts` | Tipos: cabeçalho, linhas, estados, payload de confirmação |
| `invoiceImport.validation.ts` | Regras de bloqueio/avisos antes de confirmar |
| `invoiceImportApi.ts` | Encaminha mock vs `apiGet` / `apiPostFormData` / `apiPost` |
| `invoiceImport.normalize.ts` | Normaliza import/linhas; cabeçalho **flat** no raiz (`supplier_name`, `invoice_number`, `subtotal`, …) ou objeto `header` / `invoice`; linhas: `unit_price_net`, `line_total_gross`, `vat_rate`, `discount_pct`, `line_status`, etc. |
| `invoiceImport.mock.ts` | Dados de demonstração + sessionStorage |
| `InvoiceImportModal.tsx` | Orquestração do fluxo e URL |
| `components/*` | UI reutilizável (upload, cabeçalho, tabela, confirmação, resultado) |

## Integração backend

- **Upload:** `apiPostFormData` em `src/lib/api.ts` — não enviar `Content-Type` manualmente no `fetch`.
- **Campo do ficheiro:** o mock não valida o nome do campo; alinhar com o backend (aqui assume-se `file`).
- **Confirm body:** `ConfirmInvoiceImportPayload` — inclui `override_duplicate` e `lines` (alinhado ao backend Supabase/OpenAI).

**Referências no stock (backend):** movimentos criados com `created_by = supplier-invoice-import` e `reference = invoice-import:{import_id}`.

## Teste rápido (mock)

1. Itens de stock → **Importar fatura** → enviar um PDF/imagem.
2. Aguardar a pré-visualização; corrigir linhas sem item ou quantidade ≤ 0.
3. **Confirmar e aplicar no stock** → marcar a checkbox no segundo modal.
4. Ver resumo e link para o histórico de movimentos.
