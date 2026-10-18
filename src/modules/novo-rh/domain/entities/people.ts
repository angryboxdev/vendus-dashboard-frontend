/** Contrato com `/api/novo-rh/people` e `/api/novo-rh/catalog` (backend, módulo people). */

export interface Person {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  personalEmail: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  birthDate: string | null;
  gender: string | null;
  nationality: string | null;
  niss: string | null;
  idCardNumber: string | null;
  iban: string | null;
  hireDate: string | null;
  primaryLocationId: string | null;
  positionId: string | null;
  status: "active" | "inactive";
  currency: string;
  payPeriod: "monthly" | "biweekly" | "weekly";
  baseSalary: number | null;
  hourlyRate: number | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  userId: string | null;
  /** Foto (URL assinado de curta duração) ou null. */
  photoUrl: string | null;
  version: number;
  /** Campos que quem vê não pode ver (vêm a null). */
  hidden: string[];
  /** Obrigatórios em falta (ficha "a completar"). */
  missing: string[];
  /** Só na lista: horas semanais do contrato vigente hoje (null = sem contrato ou sem horas). */
  weeklyHours?: number | null;
}

export type PersonField = Exclude<keyof Person, "id" | "fullName" | "photoUrl" | "status" | "deactivatedAt" | "deactivationReason" | "userId" | "version" | "hidden" | "missing" | "weeklyHours">;

export interface Contract {
  id: string;
  contractType: "permanent" | "fixed_term" | "temporary" | "internship" | "other";
  code: string | null;
  startDate: string;
  endDate: string | null;
  seniorityDate: string | null;
  probationEnd: string | null;
  weeklyHours: number | null;
  fte: number | null;
  agreementId: string | null;
  remote: boolean;
  comment: string | null;
  status: "active" | "cancelled";
  version: number;
  etag: string;
}
export type ContractInput = Omit<Contract, "id" | "status" | "version" | "etag">;

export interface Agreement {
  id: string;
  name: string;
  code: string | null;
  archived: boolean;
}

export type ManagerKind = "direct" | "approver_time" | "approver_leave";
export interface ManagerLink {
  id: string;
  employeeId: string;
  managerEmployeeId: string;
  kind: ManagerKind;
  level: number;
  validFrom: string;
  validTo: string | null;
}

export interface CompensationItem {
  id: string;
  kind: "complement" | "benefit";
  name: string;
  code: string | null;
  mode: "fixed" | "variable" | "employee" | "services" | "copayment";
  amount: number;
  employeeAmount: number | null;
  currency: string;
  payPeriod: "monthly" | "biweekly" | "weekly";
  everyNMonths: number;
  active: boolean;
}

export interface CompensationAssignment {
  id: string;
  itemId: string;
  amount: number | null;
  validFrom: string;
  validTo: string | null;
}

export interface CustomFieldDefinition {
  id: string;
  section: "personal" | "work" | "custom";
  name: string;
  format: "text" | "options";
  options: string[];
  sensitive: boolean;
  archived: boolean;
}

export interface CustomValue {
  field: CustomFieldDefinition;
  value: string | null;
  hidden: boolean;
}

export interface ImportResult {
  dryRun: boolean;
  total: number;
  valid: number;
  created: number;
  rows: { line: number; ok: boolean; errors: string[]; name: string }[];
}

export interface VersionedPerson {
  person: Person;
  etag: string | null;
}
