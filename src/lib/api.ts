const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request(
  path: string,
  options: { method: string; body?: string } = { method: "GET" },
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: options.method,
    headers:
      options.body != null ? { "Content-Type": "application/json" } : undefined,
    body: options.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  await request(path, { method: "DELETE" });
}

/** POST multipart (ex.: upload de ficheiro). Não definir Content-Type — o browser define o boundary. */
export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
