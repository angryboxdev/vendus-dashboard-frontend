import type { CrmSegment } from "../crm.types";

const segmentMeta: Record<
  CrmSegment,
  { label: string; className: string }
> = {
  "SEG-01": {
    label: "SEG-01 Novo",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  "SEG-02": {
    label: "SEG-02 Retorno",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  "SEG-03": {
    label: "SEG-03 Regular",
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
  "SEG-04": {
    label: "SEG-04 VIP",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  "SEG-05": {
    label: "SEG-05 Risco",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  "SEG-06": {
    label: "SEG-06 Hibernar",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  "SEG-07": {
    label: "SEG-07 Carrinho",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  INATIVO: {
    label: "Inativo",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

type Props = {
  segment: CrmSegment;
  short?: boolean;
};

export function SegmentBadge({ segment, short = false }: Props) {
  const meta = segmentMeta[segment] ?? segmentMeta["INATIVO"];
  const label = short ? segment : meta.label;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {label}
    </span>
  );
}
