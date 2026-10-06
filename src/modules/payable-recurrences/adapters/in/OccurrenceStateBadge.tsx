import { type OccurrenceDisplayState, OCCURRENCE_DISPLAY_STATE_LABELS } from "../../domain/entities/recurrence.ts";

const OCC_DISPLAY_STATE_COLORS: Record<OccurrenceDisplayState, string> = {
  awaiting_invoice: "bg-amber-50 text-amber-700",
  awaiting_payment: "bg-blue-50 text-blue-700",
  partially_paid: "bg-orange-50 text-orange-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  cancelled: "bg-stone-100 text-stone-500",
};

const OCC_DISPLAY_STATE_DOT: Record<OccurrenceDisplayState, string> = {
  awaiting_invoice: "bg-amber-500",
  awaiting_payment: "bg-blue-400",
  partially_paid: "bg-orange-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  cancelled: "bg-stone-400",
};

export function OccurrenceStateBadge({ state }: { state: OccurrenceDisplayState }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${OCC_DISPLAY_STATE_COLORS[state]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${OCC_DISPLAY_STATE_DOT[state]}`} />
      {OCCURRENCE_DISPLAY_STATE_LABELS[state]}
    </span>
  );
}
