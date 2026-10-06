export type EmployeeStatus = "active" | "inactive";
export type EmploymentType = "permanent" | "contract" | "extra";
export type SalaryType = "fixed" | "hourly";
export type DocumentSituation = "ok" | "expiring" | "missing";

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent: "Efetivo",
  contract: "Contrato",
  extra: "Extra",
};

export interface Employee {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleOrNotes: string | null;
  employmentType: EmploymentType;
  /** Cargo (Base Organizacional). */
  positionId: string | null;
  /** Local principal. */
  primaryLocationId: string | null;
  /** Outros locais autorizados. */
  authorizedLocationIds: string[];
  status: EmployeeStatus;
  hiredAt: string | null;
  endedAt: string | null;
  baseSalary: number | null;
  salaryType: SalaryType;
  hourlyRate: number | null;
  nif: string | null;
  iban: string | null;
  address: string | null;
  birthDate: string | null;
  socialSecurityNumber: string | null;
  idCardNumber: string | null;
  nationality: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListRow {
  id: string;
  fullName: string;
  positionId: string | null;
  primaryLocationId: string | null;
  employmentType: EmploymentType;
  email: string | null;
  phone: string | null;
  status: EmployeeStatus;
  photoUrl: string | null;
  profileCompletionPercent: number;
  documentSituation: DocumentSituation;
  updatedAt: string;
}

export interface ListEmployeesParams {
  search?: string;
  status?: "active" | "inactive" | "all";
  employmentType?: EmploymentType;
  documentSituation?: DocumentSituation;
  profileComplete?: "complete" | "incomplete";
  positionId?: string;
  /** Local principal ou autorizado. */
  locationId?: string;
  page: number;
  pageSize: number;
}

export interface ListEmployeesResult {
  items: EmployeeListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PriorityPendencyEmployeeRef {
  employeeId: string;
  employeeName: string;
  /** Só preenchido para `kind: "expiring_document"` — validade do documento a expirar. */
  expiresAt?: string;
}

export interface PriorityPendency {
  kind: "missing_field" | "missing_document" | "expiring_document";
  detail: string;
  employees: PriorityPendencyEmployeeRef[];
}

export interface PeopleKpis {
  activeEmployees: number;
  incompleteProfiles: number;
  documentsExpiringSoon: number;
  priorityPendencies: PriorityPendency[];
}

export interface EmployeeProfile {
  employee: Employee;
  profileCompletionPercent: number;
  sections: {
    personalData: boolean;
    address: boolean;
    contractData: boolean;
    bankAccount: boolean;
    emergencyContact: boolean;
  };
  documents: {
    mandatoryTotal: number;
    mandatoryCompleted: number;
    /** Nomes amigáveis dos requisitos por cumprir (ex: "Documento de identificação"), não slugs de categoria. */
    missingRequirements: string[];
    /** Categorias opcionais (configuráveis) ainda sem documento — só aparece aqui, nunca nas pendências prioritárias. */
    missingOptional: string[];
    expiringSoonCount: number;
  };
  alerts: Array<{ type: "document_expiring" | "document_missing" | "emergency_contact_pending"; message: string }>;
}

export interface CreateEmployeePayload {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  roleOrNotes?: string | null;
  employmentType?: EmploymentType;
  /** Cargo (substitui a antiga "Função"). */
  positionId?: string | null;
  primaryLocationId?: string | null;
  authorizedLocationIds?: string[];
  hiredAt?: string | null;
  baseSalary?: number | null;
  salaryType?: SalaryType;
  hourlyRate?: number | null;
  nif?: string | null;
  iban?: string | null;
  address?: string | null;
  birthDate?: string | null;
  socialSecurityNumber?: string | null;
  idCardNumber?: string | null;
  nationality?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

export interface EmployeeHistoryEntry {
  id: string;
  createdAt: string;
  entityType: "employee" | "employee_document";
  action: string;
  actor: string;
  description: string;
}

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  employee_created: "Colaborador criado",
  employee_updated: "Dados atualizados",
  employee_status_changed: "Estado alterado",
  employee_photo_updated: "Foto atualizada",
  document_created: "Documento enviado",
  document_replaced: "Documento substituído",
  document_removed: "Documento removido",
};
