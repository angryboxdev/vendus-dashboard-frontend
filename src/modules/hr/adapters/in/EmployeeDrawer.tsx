import { useState, type FormEvent } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_ROLE_LABELS,
  type CreateEmployeePayload,
  type Employee,
  type EmploymentType,
  type JobRole,
  type SalaryType,
  type UpdateEmployeePayload,
} from "../../domain/entities/employee.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

interface EmployeeDrawerProps {
  open: boolean;
  editing: Employee | null;
  onClose: () => void;
  onSave: (payload: CreateEmployeePayload | UpdateEmployeePayload, id?: string) => void;
  saving: boolean;
}

export function EmployeeDrawer({ open, editing, onClose, onSave, saving }: EmployeeDrawerProps) {
  const isEdit = editing !== null;

  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(editing?.employmentType ?? "permanent");
  const [jobRole, setJobRole] = useState<JobRole>(editing?.jobRole ?? "service");
  const [hiredAt, setHiredAt] = useState(editing?.hiredAt?.slice(0, 10) ?? "");
  const [salaryType, setSalaryType] = useState<SalaryType>(editing?.salaryType ?? "fixed");
  const [baseSalary, setBaseSalary] = useState(editing?.baseSalary != null ? String(editing.baseSalary) : "");
  const [hourlyRate, setHourlyRate] = useState(editing?.hourlyRate != null ? String(editing.hourlyRate) : "");
  const [nif, setNif] = useState(editing?.nif ?? "");
  const [iban, setIban] = useState(editing?.iban ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [birthDate, setBirthDate] = useState(editing?.birthDate?.slice(0, 10) ?? "");
  const [socialSecurityNumber, setSocialSecurityNumber] = useState(editing?.socialSecurityNumber ?? "");
  const [idCardNumber, setIdCardNumber] = useState(editing?.idCardNumber ?? "");
  const [nationality, setNationality] = useState(editing?.nationality ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(editing?.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(editing?.emergencyContactPhone ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      fullName,
      email: email || null,
      phone: phone || null,
      employmentType,
      jobRole,
      hiredAt: hiredAt || null,
      salaryType,
      baseSalary: salaryType === "fixed" && baseSalary ? Number(baseSalary) : null,
      hourlyRate: salaryType === "hourly" && hourlyRate ? Number(hourlyRate) : null,
      nif: nif || null,
      iban: iban || null,
      address: address || null,
      birthDate: birthDate || null,
      socialSecurityNumber: socialSecurityNumber || null,
      idCardNumber: idCardNumber || null,
      nationality: nationality || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
    };
    onSave(payload, isEdit ? editing!.id : undefined);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? "Editar colaborador" : "Novo colaborador"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div>
            <label className={labelCls}>
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Vínculo & Contrato</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Vínculo</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                  className={inputCls}
                >
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Função</label>
                <select value={jobRole} onChange={(e) => setJobRole(e.target.value as JobRole)} className={inputCls}>
                  {Object.entries(JOB_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Data de admissão</label>
                <input type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tipo de remuneração</label>
                <select
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                  className={inputCls}
                >
                  <option value="fixed">Salário fixo (€/mês)</option>
                  <option value="hourly">À hora (€/hora)</option>
                </select>
              </div>
              {salaryType === "fixed" ? (
                <div>
                  <label className={labelCls}>Salário base (€/mês)</label>
                  <NumericInput value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className={inputCls} />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Valor por hora (€/hora)</label>
                  <NumericInput value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Dados pessoais</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>NIF</label>
                <input value={nif} onChange={(e) => setNif(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>IBAN</label>
                <input value={iban} onChange={(e) => setIban(e.target.value)} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Morada</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data de nascimento</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nacionalidade</label>
                <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nº Segurança Social</label>
                <input
                  value={socialSecurityNumber}
                  onChange={(e) => setSocialSecurityNumber(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nº Cartão de Cidadão</label>
                <input value={idCardNumber} onChange={(e) => setIdCardNumber(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Contacto de emergência</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Nome</label>
                <input
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="mt-auto flex justify-end gap-2 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
