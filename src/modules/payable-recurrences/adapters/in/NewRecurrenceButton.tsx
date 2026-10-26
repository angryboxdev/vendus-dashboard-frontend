import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../payable-recurrences.module.tsx";
import type { CreateRecurrencePayload } from "../../domain/entities/recurrence.ts";
import { RecurrenceDrawer } from "./RecurrenceDrawer.tsx";

/** «Nova recorrência» + drawer de criação (com upload opcional do documento base). */
export function NewRecurrenceButton() {
  const { api } = usePayableRecurrencesModule();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Todas as vistas de recorrências (lista, resumo, vista mensal) usam chaves "payable-recurrences*".
  function invalidateAll() {
    void qc.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("payable-recurrences"),
    });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateRecurrencePayload) => api.createRecurrence(payload),
    onSuccess: invalidateAll,
  });

  async function handleCreate(payload: CreateRecurrencePayload, file: File | null) {
    const created = await createMutation.mutateAsync(payload);
    if (file) {
      setUploading(true);
      try {
        await api.uploadRecurrenceDocument(created.id, file);
        invalidateAll();
      } finally {
        setUploading(false);
      }
    }
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        Nova recorrência
      </button>
      <RecurrenceDrawer
        open={open}
        editing={null}
        saving={createMutation.isPending || uploading}
        onClose={() => setOpen(false)}
        onCreate={(payload, file) => { void handleCreate(payload, file); }}
        onUpdate={() => {}}
      />
    </>
  );
}
