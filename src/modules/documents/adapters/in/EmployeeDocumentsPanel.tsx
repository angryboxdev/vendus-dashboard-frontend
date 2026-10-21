import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEmployeeDocuments } from "../../documents.module.tsx";
import { ApiError } from "../../../../lib/api.ts";
import { PAYSLIP_DUPLICATE_MESSAGE } from "../../domain/entities/payslip-import.ts";
import { defaultPayslipPeriod, formatPeriod } from "../../domain/services/payslip-import.service.ts";
import { isCategoryApplicable } from "../../domain/services/document-applicability.service.ts";
import { DOCUMENT_FOLDERS, documentFolderOf, type DocumentFolder } from "../../domain/services/document-folders.service.ts";
import { AppIcon } from "../../../../components/ui/index.ts";
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
import { MOTION_ROW_HOVER, MotionLayer, MotionSuccess, useSuccessFlash } from "../../../../components/motion/index.ts";

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
  /** Categoria periódica (ex: Recibo de vencimento) — pede o período e pode ter vários documentos, um por período. */
  requiresPeriod: boolean;
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
  const api = useEmployeeDocuments();
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["novo-rh", "employee-documents", employeeId, "history", documentId],
    queryFn: () => api.getEmployeeDocumentHistory(employeeId, documentId),
  });

  return (
    <MotionLayer kind="overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <MotionLayer
        kind="modal"
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
      </MotionLayer>
    </MotionLayer>
  );
}

/**
 * Documentos da ficha do Novo RH (ADR-0040, fase 1 — vindo do separador do RH
 * antigo): requisitos, validade, versões, envio e substituição. O resumo
 * (obrigatórios, em falta, alertas) vem de `GET …/documents/summary`; sem
 * histórico antigo (decisão do utilizador).
 */
