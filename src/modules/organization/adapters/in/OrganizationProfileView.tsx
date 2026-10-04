import { useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { InvalidLogoFileError, OrganizationValidationError } from "../../domain/entities/organization-errors.ts";
import {
  COUNTRY_OPTIONS,
  ORGANIZATION_FIELD_LABELS,
  ORGANIZATION_STATUS_LABELS,
  TIMEZONE_OPTIONS,
  type EditableOrganizationField,
  type OrganizationFormValues,
  type OrganizationProfile,
} from "../../domain/entities/organization-profile.ts";
import { diffChanges, hasChanges, LOGO_ACCEPTED_TYPES, toFormValues } from "../../domain/services/organization-form.service.ts";
import { changedFieldLabels, historyActionLabel } from "../../domain/services/organization-history.service.ts";
import { CompanyStructureTabs } from "./CompanyStructureTabs.tsx";
import { useOrganizationHistory, useOrganizationProfile } from "./use-organization.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30 disabled:bg-stone-50 disabled:text-stone-500";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-stone-800">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type ProfileHook = ReturnType<typeof useOrganizationProfile>;

function LogoCard({ profile, canEdit, logoMutation }: { profile: OrganizationProfile; canEdit: boolean; logoMutation: ProfileHook["logoMutation"] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const error = logoMutation.error;

  return (
    <section className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
        {profile.logoUrl ? (
          <img src={profile.logoUrl} alt={`Logotipo de ${profile.name}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-stone-400">Sem logotipo</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-stone-900">{profile.name}</p>
        <p className="text-xs text-stone-500">
          {profile.legalName ?? "Razão social por preencher"} · NIF {profile.nif}
        </p>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            profile.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
          }`}
        >
          {ORGANIZATION_STATUS_LABELS[profile.status]}
        </span>
        {error && (
          <p className="mt-1 text-xs text-[#A3211A]">
            {error instanceof InvalidLogoFileError ? error.message : "Não foi possível guardar o logotipo."}
          </p>
        )}
      </div>
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={LOGO_ACCEPTED_TYPES.join(",")}
            className="hidden"
            aria-label="Ficheiro do logotipo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={logoMutation.isPending}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            {logoMutation.isPending ? "A enviar…" : profile.logoUrl ? "Substituir logotipo" : "Carregar logotipo"}
          </button>
        </>
      )}
    </section>
  );
}

function ProfileForm({
  profile,
  canEdit,
  updateMutation,
}: {
  profile: OrganizationProfile;
  canEdit: boolean;
  updateMutation: ProfileHook["updateMutation"];
}) {
  const [values, setValues] = useState<OrganizationFormValues>(() => toFormValues(profile));

  const fieldErrors = updateMutation.error instanceof OrganizationValidationError ? updateMutation.error.fieldErrors : [];
  const genericError = updateMutation.error && !(updateMutation.error instanceof OrganizationValidationError);
  const dirty = hasChanges(diffChanges(profile, values));

  function set(field: EditableOrganizationField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function errorOf(field: EditableOrganizationField): string | undefined {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  function field(name: EditableOrganizationField, opts: { type?: string; placeholder?: string; required?: boolean } = {}) {
    const error = errorOf(name);
    const id = `org-${name}`;
    return (
      <div>
        <label htmlFor={id} className={labelCls}>
          {ORGANIZATION_FIELD_LABELS[name]}
          {opts.required && <span className="text-[#ED5C32]"> *</span>}
        </label>
        <input
          id={id}
          type={opts.type ?? "text"}
          value={values[name]}
          placeholder={opts.placeholder}
          disabled={!canEdit}
          onChange={(e) => set(name, e.target.value)}
          className={`${inputCls} ${error ? "border-[#A3211A]" : ""}`}
          aria-invalid={error ? true : undefined}
        />
        {error && <p className="mt-1 text-xs text-[#A3211A]">{error}</p>}
      </div>
    );
  }

  function select(name: "country" | "timezone", options: { value: string; label: string }[]) {
    const id = `org-${name}`;
    const current = values[name];
    const withCurrent = options.some((o) => o.value === current) ? options : [{ value: current, label: current }, ...options];
    return (
      <div>
        <label htmlFor={id} className={labelCls}>
          {ORGANIZATION_FIELD_LABELS[name]}
        </label>
        <select id={id} value={current} disabled={!canEdit} onChange={(e) => set(name, e.target.value)} className={inputCls}>
          {withCurrent.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errorOf(name) && <p className="mt-1 text-xs text-[#A3211A]">{errorOf(name)}</p>}
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        updateMutation.mutate({ current: profile, values });
      }}
    >
      <Section title="Identificação">
        {field("name", { required: true })}
        {field("legalName", { required: true, placeholder: "Ex.: Exemplo Restauração, Lda" })}
        {field("nif", { required: true })}
        {field("niss")}
      </Section>
      <Section title="Morada fiscal">
        <div className="md:col-span-2">{field("address")}</div>
        {field("postalCode", { placeholder: values.country === "PT" ? "0000-000" : undefined })}
        {field("city")}
        {select("country", COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.label })))}
      </Section>
      <Section title="Contactos">
        {field("email", { type: "email" })}
        {field("phone", { type: "tel" })}
        {field("website", { placeholder: "exemplo.pt" })}
      </Section>
      <Section title="Preferências">{select("timezone", TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz })))}</Section>

      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          {updateMutation.isSuccess && !dirty && <span className="text-sm text-emerald-700">Alterações guardadas.</span>}
          {fieldErrors.length > 0 && <span className="text-sm text-[#A3211A]">Corrija os campos assinalados.</span>}
          {genericError && <span className="text-sm text-[#A3211A]">Não foi possível guardar. Tente novamente.</span>}
          <button
            type="submit"
            disabled={!dirty || updateMutation.isPending}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? "A guardar…" : "Guardar alterações"}
          </button>
        </div>
      ) : (
        <p className="text-right text-xs text-stone-500">Só administradores podem editar os dados da empresa.</p>
      )}
    </form>
  );
}

