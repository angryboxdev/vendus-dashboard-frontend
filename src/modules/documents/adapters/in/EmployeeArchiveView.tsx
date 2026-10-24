import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AppIcon,
  FIELD,
  SURFACE,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
} from "../../../../components/ui/index.ts";
import {
  DOCUMENT_FOLDERS,
  archiveByFolder,
  type DocumentFolder,
} from "../../domain/services/document-folders.service.ts";
import { useEmployeeDocuments } from "../../documents.module.tsx";
import { PendingDocumentsSection } from "./DocumentReview.tsx";

const ddmmyyyy = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Documentos dos colaboradores por pastas (Novo RH → Mais → Documentos): cada
 * pasta mostra quantos colaboradores têm documentos nela; ao abrir, a lista de
 * colaboradores com a quantidade e o último arquivamento. O nome abre a ficha
 * (`personHref`, dado pela raiz — este módulo não conhece as rotas do RH).
 */
export function EmployeeArchiveView({
  personHref,
}: {
  personHref: (employeeId: string) => string;
}) {
  const api = useEmployeeDocuments();
  const [folder, setFolder] = useState<DocumentFolder | null>(null);
  const [q, setQ] = useState("");
  const archive = useQuery({
    queryKey: ["novo-rh", "employee-documents", "archive"],
    queryFn: () => api.getDocumentArchive(),
  });
  const by = archiveByFolder(archive.data ?? []);
  const open = folder ? DOCUMENT_FOLDERS.find((f) => f.key === folder)! : null;
  const people = folder
    ? by[folder].filter(
        (p) => !q.trim() || norm(p.employeeName).includes(norm(q.trim())),
      )
    : [];

  if (archive.isLoading)
    return <p className="text-sm text-stone-400">A carregar…</p>;
  if (archive.isError)
    return (
      <p className="text-sm text-red-700">
        Não foi possível carregar o arquivo.
      </p>
    );

  if (!open) {
    return (
      <div className="space-y-5">
        <PendingDocumentsSection personHref={personHref} />
        <section aria-label="Pastas" className="space-y-2">
          <p className="text-sm text-stone-500">
            <span className="font-semibold text-[#C2410C]">
              {DOCUMENT_FOLDERS.length}
            </span>{" "}
            pastas
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {DOCUMENT_FOLDERS.map((f) => {
              const list = by[f.key];
              const docs = list.reduce((s, p) => s + p.count, 0);
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    title={f.hint}
                    onClick={() => (setFolder(f.key), setQ(""))}
                    className="flex h-full w-full flex-col items-center gap-2 rounded-xl border border-[#F5C992]/40 bg-white px-3 py-5 text-center transition-colors duration-150 hover:border-[#C9643A]/50 hover:bg-stone-50/60"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F7E8DF] text-[#C2410C]">
                      <AppIcon name="folder" size={24} />
                    </span>
                    <span className="text-sm font-semibold text-stone-800">
                      {f.label}
                    </span>
                    <span className="text-xs text-stone-500">
                      {list.length === 0
                        ? "Sem elementos"
                        : `${list.length} ${list.length === 1 ? "colaborador" : "colaboradores"} · ${docs} ${docs === 1 ? "documento" : "documentos"}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <section aria-label={open.label} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFolder(null)}
          className="text-sm font-medium text-[#C2410C] hover:underline"
        >
          ‹ Pastas
        </button>
        <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
          <AppIcon name="folder" size={20} className="text-[#C2410C]" />
          {open.label}
        </h2>
        <input
          aria-label="Procurar colaborador"
          placeholder="Procurar colaborador"
          className={`${FIELD} ml-auto w-full sm:w-64`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className={`${SURFACE} overflow-x-auto`}>
        {people.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-500">
            {by[open.key].length === 0
              ? "Esta pasta ainda não tem documentos."
              : "Nenhum colaborador com esse nome."}
          </p>
        ) : (
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Colaborador</th>
                <th className={`${TH} text-right`}>Quantidade</th>
                <th className={TH}>Último arquivamento</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.employeeId} className={TR}>
                  <td className={TD}>
                    <Link
                      to={personHref(p.employeeId)}
                      className="inline-flex items-center gap-2 font-medium text-navy-900 hover:text-[#C2410C] hover:underline"
                    >
                      <AppIcon
                        name="folder"
                        size={18}
                        className="text-[#C2410C]"
                      />
                      {p.employeeName}
                    </Link>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{p.count}</td>
                  <td className={`${TD} tabular-nums text-stone-600`}>
                    {ddmmyyyy(p.lastUploadedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
