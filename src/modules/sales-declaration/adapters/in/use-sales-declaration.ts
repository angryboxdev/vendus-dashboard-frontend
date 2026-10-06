import { useCallback, useState } from "react";
import { validateSaftFiles } from "../../domain/services/saft-upload.service.ts";
import { useSalesDeclarationModule } from "../../sales-declaration.module.tsx";

export function useSalesDeclaration() {
  const { exportSalesDeclaration } = useSalesDeclarationModule();
  const [files, setFiles] = useState<File[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    setError(null);
    setFiles((current) => {
      const names = new Set(current.map((f) => f.name));
      return [...current, ...incoming.filter((f) => !names.has(f.name))];
    });
  }, []);

  const removeFile = useCallback((name: string) => {
    setFiles((current) => current.filter((f) => f.name !== name));
  }, []);

  const generate = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const uploads = await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.arrayBuffer() })));
      await exportSalesDeclaration.execute(uploads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar o ficheiro");
    } finally {
      setExporting(false);
    }
  }, [exportSalesDeclaration, files]);

  return {
    files,
    exporting,
    error,
    selectionError: files.length > 0 ? validateSaftFiles(files.map((f) => f.name)) : null,
    canGenerate: !exporting && validateSaftFiles(files.map((f) => f.name)) === null,
    addFiles,
    removeFile,
    generate,
  };
}
