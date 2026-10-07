import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";

/** Início: aviso de documentos vencidos / a vencer que o colaborador pode substituir (leva a Documentos). */
export function DocumentsAlert() {
  const { selfService } = useEmployeePortalModule();
  const { data } = useQuery({ queryKey: ["portal-documents"], queryFn: () => selfService.listDocuments(), retry: false });
  const count = data?.filter((d) => d.canReplace).length ?? 0;
  if (count === 0) return null;
  return (
    <Link to="/portal/documentos" className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
      <strong>
        {count} {count === 1 ? "documento vencido ou a vencer" : "documentos vencidos ou a vencer"}
      </strong>
      <span className="block text-xs">Toque para enviar o novo (PDF ou foto).</span>
    </Link>
  );
}
