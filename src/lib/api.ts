import { supabase } from "./supabase";

/** Base URL do backend (sem barra final). Em dev vazio → pedidos relativos e proxy Vite para /api. */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "";

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
  options: { method: string; body?: string } = { method: "GET" },
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders };
  if (options.body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method: options.method,
    headers,
    body: options.body,
  });
  if (!res.ok) {
    const { message, data } = await readErrorBody(res);
    throw new ApiError(message, res.status, data);
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path);
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
    headers: authHeaders,
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
  const res = await fetch(url, { method: "POST", headers: authHeaders, body: formData });
  if (!res.ok) {
    const { message, data } = await readErrorBody(res);
    throw new ApiError(message, res.status, data);
  }
  const fileName = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? null;
  return { blob: await res.blob(), fileName };
}
