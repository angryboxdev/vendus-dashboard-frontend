import { useState } from "react";
import { supplierInitials } from "../../domain/services/supplier-initials.ts";

/** Logótipo do fornecedor (tirado das faturas) ou, sem ele / se a imagem falhar, as iniciais. */
export function SupplierAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return <img src={logoUrl} alt="" onError={() => setBroken(true)} className="h-8 w-8 shrink-0 rounded-md border border-stone-100 bg-white object-contain p-0.5" />;
  }
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-[11px] font-semibold text-stone-500">
      {supplierInitials(name)}
    </span>
  );
}