export function EmployeeDocumentsPanel({
  employeeId,
  initialCategory = null,
}: {
  employeeId: string;
  /** Vem de "Pessoas > Documentos" (`?category=...`) — pré-seleciona a categoria no formulário de upload, evitando obrigar a repetir a escolha (task "Melhorar Visão Geral e reorganizar Pessoas", secção 9). */
  initialCategory?: string | null;
}) {
  const api = useEmployeeDocuments();
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
  const [period, setPeriod] = useState(() => defaultPayslipPeriod(new Date().toISOString().slice(0, 10)));
  /** Recibo já existente no período (409 do backend): o utilizador cancela ou substitui a versão. */
  const [periodConflict, setPeriodConflict] = useState<{ documentId: string; file: File } | null>(null);
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  /** Pasta aberta (só filtra a lista; `null` = todas). */
  const [folder, setFolder] = useState<DocumentFolder | null>(null);
  const uploaded = useSuccessFlash();

  const documentsQuery = useQuery({
    queryKey: ["novo-rh", "employee-documents", employeeId, "list"],
    queryFn: () => api.listEmployeeDocuments(employeeId),
  });
  const documents = documentsQuery.data ?? [];

  const categoriesQuery = useQuery({
    queryKey: ["novo-rh", "employee-documents", "categories"],
    queryFn: () => api.listDocumentCategories(),
  });

  const summaryQuery = useQuery({
    queryKey: ["novo-rh", "employee-documents", employeeId, "summary"],
    queryFn: () => api.getDocumentSummary(employeeId),
  });
  const summary = summaryQuery.data;

  // As 3 categorias de identificação continuam fixas (fora da tela de
  // gestão); as restantes são configuráveis por organização e filtradas por
  // cargo ("Todos" ou "Cargos selecionados", ticket 09) — mesma regra do backend.
  const dynamicCategories = (categoriesQuery.data ?? []).filter((c) => isCategoryApplicable(c, { positionId: summary?.positionId ?? null }));
  const categoryOptions: CategoryOption[] = [
    ...IDENTIFICATION_DOCUMENT_CATEGORIES.map((slug) => ({
      slug,
      label: DOCUMENT_CATEGORY_LABELS[slug] ?? slug,
      mandatory: true,
      acceptedMimeTypes: ACCEPTED_TYPES,
      requiresPeriod: false,
    })),
    ...dynamicCategories.map((c) => ({
      slug: c.slug,
      label: c.label,
      mandatory: c.mandatory,
      acceptedMimeTypes: c.acceptedMimeTypes,
      requiresPeriod: c.requiresPeriod,
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
    (c) =>
      c === "outro" ||
      categoryOptionBySlug.get(c)?.requiresPeriod ||
      (!usedCategories.has(c) && !hiddenSiblingCategories.has(c)),
  );
  const selectedRequiresPeriod = categoryOptionBySlug.get(category)?.requiresPeriod ?? false;
  const folderOf = (doc: EmployeeDocument) => documentFolderOf(doc.category, categoryOptionBySlug.get(doc.category)?.requiresPeriod ?? false);
  const folderCount = (f: DocumentFolder) => documents.filter((d) => folderOf(d) === f).length;
  const shown = folder ? documents.filter((d) => folderOf(d) === folder) : documents;

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["novo-rh", "employee-documents", employeeId] });
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.uploadEmployeeDocument(employeeId, {
        category,
        mandatory: selectedRequiresPeriod ? false : mandatory,
        origin,
        expiresAt: expiresAt || null,
        ...(selectedRequiresPeriod && { period }),
        file,
      }),
    onSuccess: () => {
      invalidate();
      uploaded.flash();
      setCategory("");
      setExpiresAt("");
    },
    onError: (e: unknown, file: File) => {
      const data = e instanceof ApiError ? (e.data as { code?: string; existingDocumentId?: string } | undefined) : undefined;
      if (data?.code === "period_already_exists" && data.existingDocumentId) {
        setPeriodConflict({ documentId: data.existingDocumentId, file });
        return;
      }
      setError(e instanceof Error ? e.message : "Erro ao enviar o documento");
    },
  });

  const replaceMutation = useMutation({
    mutationFn: ({ documentId, file }: { documentId: string; file: File }) =>
      api.replaceEmployeeDocument(employeeId, documentId, { file }),
    onSuccess: () => {
      invalidate();
      uploaded.flash();
      setPeriodConflict(null);
    },
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
    if (selectedRequiresPeriod && !period) {
      setError("Indica o período (Mês/Ano)");
      return;
    }
    setPeriodConflict(null);
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
              {summary ? `${summary.mandatoryCompleted}/${summary.mandatoryTotal}` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-[#F5C992]/40 bg-white px-4 py-3">
            <p className="text-xs text-stone-500">A expirar</p>
            <p className="mt-0.5 text-lg font-bold text-amber-600">{summary?.expiringSoonCount ?? "—"}</p>
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
            {selectedRequiresPeriod ? (
              <div>
                <label htmlFor="document-period" className="mb-1 block text-xs font-medium text-stone-600">
                  Período
                </label>
                <input
                  id="document-period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                />
              </div>
            ) : (
              <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-600">
                <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
                Obrigatório
              </label>
            )}
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
          <div className="mt-2">
            <MotionSuccess visible={uploaded.visible} label="Documento guardado" />
          </div>
          {periodConflict && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>{PAYSLIP_DUPLICATE_MESSAGE}</span>
              <button type="button" onClick={() => setPeriodConflict(null)} className="rounded-md border border-amber-200 bg-white px-2 py-0.5 font-medium">
                Cancelar
              </button>
              <button
                type="button"
                disabled={replaceMutation.isPending}
                onClick={() => replaceMutation.mutate(periodConflict)}
                className="rounded-md bg-[#ED5C32] px-2 py-0.5 font-medium text-white disabled:opacity-50"
              >
                Substituir versão
              </button>
            </div>
          )}
        </div>

        {/* Pastas */}
        <section aria-label="Pastas">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm text-stone-500">
              <span className="font-semibold text-[#C2410C]">{DOCUMENT_FOLDERS.length}</span> pastas
            </p>
            {folder && (
              <button type="button" onClick={() => setFolder(null)} className="text-sm font-medium text-[#C2410C] hover:underline">
                Ver todos os documentos
              </button>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {DOCUMENT_FOLDERS.map((f) => {
              const n = folderCount(f.key);
              const active = folder === f.key;
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    title={f.hint}
                    onClick={() => setFolder(active ? null : f.key)}
                    className={`flex h-full w-full flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-colors duration-150 ${
                      active ? "border-[#C9643A] bg-[#FDF8F5]" : "border-[#F5C992]/40 bg-white hover:border-[#C9643A]/50 hover:bg-stone-50/60"
                    }`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7E8DF] text-[#C2410C]">
                      <AppIcon name="folder" size={22} />
                    </span>
                    <span className="text-sm font-semibold text-stone-800">{f.label}</span>
                    <span className="text-xs text-stone-500">{n === 0 ? "Sem elementos" : n === 1 ? "1 documento" : `${n} documentos`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {documentsQuery.isLoading ? (
            <p className="py-10 text-center text-sm text-stone-400">A carregar…</p>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">{folder ? "Esta pasta ainda não tem documentos." : "Ainda não há documentos."}</p>
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
                {shown.map((doc) => (
                  <tr key={doc.id} className={MOTION_ROW_HOVER}>
                    <td className="px-3 py-2.5">
                      <p className="text-stone-700">
                        {categoryOptionBySlug.get(doc.category)?.label ?? DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                        {doc.period && <span className="text-stone-500"> · {formatPeriod(doc.period)}</span>}
                      </p>
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

      {/* Em falta + alertas */}
      <aside className="space-y-4">
        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-stone-800">Documentos em falta</h3>
          {!summary || (summary.missingRequirements.length === 0 && summary.missingOptional.length === 0) ? (
            <p className="text-sm text-stone-400">Nada em falta.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {summary.missingRequirements.map((label) => (
                <li key={`req-${label}`} className="flex items-center justify-between gap-2">
                  <span className="text-stone-700">{label}</span>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Obrigatório
                  </span>
                </li>
              ))}
              {summary.missingOptional.map((label) => (
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
          {!summary || summary.alerts.length === 0 ? (
            <p className="text-sm text-stone-400">Sem alertas.</p>
          ) : (
            <ul className="space-y-2 text-sm text-stone-600">
              {summary.alerts.map((a, i) => (
                  <li key={i}>{a.message}</li>
                ))}
            </ul>
          )}
        </div>

      </aside>

      {historyDocId && (
        <VersionHistoryModal employeeId={employeeId} documentId={historyDocId} onClose={() => setHistoryDocId(null)} />
      )}
    </div>
  );
}
