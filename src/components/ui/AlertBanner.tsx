import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "./icons.tsx";

/** Alerta de página — só quando há algo que exige atenção. */
export type AlertTone = "warning" | "danger" | "success" | "info";

const TONE: Record<AlertTone, { box: string; icon: ReactNode; title: string }> = {
  warning: { box: "border-amber-200 bg-amber-50/70", icon: <IconAlert size={18} className="text-amber-600" />, title: "text-amber-900" },
  danger: { box: "border-red-200 bg-red-50/70", icon: <IconAlert size={18} className="text-red-600" />, title: "text-red-900" },
  success: { box: "border-emerald-200 bg-emerald-50/70", icon: <IconCheck size={18} className="text-emerald-600" />, title: "text-emerald-900" },
  info: { box: "border-[#F5C992]/60 bg-[#FDF8F5]", icon: <IconInfo size={18} className="text-stone-500" />, title: "text-stone-900" },
};

export function AlertBanner({ tone, title, children, action }: { tone: AlertTone; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const t = TONE[tone];
  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 ${t.box}`} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className={`font-semibold ${t.title}`}>{title}</p>
        {children && <div className="text-stone-700">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
