import type {
  AirMenuDocumentType,
  AirMenuOrder,
} from "../../domain/entities/air-menu-order.ts";

export const PLATFORM_BADGE: Record<string, string> = {
  Glovo: "bg-yellow-100 text-yellow-800",
  "Uber Eats": "bg-green-100 text-green-800",
  "Bolt Food": "bg-emerald-100 text-emerald-800",
};

export function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_BADGE[platform] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {platform}
    </span>
  );
}

export function DocumentBadge({ type }: { type: AirMenuDocumentType }) {
  if (type === "credit_note") {
    return (
      <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        Nota de Crédito
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      Fatura
    </span>
  );
}

export function OrderRow({
  order,
  onDetail,
  showDocumentCol,
  showPlatformCol = true,
}: {
  order: AirMenuOrder;
  onDetail: (o: AirMenuOrder) => void;
  showDocumentCol: boolean;
  showPlatformCol?: boolean;
}) {
  const docTime = order.documentDate.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const itemsSummary =
    order.items.map((i) => `${i.count}× ${i.title}`).join(", ") || "—";
  const cliente =
    [order.firstName, order.lastName].filter(Boolean).join(" ") || "—";
  const isCreditNote = order.documentType === "credit_note";

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      {showPlatformCol && (
        <td className="px-4 py-3">
          <PlatformBadge platform={order.platform} />
        </td>
      )}
      <td className="px-4 py-3 font-mono text-sm text-gray-600">
        {order.providerOrderId ?? "—"}
      </td>
      {showDocumentCol && (
        <td className="px-4 py-3">
          <DocumentBadge type={order.documentType} />
        </td>
      )}
      <td className="px-4 py-3 text-sm text-gray-600">{docTime}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{cliente}</td>
      <td className="max-w-xs truncate px-4 py-3 text-sm" title={itemsSummary}>
        {itemsSummary}
      </td>
      <td
        className={`px-4 py-3 text-sm font-semibold ${isCreditNote ? "text-red-500" : "text-gray-800"}`}
      >
        €{order.total.toFixed(2)}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDetail(order)}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#E8533F] hover:bg-red-50"
        >
          Ver detalhe
        </button>
      </td>
    </tr>
  );
}
