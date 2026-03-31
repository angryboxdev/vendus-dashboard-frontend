import { useRef, useState } from "react";

const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

export function UploadCard({
  disabled,
  error,
  onFileSelected,
}: {
  disabled?: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function pick() {
    if (!disabled) inputRef.current?.click();
  }

  function handleFiles(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    const ok =
      f.type === "application/pdf" ||
      f.type === "image/jpeg" ||
      f.type === "image/png" ||
      f.type === "image/webp";
    if (!ok) {
      setLocalError("Use PDF, JPG, PNG ou WebP.");
      return;
    }
    setLocalError(null);
    onFileSelected(f);
  }

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? "border-slate-500 bg-slate-50" : "border-slate-200 bg-white"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-sm font-medium text-slate-800">
        Arraste um ficheiro ou clique para escolher
      </p>
      <p className="mt-1 text-xs text-slate-500">PDF (com texto), JPG, PNG ou WebP</p>
      <button
        type="button"
        onClick={pick}
        disabled={disabled}
        className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Escolher ficheiro
      </button>
      {(error || localError) && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error || localError}
        </p>
      )}
    </div>
  );
}
