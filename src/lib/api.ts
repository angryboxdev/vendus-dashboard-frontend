import { supabase } from "./supabase";

/** Base URL do backend (sem barra final). Em dev vazio → pedidos relativos e proxy Vite para /api. */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "";

/**
 * Cabeçalhos extra por pedido, definidos por um módulo (ex.: o Novo RH em modo
 * Demonstração junta `X-Novo-RH-Mode: demo` aos seus pedidos). Um de cada vez.
 */
type HeaderProvider = (path: string) => Record<string, string>;
let headerProvider: HeaderProvider | null = null;
export function setRequestHeaderProvider(provider: HeaderProvider | null): void {
  headerProvider = provider;
}
const extraHeaders = (path: string): Record<string, string> => headerProvider?.(path) ?? {};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  readonly status: number;
  /** Corpo JSON já parseado da resposta de erro (quando o backend devolve um, ex.: `{ error, candidate }` no 409 de duplicados). `undefined` quando o corpo não é JSON. */
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function readErrorBody(res: Response): Promise<{ message: string; data: unknown }> {
  const text = await res.text();
  if (!text) return { message: `HTTP ${res.status}`, data: undefined };
  try {
    const parsed = JSON.parse(text) as unknown;
    const errorField = (parsed as { error?: unknown } | null)?.error;
    const message = typeof errorField === "string" && errorField.length > 0 ? errorField : text;
    return { message, data: parsed };
  } catch {
    return { message: text, data: undefined };
  }
}

async function request(
  path: string,
  options: { method: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal } = { method: "GET" },
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders, ...extraHeaders(path), ...options.headers };
  if (options.body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method: options.method,
    headers,
    body: options.body,
    ...(options.signal && { signal: options.signal }),
  });
  if (!res.ok) {
    const { message, data } = await readErrorBody(res);
    // Novo RH (TK-4): perfil/estado alterado → as sessões abertas foram revogadas; terminar esta.
    if (res.status === 401 && (data as { code?: unknown } | undefined)?.code === "SESSION_REVOKED") await supabase.auth.signOut();
    throw new ApiError(message, res.status, data);
  }
  return res;
}

/**
 * Padrão novo (ADR-0022 do backend): leitura com a versão do registo (ETag)
 * e escrita com Idempotency-Key + If-Match. Erros RFC 7807 chegam em
 * `ApiError.data` (type, detail, campos de extensão).
 */
export async function apiGetVersioned<T>(path: string): Promise<{ data: T; etag: string | null }> {
  const res = await request(path);
  return { data: (await res.json()) as T, etag: res.headers.get("ETag") };
}

export async function apiWrite<T>(
  path: string,
  options: { method?: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; idempotencyKey?: string; ifMatch?: string | null },
): Promise<{ data: T; etag: string | null }> {
  const headers: Record<string, string> = { "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID() };
  if (options.ifMatch) headers["If-Match"] = options.ifMatch;
  const res = await request(path, {
    method: options.method ?? "POST",
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
    headers,
  });
  return { data: (await res.json()) as T, etag: res.headers.get("ETag") };
}

/** `signal` (opcional): cancela o pedido quando deixa de interessar (ex.: TanStack Query ao mudar de contexto). */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await request(path, { method: "GET", ...(signal && { signal }) });
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

/** PATCH com resposta 204 sem corpo. */
export async function apiPatchNoContent(path: string, body: unknown): Promise<void> {
  await request(path, { method: "PATCH", body: JSON.stringify(body) });
}

/** DELETE com resposta 204 sem corpo. */
export async function apiDeleteNoContent(path: string): Promise<void> {
  await request(path, { method: "DELETE" });
}

/** DELETE que devolve JSON no corpo (ex.: soft delete de funcionário). */
export async function apiDeleteJson<T>(path: string): Promise<T> {
  const res = await request(path, { method: "DELETE" });
  return res.json() as Promise<T>;
}

/** @deprecated Prefer apiDeleteNoContent or apiDeleteJson */
export async function apiDelete(path: string): Promise<void> {
  await apiDeleteNoContent(path);
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await request(path);
  return res.blob();
}

/** POST multipart (ex.: upload de ficheiro). Não definir Content-Type — o browser define o boundary. */
export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders, ...extraHeaders(path) },
    body: formData,
  });
  if (!res.ok) {
    const { message, data } = await readErrorBody(res);
    throw new ApiError(message, res.status, data);
  }
  return res.json() as Promise<T>;
}

/**
 * POST multipart cuja resposta é um ficheiro. Devolve o conteúdo e o nome sugerido
 * pelo backend (Content-Disposition), ou `null` se o cabeçalho não for legível.
 */
export async function apiPostFormDataFile(
  path: string,
  formData: FormData,
): Promise<{ blob: Blob; fileName: string | null }> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, { method: "POST", headers: { ...authHeaders, ...extraHeaders(path) }, body: formData });
  if (!res.ok) {
    const { message, data } = await readErrorBody(res);
    throw new ApiError(message, res.status, data);
  }
  const fileName = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? null;
  return { blob: await res.blob(), fileName };
}

/** POST de um ficheiro em bruto (ex.: áudio para transcrever) com o seu Content-Type. */
export async function apiPostBinary<T>(path: string, body: Blob, contentType: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, { method: "POST", headers: { ...authHeaders, ...extraHeaders(path), "Content-Type": contentType }, body });
  if (!res.ok) {
    const { message, data } = await readErrorBody(res);
    throw new ApiError(message, res.status, data);
  }
  return res.json() as Promise<T>;
}
