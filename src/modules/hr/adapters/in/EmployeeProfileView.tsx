import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { AvatarUpload } from "./components/AvatarUpload.tsx";
import { EmployeeDrawer } from "./EmployeeDrawer.tsx";
import { EmployeeDocumentsTab } from "./EmployeeDocumentsTab.tsx";
import { EmployeeHistoryTab } from "./EmployeeHistoryTab.tsx";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_ROLE_LABELS,
  type CreateEmployeePayload,
  type UpdateEmployeePayload,
} from "../../domain/entities/employee.ts";

type TabKey = "resumo" | "dados" | "documentos" | "contrato" | "historico";

const TABS: { key: TabKey; label: string }[] = [
  { key: "resumo", label: "Resumo" },
  { key: "dados", label: "Dados pessoais" },
  { key: "documentos", label: "Documentos" },
  { key: "contrato", label: "Contrato & Remuneração" },
  { key: "historico", label: "Histórico" },
];

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

function SectionBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`} />
      {complete ? "Completo" : "Incompleto"}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-sm text-stone-700">{value || <span className="text-stone-300">—</span>}</p>
    </div>
  );
}

export function EmployeeProfileView() {
  const { id } = useParams<{ id: string }>();
  const { api } = useHrModule();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("resumo");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["hr-people-profile", id],
    queryFn: () => api.getEmployeeProfile(id!),
    enabled: !!id,
  });

  function invalidateProfile() {
    void qc.invalidateQueries({ queryKey: ["hr-people-profile", id] });
    void qc.invalidateQueries({ queryKey: ["hr-people-list"] });
    void qc.invalidateQueries({ queryKey: ["hr-people-kpis"] });
  }

  const updateMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload | UpdateEmployeePayload) =>
      api.updateEmployee(id!, payload as UpdateEmployeePayload),
    onSuccess: () => {
      invalidateProfile();
      setDrawerOpen(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "inactive") => api.setEmployeeStatus(id!, status),
    onSuccess: invalidateProfile,
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.uploadEmployeePhoto(id!, file),
    onSuccess: invalidateProfile,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#FAF6F3]">
        <p className="text-sm text-stone-400">A carregar…</p>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-[#FAF6F3]">
        <p className="text-sm text-stone-500">Colaborador não encontrado.</p>
        <Link to="/hr/people" className="text-sm text-[#ED5C32] hover:underline">
          ← Voltar a Pessoas & Documentos
        </Link>
      </div>
    );
  }

  const e = profile.employee;
  const isActive = e.status === "active";

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <nav className="mb-3 flex items-center gap-1.5 text-sm text-stone-400">
          <Link to="/hr/people" className="flex items-center gap-1 transition-colors hover:text-stone-700">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
                clipRule="evenodd"
              />
            </svg>
            Pessoas & Documentos
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-stone-700">{e.fullName}</span>
        </nav>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarUpload
              name={e.fullName}
              photoUrl={e.photoUrl}
              uploading={photoMutation.isPending}
              onUpload={(file) => photoMutation.mutate(file)}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-stone-900">{e.fullName}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-stone-400"}`} />
                  {isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-sm text-stone-500">{JOB_ROLE_LABELS[e.jobRole]}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
            >
              Editar perfil
            </button>
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(isActive ? "inactive" : "active")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-60 ${
                isActive
                  ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {isActive ? "Desativar" : "Ativar"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b border-transparent">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {tab === "resumo" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Estado do perfil</p>
                <p className="mt-1 text-xl font-bold text-stone-800">{profile.profileCompletionPercent}% completo</p>
                <div className="mt-2 h-1.5 rounded-full bg-stone-100">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${profile.profileCompletionPercent}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Documentos obrigatórios</p>
                <p className="mt-1 text-xl font-bold text-stone-800">
                  {profile.documents.mandatoryCompleted}/{profile.documents.mandatoryTotal}
                </p>
                {profile.documents.missingCategories.length > 0 && (
                  <p className="mt-0.5 text-xs text-amber-600">{profile.documents.missingCategories.length} em falta</p>
                )}
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Próximos vencimentos</p>
                <p className="mt-1 text-xl font-bold text-amber-600">{profile.documents.expiringSoonCount}</p>
                <p className="mt-0.5 text-xs text-stone-400">nos próximos 30 dias</p>
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Onboarding</p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    profile.onboardingStatus === "completed" ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {profile.onboardingStatus === "completed" ? "Concluído" : "Pendente"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-800">Dados pessoais</h3>
                  <SectionBadge complete={profile.sections.personalData} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Email" value={e.email} />
                  <InfoRow label="Telefone" value={e.phone} />
                  <InfoRow label="NIF" value={e.nif} />
                  <InfoRow label="Nacionalidade" value={e.nationality} />
                </div>
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-800">Dados contratuais</h3>
                  <SectionBadge complete={profile.sections.contractData} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Função" value={JOB_ROLE_LABELS[e.jobRole]} />
                  <InfoRow label="Vínculo" value={EMPLOYMENT_TYPE_LABELS[e.employmentType]} />
                  <InfoRow label="Data de admissão" value={formatDate(e.hiredAt)} />
                </div>
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-800">Morada</h3>
                  <SectionBadge complete={profile.sections.address} />
                </div>
                <InfoRow label="Morada" value={e.address} />
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-800">Contacto de emergência</h3>
                  <SectionBadge complete={profile.sections.emergencyContact} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Nome" value={e.emergencyContactName} />
                  <InfoRow label="Telefone" value={e.emergencyContactPhone} />
                </div>
              </div>
            </div>

            {profile.alerts.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-amber-800">Alertas importantes</h3>
                <ul className="space-y-1 text-sm text-amber-700">
                  {profile.alerts.map((a, i) => (
                    <li key={i}>{a.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-stone-800">Outras áreas</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {["Turnos", "Pagamentos", "Férias"].map((label) => (
                  <Link
                    key={label}
                    to={`/hr/employees/${id}`}
                    className="flex items-center justify-between rounded-xl border border-[#F5C992]/40 bg-white p-4 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-[#FDF8F5]"
                  >
                    {label}
                    <span className="text-stone-300">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "dados" && (
          <div className="max-w-2xl space-y-4 rounded-xl border border-[#F5C992]/40 bg-white p-5">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Email" value={e.email} />
              <InfoRow label="Telefone" value={e.phone} />
              <InfoRow label="NIF" value={e.nif} />
              <InfoRow label="IBAN" value={e.iban} />
              <InfoRow label="Morada" value={e.address} />
              <InfoRow label="Data de nascimento" value={formatDate(e.birthDate)} />
              <InfoRow label="Nacionalidade" value={e.nationality} />
              <InfoRow label="Nº Segurança Social" value={e.socialSecurityNumber} />
              <InfoRow label="Nº Cartão de Cidadão" value={e.idCardNumber} />
              <InfoRow label="Contacto de emergência" value={e.emergencyContactName} />
              <InfoRow label="Telemóvel de emergência" value={e.emergencyContactPhone} />
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-sm font-medium text-[#ED5C32] hover:underline"
            >
              Editar dados
            </button>
          </div>
        )}

        {tab === "documentos" && id && (
          <EmployeeDocumentsTab employeeId={id} profile={profile} onViewFullHistory={() => setTab("historico")} />
        )}

        {tab === "contrato" && (
          <div className="max-w-2xl space-y-4 rounded-xl border border-[#F5C992]/40 bg-white p-5">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Vínculo" value={EMPLOYMENT_TYPE_LABELS[e.employmentType]} />
              <InfoRow label="Função" value={JOB_ROLE_LABELS[e.jobRole]} />
              <InfoRow label="Data de admissão" value={formatDate(e.hiredAt)} />
              <InfoRow label="Data de cessação" value={formatDate(e.endedAt)} />
              <InfoRow label="Tipo de remuneração" value={e.salaryType === "fixed" ? "Salário fixo" : "À hora"} />
              {e.salaryType === "fixed" ? (
                <InfoRow label="Salário base" value={e.baseSalary != null ? formatEUR(e.baseSalary) : null} />
              ) : (
                <InfoRow label="Valor por hora" value={e.hourlyRate != null ? formatEUR(e.hourlyRate) : null} />
              )}
              <InfoRow label="IBAN" value={e.iban} />
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-sm font-medium text-[#ED5C32] hover:underline"
            >
              Editar dados
            </button>
          </div>
        )}

        {tab === "historico" && id && <EmployeeHistoryTab employeeId={id} />}
      </div>

      <EmployeeDrawer
        open={drawerOpen}
        editing={e}
        onClose={() => setDrawerOpen(false)}
        onSave={(payload) => updateMutation.mutate(payload)}
        saving={updateMutation.isPending}
      />
    </div>
  );
}
