import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { ImportPlatformDocumentsResult, PlatformStatementSummary } from "../../domain/entities/platform-statement.ts";
import { validatePlatformFiles } from "../../domain/services/platform-statements-view.ts";
import { useDeliveryPlatformsModule } from "../../delivery-platforms.module.tsx";

const STATEMENTS_KEY = "delivery-platform-statements";

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Extratos do mês + seleção e envio de ficheiros. */
export function useDeliveryPlatforms(year: number, month: number) {
  const { importDocuments, listStatements } = useDeliveryPlatformsModule();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ImportPlatformDocumentsResult | null>(null);

  const statements = useQuery({
    queryKey: [STATEMENTS_KEY, year, month],
    queryFn: () => listStatements.execute(year, month),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: async (selected: File[]) =>
      importDocuments.execute(await Promise.all(selected.map(async (f) => ({ name: f.name, content: await f.arrayBuffer() })))),
    onSuccess: (res) => {
      setResult(res);
      setFiles([]);
      void qc.invalidateQueries({ queryKey: [STATEMENTS_KEY] });
    },
  });

  const addFiles = useCallback((incoming: File[]) => {
    setResult(null);
    setFiles((current) => {
      const names = new Set(current.map((f) => f.name));
      return [...current, ...incoming.filter((f) => !names.has(f.name))];
    });
  }, []);

  const removeFile = useCallback((name: string) => setFiles((current) => current.filter((f) => f.name !== name)), []);

  const selectionError = files.length > 0 ? validatePlatformFiles(files.map((f) => f.name)) : null;

  return {
    statements: (statements.data ?? []) as PlatformStatementSummary[],
    loading: statements.isLoading,
    loadError: statements.error ? message(statements.error, "Erro ao carregar os extratos") : null,
    files,
    addFiles,
    removeFile,
    selectionError,
    canImport: files.length > 0 && selectionError === null && !upload.isPending,
    importing: upload.isPending,
    importError: upload.error ? message(upload.error, "Erro ao importar") : null,
    result,
    importFiles: () => upload.mutate(files),
  };
}
