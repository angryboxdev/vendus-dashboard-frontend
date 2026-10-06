import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import type { EmployeeListRow } from "../../domain/entities/employee.ts";
import type { ShiftRotation } from "../../domain/entities/schedule.ts";
import { usePositions } from "./use-positions.ts";

function emptyForm() {
  return {
    /** Só filtra a lista de colaboradores a escolher — "" = todos. */
    positionFilter: "",
    participantA: "",
    participantB: "",
    patternAKind: "direct" as "direct" | "split",
    patternAStart: "11:30",
    patternAEnd: "15:30",
    patternASecondStart: "19:00",
    patternASecondEnd: "23:00",
    patternBKind: "direct" as "direct" | "split",
    patternBStart: "17:00",
    patternBEnd: "23:00",
    patternBSecondStart: "19:00",
    patternBSecondEnd: "23:00",
    locationId: null as string | null,
    anchorDate: "",
  };
}

function formatPattern(p: { startTime: string; endTime: string; secondStartTime: string | null; secondEndTime: string | null }): string {
  const first = `${p.startTime}–${p.endTime}`;
  return p.secondStartTime && p.secondEndTime ? `${first} + ${p.secondStartTime}–${p.secondEndTime}` : first;
}

function nextMonday(): string {
  const d = new Date();
  const isoWeekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - isoWeekday + (isoWeekday === 0 ? 0 : 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ShiftRotationsPanel({ employees }: { employees: EmployeeListRow[] }) {
  const { api } = useHrModule();
  const { data: positions = [] } = usePositions();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(() => ({ ...emptyForm(), anchorDate: nextMonday() }));
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const { data: rotations = [] } = useQuery({
    queryKey: ["hr-shift-rotations"],
    queryFn: () => api.listShiftRotations(),
  });

  const { data: preview = [] } = useQuery({
    queryKey: ["hr-shift-rotation-preview", previewingId],
    queryFn: () => api.previewShiftRotation(previewingId!, 2),
    enabled: !!previewingId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createShiftRotation({
        participantEmployeeIds: [form.participantA, form.participantB],
        patternA: {
          startTime: form.patternAStart,
          endTime: form.patternAEnd,
          ...(form.patternAKind === "split" && { secondStartTime: form.patternASecondStart, secondEndTime: form.patternASecondEnd }),
        },
        patternB: {
          startTime: form.patternBStart,
          endTime: form.patternBEnd,
          ...(form.patternBKind === "split" && { secondStartTime: form.patternBSecondStart, secondEndTime: form.patternBSecondEnd }),
        },
        locationId: form.locationId!,
        anchorDate: form.anchorDate,
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["hr-shift-rotations"] });
      setShowCreate(false);
      setForm({ ...emptyForm(), anchorDate: nextMonday() });
      setPreviewingId(created.id);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Erro ao criar rotação"),
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => api.applyShiftRotation(id),
    onSuccess: (result) => {
      setApplyResult(`${result.created.length} turno(s) criado(s), ${result.updated.length} atualizado(s).`);
      void qc.invalidateQueries({ queryKey: ["hr-work-shifts"] });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setShiftRotationActive(id, active),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hr-shift-rotations"] }),
  });

  const eligibleEmployees = form.positionFilter ? employees.filter((e) => e.positionId === form.positionFilter) : employees;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.participantA || !form.participantB || form.participantA === form.participantB) {
      setError("Escolhe 2 colaboradores diferentes");
      return;
    }
    if (!form.locationId) {
      setError("Escolhe uma loja");
      return;
    }
    if (form.patternAKind === "split" && (form.patternASecondStart >= form.patternASecondEnd || form.patternASecondStart < form.patternAEnd)) {
      setError("Turno A: o 2º período tem de ser depois do 1º, sem sobreposição");
      return;
    }
    if (form.patternBKind === "split" && (form.patternBSecondStart >= form.patternBSecondEnd || form.patternBSecondStart < form.patternBEnd)) {
      setError("Turno B: o 2º período tem de ser depois do 1º, sem sobreposição");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">Alternância automática semanal entre 2 colaboradores.</p>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          {showCreate ? "Cancelar" : "+ Nova rotação"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Filtrar colaboradores por cargo</label>
              <select
                value={form.positionFilter}
                onChange={(e) => setForm((f) => ({ ...f, positionFilter: e.target.value, participantA: "", participantB: "" }))}
                className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              >
                <option value="">Todos os cargos</option>
                {positions
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Data de início (segunda-feira)</label>
              <input
                type="date"
                value={form.anchorDate}
                onChange={(e) => setForm((f) => ({ ...f, anchorDate: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Colaborador (Turno A na semana 1)</label>
              <select
                value={form.participantA}
                onChange={(e) => setForm((f) => ({ ...f, participantA: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              >
                <option value="">— selecionar —</option>
                {eligibleEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Colaborador (Turno B na semana 1)</label>
              <select
                value={form.participantB}
                onChange={(e) => setForm((f) => ({ ...f, participantB: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              >
                <option value="">— selecionar —</option>
                {eligibleEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-100 p-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500">Turno A</p>
                <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, patternAKind: "direct" }))}
                    className={`rounded px-1.5 py-0.5 ${form.patternAKind === "direct" ? "bg-white shadow-sm" : "text-stone-500"}`}
                  >
                    Direto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, patternAKind: "split" }))}
                    className={`rounded px-1.5 py-0.5 ${form.patternAKind === "split" ? "bg-white shadow-sm" : "text-stone-500"}`}
                  >
                    Repartido
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.patternAStart}
                  onChange={(e) => setForm((f) => ({ ...f, patternAStart: e.target.value }))}
                  className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  value={form.patternAEnd}
                  onChange={(e) => setForm((f) => ({ ...f, patternAEnd: e.target.value }))}
                  className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                />
              </div>
              {form.patternAKind === "split" && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="time"
                    value={form.patternASecondStart}
                    onChange={(e) => setForm((f) => ({ ...f, patternASecondStart: e.target.value }))}
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    value={form.patternASecondEnd}
                    onChange={(e) => setForm((f) => ({ ...f, patternASecondEnd: e.target.value }))}
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="rounded-lg border border-stone-100 p-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500">Turno B</p>
                <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, patternBKind: "direct" }))}
                    className={`rounded px-1.5 py-0.5 ${form.patternBKind === "direct" ? "bg-white shadow-sm" : "text-stone-500"}`}
                  >
                    Direto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, patternBKind: "split" }))}
                    className={`rounded px-1.5 py-0.5 ${form.patternBKind === "split" ? "bg-white shadow-sm" : "text-stone-500"}`}
                  >
                    Repartido
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.patternBStart}
                  onChange={(e) => setForm((f) => ({ ...f, patternBStart: e.target.value }))}
                  className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  value={form.patternBEnd}
                  onChange={(e) => setForm((f) => ({ ...f, patternBEnd: e.target.value }))}
                  className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                />
              </div>
              {form.patternBKind === "split" && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="time"
                    value={form.patternBSecondStart}
                    onChange={(e) => setForm((f) => ({ ...f, patternBSecondStart: e.target.value }))}
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    value={form.patternBSecondEnd}
                    onChange={(e) => setForm((f) => ({ ...f, patternBSecondEnd: e.target.value }))}
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <LocationSelect value={form.locationId} onChange={(id) => setForm((f) => ({ ...f, locationId: id }))} label="Loja" />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "A criar…" : "Criar rotação"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
        {rotations.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">Ainda não há rotações.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
              <tr>
                {["Colaboradores", "Turno A", "Turno B", "Início", "Estado", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5C992]/30">
              {rotations.map((r: ShiftRotation) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.participantNames.join(" / ")}</td>
                  <td className="px-3 py-2 text-stone-500">{formatPattern(r.patternA)}</td>
                  <td className="px-3 py-2 text-stone-500">{formatPattern(r.patternB)}</td>
                  <td className="px-3 py-2 text-stone-500">{r.anchorDate}</td>
                  <td className="px-3 py-2">{r.active ? "Ativa" : "Pausada"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3 text-xs font-medium">
                      <button onClick={() => setPreviewingId(r.id)} className="text-stone-500 hover:underline">
                        Pré-visualizar
                      </button>
                      <button
                        onClick={() => applyMutation.mutate(r.id)}
                        disabled={applyMutation.isPending || !r.active}
                        className="text-[#ED5C32] hover:underline disabled:opacity-40"
                      >
                        Aplicar
                      </button>
                      <button
                        onClick={() => setActiveMutation.mutate({ id: r.id, active: !r.active })}
                        className="text-stone-500 hover:underline"
                      >
                        {r.active ? "Pausar" : "Retomar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {applyResult && <p className="text-sm text-emerald-700">{applyResult}</p>}

      {previewingId && preview.length > 0 && (
        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Pré-visualização (2 semanas)</h3>
            <button onClick={() => setPreviewingId(null)} className="text-xs text-stone-400 hover:text-stone-600">
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {preview.map((week, i) => (
              <div key={week.weekStartDate} className="rounded-lg border border-stone-100 p-3 text-sm">
                <p className="mb-2 font-semibold text-stone-700">Semana {i + 1} — {week.weekStartDate}</p>
                <p className="text-stone-600">
                  Turno A: {week.patternAEmployeeName} <span className="text-stone-400">· {formatPattern(week.patternA)}</span>
                </p>
                <p className="text-stone-600">
                  Turno B: {week.patternBEmployeeName} <span className="text-stone-400">· {formatPattern(week.patternB)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
