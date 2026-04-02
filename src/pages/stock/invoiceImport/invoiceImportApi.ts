import { apiGet, apiPatch, apiPost, apiPostFormData } from "../../../lib/api";
import { normalizeInvoiceImportDetail } from "./invoiceImport.normalize";
import type {
  ConfirmInvoiceImportPayload,
  ConfirmInvoiceImportResponse,
  CreateInvoiceImportResponse,
  InvoiceImportDetail,
  UpdateInvoiceImportPayload,
} from "./invoiceImport.types";
import {
  mockConfirmInvoiceImport,
  mockCreateInvoiceImport,
  mockGetInvoiceImport,
  mockUpdateInvoiceImport,
} from "./invoiceImport.mock";

/**
 * `true` (default): usa mock com persistência em sessionStorage (sobrevive a refresh).
 * Defina `VITE_INVOICE_IMPORT_MOCK=false` para chamar o backend real.
 */
export function isInvoiceImportMockEnabled(): boolean {
  const v = import.meta.env.VITE_INVOICE_IMPORT_MOCK;
  if (v === "false" || v === "0") return false;
  return true;
}

const UPLOAD_PATH = "/api/stock/invoice-imports";

export async function createInvoiceImport(file: File): Promise<CreateInvoiceImportResponse> {
  if (isInvoiceImportMockEnabled()) {
    await delay(400);
    return mockCreateInvoiceImport(file);
  }
  const fd = new FormData();
  fd.append("file", file);
  const json = await apiPostFormData<unknown>(UPLOAD_PATH, fd);
  const detail = normalizeInvoiceImportDetail(json);
  if (!detail) {
    throw new Error(
      "Resposta inválida do servidor (falta o identificador da importação).",
    );
  }
  return {
    import_id: detail.import_id,
    status: detail.status,
    header: detail.header,
    lines: detail.lines,
    message: detail.message,
    filename: detail.filename,
    duplicate_warning: detail.duplicate_warning,
    duplicate_of_import_id: detail.duplicate_of_import_id,
    parse_error: detail.parse_error,
  };
}

export async function getInvoiceImport(importId: string): Promise<InvoiceImportDetail> {
  if (isInvoiceImportMockEnabled()) {
    return mockGetInvoiceImport(importId);
  }
  const json = await apiGet<unknown>(`${UPLOAD_PATH}/${importId}`);
  const detail = normalizeInvoiceImportDetail(json, importId);
  if (!detail) {
    throw new Error("Resposta inválida ao carregar a importação.");
  }
  return detail;
}

export async function updateInvoiceImport(
  importId: string,
  payload: UpdateInvoiceImportPayload,
): Promise<InvoiceImportDetail> {
  if (isInvoiceImportMockEnabled()) {
    await delay(300);
    return mockUpdateInvoiceImport(importId, payload);
  }
  const json = await apiPatch<unknown>(`${UPLOAD_PATH}/${importId}`, payload);
  const detail = normalizeInvoiceImportDetail(json, importId);
  if (!detail) throw new Error("Resposta inválida ao atualizar cabeçalho.");
  return detail;
}

export async function confirmInvoiceImport(
  importId: string,
  payload: ConfirmInvoiceImportPayload,
): Promise<ConfirmInvoiceImportResponse> {
  if (isInvoiceImportMockEnabled()) {
    await delay(500);
    return mockConfirmInvoiceImport(importId, payload);
  }
  return apiPost<ConfirmInvoiceImportResponse>(
    `${UPLOAD_PATH}/${importId}/confirm`,
    payload,
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
