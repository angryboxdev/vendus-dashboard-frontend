import { useRef, useState } from "react";
import { Avatar } from "./Avatar.tsx";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — mesmo limite do backend

export function AvatarUpload({
  name,
  photoUrl,
  uploading,
  onUpload,
}: {
  name: string;
  photoUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato não suportado (usa jpg, png ou webp)");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Ficheiro demasiado grande (máx. 5MB)");
      return;
    }
    onUpload(file);
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={uploading}
        onClick={() => (photoUrl ? setExpanded(true) : inputRef.current?.click())}
        className="group relative disabled:cursor-not-allowed"
        title={photoUrl ? "Ver foto" : "Adicionar foto"}
      >
        <Avatar name={name} photoUrl={photoUrl} size="lg" />
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </span>
        )}
      </button>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="text-xs font-medium text-stone-400 transition-colors hover:text-stone-600 disabled:cursor-not-allowed"
      >
        Alterar foto
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {expanded && photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setExpanded(false)}
        >
          <img
            src={photoUrl}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
