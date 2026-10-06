import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { KIOSK_PIN_LENGTH } from "../../domain/entities/kiosk-pin.ts";
import { AvatarUpload } from "./components/AvatarUpload.tsx";
import { EmployeeDrawer } from "./EmployeeDrawer.tsx";
import {
  MOTION_FADE,
  MotionFade,
  MotionLayer,
  MotionNumber,
  MotionPresence,
  MotionProgress,
  MotionStagger,
  MotionSuccess,
  useSuccessFlash,
} from "../../../../components/motion/index.ts";
import { EmployeeDocumentsTab } from "./EmployeeDocumentsTab.tsx";
import { EmployeeHistoryTab } from "./EmployeeHistoryTab.tsx";
import { PortalAccessCard } from "./PortalAccessCard.tsx";
import { usePositions } from "./use-positions.ts";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { locationNameOf, positionNameOf } from "../../domain/services/employee-assignment.service.ts";
import {
  EMPLOYMENT_TYPE_LABELS,
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
const TAB_KEYS = new Set<string>(TABS.map((t) => t.key));

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
  const { data: positions = [] } = usePositions();
  const { locations } = useLocations();
  const { api, setEmployeeKioskPin } = useHrModule();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfigured, setPinConfigured] = useState(false);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  // Permite deep-link direto a uma tab (ex: a partir de uma pendência
  // prioritária em "Pessoas", `?tab=documentos`).
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(initialTab && TAB_KEYS.has(initialTab) ? (initialTab as TabKey) : "resumo");
  // Idem para a categoria (ex: a partir de "Pessoas > Documentos", `?category=contrato_trabalho`) — evita repetir a escolha já feita lá (task "Melhorar Visão Geral e reorganizar Pessoas", secção 9).
  const initialCategory = searchParams.get("category");
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

  // Microfeedback "✓ …" discreto após ações simples (task UI Motion §16).
  const success = useSuccessFlash();
  const [successLabel, setSuccessLabel] = useState("Guardado");
  function confirmSaved(label: string) {
    setSuccessLabel(label);
    success.flash();
  }

  const updateMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload | UpdateEmployeePayload) =>
      api.updateEmployee(id!, payload as UpdateEmployeePayload),
    onSuccess: () => {
      invalidateProfile();
      setDrawerOpen(false);
      confirmSaved("Perfil guardado");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "inactive") => api.setEmployeeStatus(id!, status),
    onSuccess: () => {
      invalidateProfile();
      confirmSaved("Estado atualizado");
    },
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.uploadEmployeePhoto(id!, file),
    onSuccess: () => {
      invalidateProfile();
      confirmSaved("Fotografia atualizada");
    },
  });

  const pinMutation = useMutation({
    mutationFn: (pin: string) => setEmployeeKioskPin.execute(id!, pin),
    onSuccess: () => {
      setPinConfigured(true);
      closePinModal();
      confirmSaved("PIN guardado");
    },
  });

  function closePinModal() {
    setPinModalOpen(false);
    setPinInput("");
    pinMutation.reset();
  }

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
          ← Voltar a Colaboradores
        </Link>
      </div>
    );
  }

  const e = profile.employee;
  const isActive = e.status === "active";
  const positionName = positionNameOf(positions, e.positionId);
  const primaryLocationName = locationNameOf(locations, e.primaryLocationId);
  const otherLocationNames = e.authorizedLocationIds.map((id) => locationNameOf(locations, id)).join(", ") || null;

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
            Colaboradores
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
                  key={String(isActive)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${MOTION_FADE} ${
                    isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-stone-400"}`} />
                  {isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-sm text-stone-500">
                {positionName}
                {e.primaryLocationId && <span className="text-stone-400"> · {primaryLocationName}</span>}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <MotionSuccess visible={success.visible} label={successLabel} />
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

      {/* Troca de tab: só fade do conteúdo (sem deslocamento nem recarregar a página). */}
      <MotionFade key={tab} variant="fade" className="p-6">
        {tab === "resumo" && (
          <div className="space-y-6">
            <MotionStagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                {/* Dados cadastrais apenas — a documentação conta à parte, no card seguinte (task §19). */}
                <p className="text-xs font-medium text-stone-500">Dados do perfil</p>
                <p className="mt-1 text-xl font-bold text-stone-800">
                  <MotionNumber value={profile.profileCompletionPercent} format={(n) => `${n}% completos`} />
                </p>
                <MotionProgress value={profile.profileCompletionPercent} label="Dados do perfil" trackClassName="mt-2 h-1.5 rounded-full bg-stone-100" />
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Documentos obrigatórios</p>
                <p className="mt-1 text-xl font-bold text-stone-800">
                  {profile.documents.mandatoryCompleted}/{profile.documents.mandatoryTotal}
                </p>
                {profile.documents.missingRequirements.length > 0 && (
                  <p className="mt-0.5 text-xs text-amber-600">{profile.documents.missingRequirements.length} em falta</p>
                )}
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Próximos vencimentos</p>
                <p className="mt-1 text-xl font-bold text-amber-600">
                  <MotionNumber value={profile.documents.expiringSoonCount} />
                </p>
                <p className="mt-0.5 text-xs text-stone-400">nos próximos 30 dias</p>
              </div>
            </MotionStagger>

            <MotionStagger className="grid grid-cols-1 gap-4 md:grid-cols-2" startIndex={3}>
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
                  <InfoRow label="Cargo" value={e.positionId ? positionName : null} />
                  <InfoRow label="Local principal" value={e.primaryLocationId ? primaryLocationName : null} />
                  <InfoRow label="Outros locais autorizados" value={otherLocationNames} />
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
            </MotionStagger>

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
            {isAdmin && (
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-5">
                <h3 className="text-sm font-semibold text-stone-800">PIN de Kiosk</h3>
                <p className="mt-1 text-xs text-stone-500">
                  O colaborador usa este PIN de 4 dígitos para registar o ponto através do QR code na loja.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {pinConfigured && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      PIN configurado
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(true)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    {pinConfigured ? "Alterar PIN" : "Definir PIN"}
                  </button>
                </div>
              </div>
            )}
            {(user?.role === "admin" || user?.role === "manager") && id && <PortalAccessCard employeeId={id} employeeName={e.fullName} />}
          </div>
        )}

        {tab === "documentos" && id && (
          <EmployeeDocumentsTab
            employeeId={id}
            profile={profile}
            initialCategory={initialCategory}
            onViewFullHistory={() => setTab("historico")}
          />
        )}

        {tab === "contrato" && (
          <div className="max-w-2xl space-y-4 rounded-xl border border-[#F5C992]/40 bg-white p-5">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Vínculo" value={EMPLOYMENT_TYPE_LABELS[e.employmentType]} />
              <InfoRow label="Cargo" value={e.positionId ? positionName : null} />
              <InfoRow label="Local principal" value={e.primaryLocationId ? primaryLocationName : null} />
              <InfoRow label="Outros locais autorizados" value={otherLocationNames} />
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
      </MotionFade>

      <EmployeeDrawer
        open={drawerOpen}
        editing={e}
        onClose={() => setDrawerOpen(false)}
        onSave={(payload) => updateMutation.mutate(payload)}
        saving={updateMutation.isPending}
      />
      <MotionPresence show={pinModalOpen}>
        <MotionLayer kind="overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <MotionLayer kind="modal" className="w-full max-w-sm rounded-xl border border-stone-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 className="text-base font-semibold text-stone-900">
                {pinConfigured ? "Alterar PIN de Kiosk" : "Definir PIN de Kiosk"}
              </h2>
              <button type="button" onClick={closePinModal} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-stone-600">
                Introduz um PIN de exatamente 4 dígitos para <strong>{e.fullName}</strong>.
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={KIOSK_PIN_LENGTH}
                value={pinInput}
                onChange={(ev) => setPinInput(ev.target.value.replace(/\D/g, "").slice(0, KIOSK_PIN_LENGTH))}
                placeholder="••••"
                autoFocus
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-center text-2xl tracking-[0.5em] focus:border-[#ED5C32] focus:outline-none"
              />
              <p className="text-xs text-stone-400">Cada colaborador deve ter um PIN único.</p>
              {pinMutation.isError && (
                <p className="text-sm text-red-600">
                  {pinMutation.error instanceof Error
                    ? pinMutation.error.message
                    : "Erro ao definir PIN."}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">
              <button
                type="button"
                onClick={closePinModal}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pinInput.length !== KIOSK_PIN_LENGTH || pinMutation.isPending}
                onClick={() => pinMutation.mutate(pinInput)}
                className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94f28] disabled:opacity-50"
              >
                {pinMutation.isPending ? "A guardar…" : "Guardar PIN"}
              </button>
            </div>
          </MotionLayer>
        </MotionLayer>
      </MotionPresence>
    </div>
  );
}