function HistorySection() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useOrganizationHistory(open);

  return (
    <section className="rounded-xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-stone-800"
        aria-expanded={open}
      >
        Histórico de alterações
        <span className="text-stone-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 px-5 py-3">
          {isLoading && <p className="text-sm text-stone-500">A carregar…</p>}
          {data && data.length === 0 && <p className="text-sm text-stone-500">Sem alterações registadas.</p>}
          <ul className="divide-y divide-stone-100">
            {data?.map((entry) => {
              const fields = changedFieldLabels(entry);
              return (
                <li key={entry.id} className="py-2 text-sm">
                  <p className="text-stone-800">
                    {historyActionLabel(entry.action)}
                    {fields.length > 0 && <span className="text-stone-500"> — {fields.join(", ")}</span>}
                  </p>
                  <p className="text-xs text-stone-500">
                    {fmtDateTime(entry.createdAt)} · {entry.actor}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Empresa & Estrutura → Empresa. Leitura para todos; edição, logotipo e histórico só `admin` (como o backend). */
export function OrganizationProfileView() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const { profileQuery, updateMutation, logoMutation } = useOrganizationProfile();
  const profile = profileQuery.data;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-stone-900">Empresa & Estrutura</h1>
        <p className="text-xs text-stone-500">Dados da entidade legal e estrutura da organização.</p>
        <CompanyStructureTabs />
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4">
        {profileQuery.isLoading && <p className="text-sm text-stone-500">A carregar…</p>}
        {profileQuery.isError && <p className="text-sm text-[#A3211A]">Não foi possível carregar os dados da empresa.</p>}
        {profile && (
          <>
            <LogoCard profile={profile} canEdit={canEdit} logoMutation={logoMutation} />
            {/* `key` reinicia o formulário quando o perfil gravado muda (sem setState em efeito); as mutations vivem aqui para sobreviver a esse remount. */}
            <ProfileForm key={profile.updatedAt} profile={profile} canEdit={canEdit} updateMutation={updateMutation} />
            {canEdit && <HistorySection />}
          </>
        )}
      </div>
    </div>
  );
}
