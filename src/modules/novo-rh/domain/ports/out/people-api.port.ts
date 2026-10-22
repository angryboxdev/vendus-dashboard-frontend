import type {
  Agreement,
  CompensationAssignment,
  CompensationItem,
  Contract,
  ContractInput,
  CustomFieldDefinition,
  CustomValue,
  ImportResult,
  ManagerLink,
  Person,
  VersionedPerson,
} from "../../entities/people.ts";

/** Novo RH → Pessoas e catálogos. */
export interface PeopleApiPort {
  list(filter: { status?: "active" | "inactive" | "all"; q?: string }): Promise<Person[]>;
  get(id: string): Promise<VersionedPerson>;
  create(input: Partial<Person>): Promise<Person>;
  update(id: string, etag: string | null, input: Partial<Person> & { reason?: string }): Promise<VersionedPerson>;
  deactivate(id: string, etag: string | null, reason: string): Promise<VersionedPerson>;
  reactivate(id: string, etag: string | null, reason: string): Promise<VersionedPerson>;
  /** PIN do quiosque (4 dígitos; permissão hr.kiosk_pin). O PIN nunca volta do servidor. */
  setKioskPin(id: string, pin: string): Promise<void>;
  transfer(input: { employeeId: string; locationId: string; effectiveDate: string; reason: string }): Promise<void>;
  exportCsv(): Promise<Blob>;
  importCsv(csv: string, dryRun: boolean): Promise<ImportResult>;

  listContracts(id: string): Promise<Contract[]>;
  createContract(id: string, input: ContractInput): Promise<Contract>;
  cancelContract(id: string, contract: Contract, reason: string): Promise<Contract>;

  listManagers(id: string): Promise<ManagerLink[]>;
  addManager(id: string, input: Omit<ManagerLink, "id" | "employeeId">): Promise<ManagerLink>;
  endManager(id: string, linkId: string, validTo: string): Promise<ManagerLink>;
  /** Organograma: chefias diretas em vigor num dia (só entre quem se pode ver). */
  orgChart(date: string): Promise<{ employeeId: string; managerEmployeeId: string; linkId: string; validFrom: string }[]>;
  /** Organograma: mudar a chefia direta a partir de `validFrom` (`null` = sem chefia). */
  setDirectManager(id: string, managerEmployeeId: string | null, validFrom: string): Promise<ManagerLink | null>;

  listCompensations(id: string): Promise<CompensationAssignment[]>;
  assignCompensation(id: string, input: { itemId: string; amount: number | null; validFrom: string; validTo: string | null }): Promise<CompensationAssignment>;
  endCompensation(id: string, assignmentId: string, validTo: string): Promise<CompensationAssignment>;

  getCustomValues(id: string): Promise<CustomValue[]>;
  setCustomValues(id: string, values: Record<string, string | null>): Promise<CustomValue[]>;

  /** Cargos ativos (catálogo do Novo RH). */
  listPositions(): Promise<{ id: string; name: string }[]>;
  listAgreements(): Promise<Agreement[]>;
  createAgreement(input: { name: string; code: string | null }): Promise<Agreement>;
  archiveAgreement(id: string): Promise<void>;
  listCompensationItems(): Promise<CompensationItem[]>;
  createCompensationItem(input: Omit<CompensationItem, "id" | "active">): Promise<CompensationItem>;
  deactivateCompensationItem(id: string): Promise<void>;
  listCustomFields(): Promise<CustomFieldDefinition[]>;
  createCustomField(input: Omit<CustomFieldDefinition, "id" | "archived">): Promise<CustomFieldDefinition>;
  archiveCustomField(id: string): Promise<void>;
}
