import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router-dom";
import { fetchExpiringContracts } from "./hrApi";

function ExpiringContractsBadge() {
  const { data } = useQuery({
    queryKey: ["hr", "expiring-contracts"],
    queryFn: () => fetchExpiringContracts(30),
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.length === 0) return null;

  const urgent = data.filter((c) => c.daysRemaining <= 7).length;
  const badgeClass = urgent > 0
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <Link
      to="/hr/employees"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
      title={data.map((c) => `${c.fullName} — ${c.daysRemaining}d`).join("\n")}
    >
      ⚠ {data.length} contrato{data.length > 1 ? "s" : ""} a expirar
    </Link>
  );
}

export function HrLayout() {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              Gestão de funcionários
            </h1>
            <ExpiringContractsBadge />
          </div>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
