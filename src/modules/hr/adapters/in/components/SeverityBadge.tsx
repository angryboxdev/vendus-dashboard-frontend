import type { AlertSeverity } from "../../../domain/entities/overview.ts";

/** Texto + ícone + cor — nunca só cor (RH-01 secção 12, acessibilidade). */
const SEVERITY_INFO: Record<AlertSeverity, { label: string; cls: string; icon: string }> = {
  CRITICA: { label: "Crítica", cls: "bg-red-50 text-red-700", icon: "●" },
  ALTA: { label: "Alta", cls: "bg-amber-50 text-amber-700", icon: "▲" },
  MEDIA: { label: "Média", cls: "bg-yellow-50 text-yellow-700", icon: "■" },
  BAIXA: { label: "Baixa", cls: "bg-sky-50 text-sky-700", icon: "○" },
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const info = SEVERITY_INFO[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.cls}`}>
      <span aria-hidden="true">{info.icon}</span>
      {info.label}
    </span>
  );
}
