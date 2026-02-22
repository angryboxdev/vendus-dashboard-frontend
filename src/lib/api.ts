export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}
