import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { EmployeeProfile } from "../../domain/entities/employee.ts";
import { isCategoryApplicable } from "../../domain/services/document-applicability.service.ts";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_ORIGIN_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_UPLOAD_HINTS,
  IDENTIFICATION_DOCUMENT_CATEGORIES,
  MANDATORY_REQUIREMENT_GROUPS,
  type DocumentOrigin,
  type EmployeeDocument,
} from "../../domain/entities/employee-document.ts";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXT = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg,.jpeg",
  "image/png": ".png",
};

function acceptAttrFor(mimeTypes: string[]): string {
  const ext = mimeTypes.map((m) => MIME_TO_EXT[m] ?? "").filter(Boolean).join(",");
  return ext || ACCEPTED_EXT;
}

interface CategoryOption {
  slug: string;
  label: string;
  mandatory: boolean;
  acceptedMimeTypes: string[];
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DocStatusBadge({ status }: { status: EmployeeDocument["displayStatus"] }) {
  const info = DOCUMENT_STATUS_LABELS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

function VersionHistoryModal({
  employeeId,
  documentId,
  onClose,
}: {
  employeeId: string;
  documentId: string;
  onClose: () => void;
}) {
  const { api } = useHrModule();
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["hr-people-document-history", employeeId, documentId],
    queryFn: () => api.getEmployeeDocumentHistory(employeeId, documentId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-stone-800">Histórico de versões</h3>
        {isLoading ? (
          <p className="mt-4 text-sm text-stone-400">A carregar…</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-stone-700">v{v.version} — {v.fileName}</p>
                  <p className="text-xs text-stone-400">
                    {v.uploadedBy} · {formatDate(v.uploadedAt)}
                  </p>
                </div>
                <DocStatusBadge status={v.displayStatus} />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-stone-200 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export function EmployeeDocumentsTab({
  employeeId,
  profile,
  initialCategory = null,
  onViewFullHistory,
}: {
  employeeId: string;
  profile: EmployeeProfile;
  /** Vem de "Pessoas > Documentos" (`?category=...`) — pré-seleciona a categoria no formulário de upload, evitando obrigar a repetir a escolha (task "Melhorar Visão Geral e reorganizar Pessoas", secção 9). */
  initialCategory?: string | null;
  onViewFullHistory: () => void;
}) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingDocId = useRef<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [mandatory, setMandatory] = useState(true);
  const [origin, setOrigin] = useState<DocumentOrigin>("rh");
  const [expiresAt, setExpiresAt] = useState("");
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["hr-people-documents", employeeId],
    queryFn: () => api.listEmployeeDocuments(employeeId),
  });
  const documents = documentsQuery.data ?? [];

  const categoriesQuery = useQuery({
    queryKey: ["hr-document-categories"],
    queryFn: () => api.listDocumentCategories(),
  });

  const recentHistoryQuery = useQuery({
    queryKey: ["hr-people-history", employeeId, "recent-documents"],
    queryFn: () => api.getEmployeeHistory(employeeId, 1, 50),
  });
  const recentDocumentEvents = (recentHistoryQuery.data?.items ?? [])
    .filter((e) => e.entityType === "employee_document")
    .slice(0, 5);

  // As 3 categorias de identificação continuam fixas (fora da tela de
  // gestão); as restantes são configuráveis por organização e filtradas por
  // cargo ("Todos" ou "Cargos selecionados", ticket 09) — mesma regra do backend.
  const dynamicCategories = (categoriesQuery.data ?? []).filter((c) => isCategoryApplicable(c, profile.employee));
  const categoryOptions: CategoryOption[] = [
    ...IDENTIFICATION_DOCUMENT_CATEGORIES.map((slug) => ({
      slug,
      label: DOCUMENT_CATEGORY_LABELS[slug] ?? slug,
      mandatory: true,
      acceptedMimeTypes: ACCEPTED_TYPES,
    })),
    ...dynamicCategories.map((c) => ({
      slug: c.slug,
      label: c.label,
      mandatory: c.mandatory,
      acceptedMimeTypes: c.acceptedMimeTypes,
    })),
  ];
  const categoryOptionBySlug = new Map(categoryOptions.map((c) => [c.slug, c]));

  // `mandatory` só é conhecido depois de `categoriesQuery` resolver — corrige o checkbox quando a categoria já vem pré-selecionada de "Pessoas > Documentos".
  useEffect(() => {
    if (initialCategory && categoryOptionBySlug.has(initialCategory)) {
      setMandatory(categoryOptionBySlug.get(initialCategory)!.mandatory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesQuery.data]);

  const usedCategories = new Set(documents.map((d) => d.category));
  // Uma vez satisfeito o requisito de identificação por uma das suas
  // categorias (ex: já há Cartão de Cidadão), esconde as categorias-irmãs
  // (Título de Residência/Passaporte) — evita sugerir um upload redundante.
  const hiddenSiblingCategories = new Set(
    MANDATORY_REQUIREMENT_GROUPS.filter((group) => group.some((c) => usedCategories.has(c))).flatMap((group) => group),
  );
  const availableCategories = [...categoryOptions.map((c) => c.slug), "outro"].filter(
    (c) => c === "outro" || (!usedCategories.has(c) && !hiddenSiblingCategories.has(c)),
  );

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["hr-people-documents", employeeId] });
    void qc.invalidateQueries({ queryKey: ["hr-people-profile", employeeId] });
    void qc.invalidateQueries({ queryKey: ["hr-people-history", employeeId] });
    void qc.invalidateQueries({ queryKey: ["hr-people-kpis"] });
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.uploadEmployeeDocument(employeeId, {
        category,
        mandatory,
        origin,
        expiresAt: expiresAt || null,
        file,
      }),
    onSuccess: () => {
      invalidate();
      setCategory("");
      setExpiresAt("");
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Erro ao enviar o documento"),
  });

  const replaceMutation = useMutation({
    mutationFn: ({ documentId, file }: { documentId: string; file: File }) =>
      api.replaceEmployeeDocument(employeeId, documentId, { file }),
    onSuccess: invalidate,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Erro ao substituir o documento"),
  });

  const removeMutation = useMutation({
    mutationFn: (documentId: string) => api.removeEmployeeDocument(employeeId, documentId),
    onSuccess: invalidate,
  });

  function validateFile(file: File, categorySlug: string): boolean {
    setError(null);
    const accepted = categoryOptionBySlug.get(categorySlug)?.acceptedMimeTypes ?? ACCEPTED_TYPES;
    if (!accepted.includes(file.type)) {
      setError("Formato não suportado para esta categoria");
      return false;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Ficheiro demasiado grande (máx. 20MB)");
      return false;
    }
    return true;
  }

  function handleCategoryChange(value: string) {
    setCategory(value);
    setMandatory(categoryOptionBySlug.get(value)?.mandatory ?? false);
  }

  function handleUploadFile(file: File) {
    if (!category) {
      setError("Escolhe uma categoria antes de enviar");
      return;
    }
    if (!validateFile(file, category)) return;
    uploadMutation.mutate(file);
  }

  async function handleDownload(documentId: string) {
    const url = await api.getEmployeeDocumentDownloadUrl(employeeId, documentId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleRemove(documentId: string) {
    if (window.confirm("Remover este documento? A versão fica preservada no histórico, mas deixa de estar ativa.")) {
      removeMutation.mutate(documentId);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {/* Mini KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[#F5C992]/40 bg-white px-4 py-3">
            <p className="text-xs text-stone-500">Obrigatórios completos</p>
            <p className="mt-0.5 text-lg font-bold text-stone-800">
              {profile.documents.mandatoryCompleted}/{profile.documents.mandatoryTotal}
            </p>
          </div>
          <div className="rounded-lg border border-[#F5C992]/40 bg-white px-4 py-3">
            <p className="text-xs text-stone-500">A expirar</p>
            <p className="mt-0.5 text-lg font-bold text-amber-600">{profile.documents.expiringSoonCount}</p>
          </div>
          <div className="rounded-lg border border-[#F5C992]/40 bg-white px-4 py-3">
            <p className="text-xs text-stone-500">Em validação</p>
            <p className="mt-0.5 text-lg font-bold text-violet-600">
              {documents.filter((d) => d.displayStatus === "pending_validation").length}
            </p>
          </div>
          <div className="rounded-lg border border-[#F5C992]/40 bg-white px-4 py-3">
            <p className="text-xs text-stone-500">Documentos ativos</p>
            <p className="mt-0.5 text-lg font-bold text-stone-800">{documents.length}</p>
          </div>
        </div>

        {/* Upload zone */}
        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Categoria</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              >
                <option value="">Seleciona uma categoria</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {categoryOptionBySlug.get(c)?.label ?? DOCUMENT_CATEGORY_LABELS[c] ?? c}
                    {categoryOptionBySlug.get(c)?.mandatory ? " (obrigatório)" : ""}
                  </option>
                ))}
              </select>
              {category && DOCUMENT_UPLOAD_HINTS[category] && (
                <p className="mt-1 max-w-xs text-xs text-stone-400">
                  Sugestões: {DOCUMENT_UPLOAD_HINTS[category]!.join(", ")}
                </p>
              )}
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-600">
              <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
              Obrigatório
            </label>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Validade (opcional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Origem</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as DocumentOrigin)}
                className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              >
                {Object.entries(DOCUMENT_ORIGIN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleUploadFile(file);
            }}
            onClick={() => !uploadMutation.isPending && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
              dragging ? "border-[#ED5C32] bg-orange-50" : "border-stone-200 bg-stone-50 hover:border-[#ED5C32]/50"
            } ${uploadMutation.isPending ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttrFor(categoryOptionBySlug.get(category)?.acceptedMimeTypes ?? ACCEPTED_TYPES)}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
                e.target.value = "";
              }}
            />
            {uploadMutation.isPending ? (
              <p className="text-sm text-stone-500">A enviar…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-stone-600">Arraste ficheiros ou clique para procurar</p>
                <p className="text-xs text-stone-400">
                  Formatos suportados: {(categoryOptionBySlug.get(category)?.acceptedMimeTypes ?? ACCEPTED_TYPES)
                    .map((m) => (m === "application/pdf" ? "PDF" : m === "image/jpeg" ? "JPG" : "PNG"))
                    .join(", ")}{" "}
                  (máx. 20MB)
                </p>
              </>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {documentsQuery.isLoading ? (
            <p className="py-10 text-center text-sm text-stone-400">A carregar…</p>
          ) : documents.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">Ainda não há documentos.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Ficheiro</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Validade</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Origem</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Atualização</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5C992]/30">
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-3 py-2.5">
                      <p className="text-stone-700">{categoryOptionBySlug.get(doc.category)?.label ?? DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}</p>
                      {doc.mandatory && <span className="text-xs text-stone-400">Obrigatório</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setHistoryDocId(doc.id)}
                        className="text-[#ED5C32] hover:underline"
                        title="Ver histórico de versões"
                      >
                        {doc.fileName}
                      </button>
                      {doc.version > 1 && <span className="ml-1 text-xs text-stone-400">v{doc.version}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-stone-500">{formatDate(doc.expiresAt)}</td>
                    <td className="px-3 py-2.5">
                      <DocStatusBadge status={doc.displayStatus} />
                    </td>
                    <td className="px-3 py-2.5 text-stone-500">{DOCUMENT_ORIGIN_LABELS[doc.origin]}</td>
                    <td className="px-3 py-2.5 text-stone-500">{formatDate(doc.uploadedAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-3 text-xs font-medium">
                        <button type="button" onClick={() => handleDownload(doc.id)} className="text-stone-500 hover:text-stone-800">
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            replacingDocId.current = doc.id;
                            replaceInputRef.current?.click();
                          }}
                          className="text-[#ED5C32] hover:underline"
                        >
                          Substituir
                        </button>
                        <button type="button" onClick={() => handleRemove(doc.id)} className="text-red-600 hover:underline">
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <input
          ref={replaceInputRef}
          type="file"
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const documentId = replacingDocId.current;
            e.target.value = "";
            if (!file || !documentId) return;
            const originalCategory = documents.find((d) => d.id === documentId)?.category ?? "";
            if (!validateFile(file, originalCategory)) return;
            replaceMutation.mutate({ documentId, file });
          }}
        />
      </div>

      {/* Alertas + histórico documental */}
      <aside className="space-y-4">
        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-stone-800">Documentos em falta</h3>
          {profile.documents.missingRequirements.length === 0 && profile.documents.missingOptional.length === 0 ? (
            <p className="text-sm text-stone-400">Nada em falta.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {profile.documents.missingRequirements.map((label) => (
                <li key={`req-${label}`} className="flex items-center justify-between gap-2">
                  <span className="text-stone-700">{label}</span>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Obrigatório
                  </span>
                </li>
              ))}
              {profile.documents.missingOptional.map((label) => (
                <li key={`opt-${label}`} className="flex items-center justify-between gap-2">
                  <span className="text-stone-600">{label}</span>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    Opcional
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-800">Alertas documentais</h3>
          {profile.alerts.filter((a) => a.type !== "emergency_contact_pending").length === 0 ? (
            <p className="text-sm text-stone-400">Sem alertas.</p>
          ) : (
            <ul className="space-y-2 text-sm text-stone-600">
              {profile.alerts
                .filter((a) => a.type !== "emergency_contact_pending")
                .map((a, i) => (
                  <li key={i}>{a.message}</li>
                ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-stone-800">Histórico documental</h3>
          {recentDocumentEvents.length === 0 ? (
            <p className="text-sm text-stone-400">Sem eventos ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentDocumentEvents.map((e) => (
                <li key={e.id} className="text-stone-600">
                  <p className="font-medium text-stone-700">{e.description}</p>
                  <p className="text-xs text-stone-400">{formatDate(e.createdAt)} · por {e.actor}</p>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onViewFullHistory} className="mt-3 text-sm font-medium text-[#ED5C32] hover:underline">
            Ver todo o histórico →
          </button>
        </div>
      </aside>

      {historyDocId && (
        <VersionHistoryModal employeeId={employeeId} documentId={historyDocId} onClose={() => setHistoryDocId(null)} />
      )}
    </div>
  );
}
