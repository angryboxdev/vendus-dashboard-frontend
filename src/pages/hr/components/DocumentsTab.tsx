import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  deleteDocument,
  fetchDocuments,
  getDocumentDownloadUrl,
  uploadDocument,
  type DocumentType,
  type HrEmployeeDocument,
} from "../hrApi";
import { hrQueryKeys } from "../hrQueryKeys";

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  contract: "Contrato",
  id_card: "Cartão de Cidadão",
  nif: "NIF",
  iban: "IBAN",
  other: "Outro",
};

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocumentType, string][];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DocumentsTab({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<DocumentType>("contract");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: docs = [], isPending } = useQuery({
    queryKey: hrQueryKeys.documents(employeeId),
    queryFn: () => fetchDocuments(employeeId),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadDocument(employeeId, selectedType, file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hrQueryKeys.documents(employeeId) });
      setBanner({ type: "ok", text: "Documento enviado." });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (e: unknown) => {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erro ao enviar documento." });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (docId: string) => deleteDocument(employeeId, docId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hrQueryKeys.documents(employeeId) });
      setBanner({ type: "ok", text: "Documento apagado." });
    },
    onError: (e: unknown) => {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erro ao apagar documento." });
    },
  });

  async function handleDownload(doc: HrEmployeeDocument) {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(employeeId, doc.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      a.click();
    } catch (e: unknown) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erro ao descarregar." });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {banner ? (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${banner.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {banner.text}
          <button className="ml-3 underline" onClick={() => setBanner(null)}>fechar</button>
        </div>
      ) : null}

      {/* Upload */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Adicionar documento</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
            >
              {DOC_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ficheiro</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMut.mutate(file);
              }}
              disabled={uploadMut.isPending}
            />
          </div>
          {uploadMut.isPending ? (
            <span className="text-sm text-slate-500">A enviar…</span>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {isPending ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">A carregar…</p>
        ) : docs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Sem documentos carregados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 mr-2">
                    {DOC_TYPE_LABELS[doc.documentType]}
                  </span>
                  <span className="text-sm text-slate-800 truncate">{doc.fileName}</span>
                  <span className="ml-2 text-xs text-slate-400">{formatDate(doc.uploadedAt)}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={downloadingId === doc.id}
                    onClick={() => handleDownload(doc)}
                    className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {downloadingId === doc.id ? "…" : "descarregar"}
                  </button>
                  <button
                    type="button"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (window.confirm("Apagar este documento?")) deleteMut.mutate(doc.id);
                    }}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
