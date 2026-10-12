/** Erros e ligações (FE-004/FE-006): o que mostrar ao utilizador, sem dados pessoais. */

export interface ErrorInfo {
  status: number | null;
  message: string;
  /** ID de correlação devolvido pelo backend (RFC 7807), para o suporte. */
  correlationId: string | null;
}

export function describeError(e: unknown, fallback: string): ErrorInfo {
  if (!(e instanceof Error)) return { status: null, message: fallback, correlationId: null };
  const raw = (e as { status?: unknown }).status;
  const status = typeof raw === "number" ? raw : null;
  const data = (e as { data?: unknown }).data;
  const body = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const correlationId = typeof body.correlationId === "string" ? body.correlationId : null;
  const detail = typeof body.detail === "string" && body.detail ? body.detail : e.message;
  return { status, message: detail || fallback, correlationId };
}

/** Só rotas internas da aplicação (evita redirecionamentos abertos): "/x", nunca "//x" nem "https:". */
export function safeInternalLink(link: string | null | undefined): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.includes("\\")) return null;
  return link;
}

/** Detalhes para copiar: ID, hora e modelo da rota (sem parâmetros nem query). */
export function errorDetails(info: ErrorInfo, routePattern: string, now: Date): string {
  return [`ID: ${info.correlationId ?? "—"}`, `Estado: ${info.status ?? "—"}`, `Hora: ${now.toISOString()}`, `Rota: ${routePattern}`].join("\n");
}
