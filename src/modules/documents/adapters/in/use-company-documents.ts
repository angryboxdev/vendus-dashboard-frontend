import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyDocumentUpload, DocumentCategoryScope } from "../../domain/entities/company-document.ts";
import { useDocumentsModule } from "../../documents.module.tsx";

const DOCUMENTS_KEY = ["company-documents"];
const CATEGORIES_KEY = ["company-document-categories"];

/** React-query sobre os use cases — os componentes nunca falam com HTTP. */
export function useCompanyDocuments() {
  const mod = useDocumentsModule();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: DOCUMENTS_KEY });

  const documentsQuery = useQuery({ queryKey: DOCUMENTS_KEY, queryFn: () => mod.listDocuments.execute() });
  const categoriesQuery = useQuery({ queryKey: CATEGORIES_KEY, queryFn: () => mod.listCategories.execute() });

  const uploadMutation = useMutation({
    mutationFn: (upload: CompanyDocumentUpload & { category: string }) => mod.uploadDocument.execute(upload),
    onSuccess: invalidate,
  });
  const replaceMutation = useMutation({
    mutationFn: ({ id, upload }: { id: string; upload: CompanyDocumentUpload }) => mod.replaceDocument.execute(id, upload),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({ mutationFn: (id: string) => mod.removeDocument.execute(id), onSuccess: invalidate });

  const invalidateCategories = () => void qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
  const createCategoryMutation = useMutation({
    mutationFn: ({ label, scope }: { label: string; scope: Extract<DocumentCategoryScope, "company" | "both"> }) =>
      mod.createCategory.execute(label, scope),
    onSuccess: invalidateCategories,
  });
  const setCategoryActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => mod.setCategoryActive.execute(id, active),
    onSuccess: invalidateCategories,
  });

  return {
    documentsQuery,
    categoriesQuery,
    uploadMutation,
    replaceMutation,
    removeMutation,
    createCategoryMutation,
    setCategoryActiveMutation,
    downloadUrl: (id: string) => mod.getDownloadUrl.execute(id),
  };
}

export function useCompanyDocumentHistory(documentId: string | null) {
  const mod = useDocumentsModule();
  return useQuery({
    queryKey: ["company-document-history", documentId],
    queryFn: () => mod.getHistory.execute(documentId!),
    enabled: documentId !== null,
  });
}
