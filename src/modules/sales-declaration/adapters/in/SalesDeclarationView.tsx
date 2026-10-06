import { useSalesDeclaration } from "./use-sales-declaration.ts";

export function SalesDeclarationView() {
  const { files, exporting, error, selectionError, canGenerate, addFiles, removeFile, generate } = useSalesDeclaration();

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <h1 className="text-xl font-semibold text-gray-900">Declaração de vendas</h1>
      <p className="mt-1 text-sm text-gray-500">
        Mercado Bom Sucesso — envie os SAF-T (por exemplo, o do Vendus e o do AirMenu) e receba o Excel com o valor
        diário <strong>sem IVA</strong>, já descontadas as notas de crédito, lido diretamente dos ficheiros.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-700" htmlFor="saft-files">
          Ficheiros SAF-T (.xml)
        </label>
        <input
          id="saft-files"
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // permite voltar a escolher o mesmo ficheiro depois de o remover
          }}
          className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />

        {files.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-700">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  className="shrink-0 text-xs font-medium text-gray-400 hover:text-red-600"
                  aria-label={`Remover ${f.name}`}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => void generate()}
            className="rounded-lg bg-[#E8533F] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {exporting ? "A gerar…" : "Gerar Excel"}
          </button>
        </div>

        {selectionError && <p className="mt-2 text-sm text-amber-600">{selectionError}</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
