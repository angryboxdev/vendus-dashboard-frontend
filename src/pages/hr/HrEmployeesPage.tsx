import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { ApiError } from "../../lib/api";
import {
  createEmployee,
  fetchEmployees,
  softDeleteEmployee,
  type CreateEmployeeBody,
} from "./hrApi";
import { dateInputValueToIsoDatetime } from "./dates";
import {
  HR_EMPLOYMENT_TYPE_LABELS,
  JOB_ROLE_LABELS,
  normalizeEmploymentType,
  normalizeJobRole,
} from "./hr.types";
import { hrQueryKeys } from "./hrQueryKeys";
import { createEmployeeSchema } from "./hrSchemas";
import type { CreateEmployeeFormValues } from "./hrSchemas";
import { defaultWeeklyScheduleFor } from "./weeklySchedulePresets";
import { finalizeWeeklySchedule } from "./weeklyScheduleUtils";
import { Modal } from "./components/Modal";
import { SkeletonBlock } from "./components/SkeletonBlock";

function mapFormToCreateBody(v: CreateEmployeeFormValues): CreateEmployeeBody {
  const body: CreateEmployeeBody = {
    fullName: v.fullName.trim(),
  };
  const email = v.email?.trim();
  if (email) body.email = email;
  const phone = v.phone?.trim();
  if (phone) body.phone = phone;
  const role = v.roleOrNotes?.trim();
  if (role) body.roleOrNotes = role;
  if (v.status) body.status = v.status;
  body.jobRole = v.jobRole;
  body.employmentType = v.employmentType;
  const hired = v.hiredAt?.trim();
  if (hired) {
    const iso = dateInputValueToIsoDatetime(hired);
    if (iso) body.hiredAt = iso;
  }
  const ended = v.endedAt?.trim();
  if (ended) {
    const iso = dateInputValueToIsoDatetime(ended);
    if (iso) body.endedAt = iso;
  }
  const preset = defaultWeeklyScheduleFor(v.jobRole, v.employmentType);
  if (preset) {
    body.weeklySchedule = finalizeWeeklySchedule(preset);
  }
  return body;
}

export function HrEmployeesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const listParams = useMemo(
    () => ({
      ...(status !== "all" ? { status } : {}),
      limit: 500,
      offset: 0,
    }),
    [status],
  );

  const { data, isPending, error, refetch } = useQuery({
    queryKey: hrQueryKeys.employees(listParams),
    queryFn: () => fetchEmployees(listParams),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((e) => e.fullName.toLowerCase().includes(q));
  }, [data, search]);

  const createMut = useMutation({
    mutationFn: (body: CreateEmployeeBody) => createEmployee(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hrQueryKeys.root });
      setCreateOpen(false);
      setBanner({ type: "ok", text: "Funcionário criado." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Não foi possível criar.",
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => softDeleteEmployee(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hrQueryKeys.root });
      setBanner({ type: "ok", text: "Funcionário desativado (soft delete)." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Não foi possível desativar.",
      });
    },
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      {banner ? (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Lista</h2>
          <p className="text-sm text-slate-600">
            Pesquisa local e filtro por estado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Novo funcionário
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">Pesquisar (nome)</span>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar na lista carregada…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Estado</span>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Erro ao carregar."}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refetch()}
          >
            Tentar outra vez
          </button>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Vínculo</th>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={6}>
                      <SkeletonBlock className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              </>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-500"
                  colSpan={6}
                >
                  Nenhum funcionário nesta vista.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      to={`/hr/employees/${row.id}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {row.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {
                      HR_EMPLOYMENT_TYPE_LABELS[
                        normalizeEmploymentType(row.employmentType)
                      ]
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {JOB_ROLE_LABELS[normalizeJobRole(row.jobRole)]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {row.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === "active" ? (
                      <button
                        type="button"
                        className="text-sm text-red-700 hover:underline"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Desativar este funcionário? O registo mantém-se no sistema (desativação — não é eliminação definitiva).",
                            )
                          ) {
                            deleteMut.mutate(row.id);
                          }
                        }}
                        disabled={deleteMut.isPending}
                      >
                        Desativar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <EmployeeCreateModal
          onClose={() => setCreateOpen(false)}
          loading={createMut.isPending}
          onSubmit={(v) => createMut.mutate(mapFormToCreateBody(v))}
        />
      ) : null}
    </div>
  );
}

function EmployeeCreateModal({
  onClose,
  loading,
  onSubmit,
}: {
  onClose: () => void;
  loading: boolean;
  onSubmit: (v: CreateEmployeeFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      roleOrNotes: "",
      status: "active",
      employmentType: "permanent",
      jobRole: "service",
      hiredAt: "",
      endedAt: "",
    },
  });

  return (
    <Modal
      title="Novo funcionário"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-employee-form"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "A guardar…" : "Criar"}
          </button>
        </div>
      }
    >
      <form
        id="create-employee-form"
        className="space-y-3"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Field
          label="Nome completo *"
          error={errors.fullName?.message}
          input={
            <input
              className={controlClass}
              {...register("fullName")}
              autoComplete="name"
            />
          }
        />
        <Field
          label="Email"
          error={errors.email?.message}
          input={
            <input
              className={controlClass}
              type="email"
              {...register("email")}
            />
          }
        />
        <Field
          label="Telefone"
          error={errors.phone?.message}
          input={<input className={controlClass} {...register("phone")} />}
        />
        <Field
          label="Notas"
          error={errors.roleOrNotes?.message}
          input={
            <textarea
              className={`${controlClass} min-h-[72px]`}
              {...register("roleOrNotes")}
            />
          }
        />
        <Field
          label="Vínculo *"
          error={errors.employmentType?.message}
          input={
            <select className={controlClass} {...register("employmentType")}>
              <option value="permanent">Efetivo</option>
              <option value="contract">Contrato (a termo)</option>
              <option value="extra">Extra</option>
            </select>
          }
        />
        <Field
          label="Função *"
          error={errors.jobRole?.message}
          input={
            <select className={controlClass} {...register("jobRole")}>
              {(
                Object.entries(JOB_ROLE_LABELS) as [
                  keyof typeof JOB_ROLE_LABELS,
                  string,
                ][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          }
        />
        <Field
          label="Estado"
          error={errors.status?.message}
          input={
            <select className={controlClass} {...register("status")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          }
        />
        <Field
          label="Data de contratação"
          error={errors.hiredAt?.message}
          input={
            <input
              className={controlClass}
              type="date"
              {...register("hiredAt")}
            />
          }
        />
        <Field
          label="Data de cessação"
          error={errors.endedAt?.message}
          input={
            <input
              className={controlClass}
              type="date"
              {...register("endedAt")}
            />
          }
        />
      </form>
    </Modal>
  );
}

const controlClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1">{input}</div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
