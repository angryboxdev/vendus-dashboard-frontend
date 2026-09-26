import type {
  CreateEmployeePayload,
  Employee,
  EmployeeHistoryEntry,
  EmployeeProfile,
  ListEmployeesParams,
  ListEmployeesResult,
  PeopleKpis,
  UpdateEmployeePayload,
} from "../../entities/employee.ts";
import type {
  EmployeeDocument,
  ReplaceDocumentPayload,
  UploadDocumentPayload,
} from "../../entities/employee-document.ts";
import type {
  ConfirmShiftAttendancePayload,
  HrOverview,
  ListShiftsToReviewParams,
  ListShiftsToReviewResult,
} from "../../entities/overview.ts";

export interface HrApiPort {
  listEmployees(params: ListEmployeesParams): Promise<ListEmployeesResult>;
  getKpis(): Promise<PeopleKpis>;
  getEmployeeProfile(id: string): Promise<EmployeeProfile>;
  createEmployee(payload: CreateEmployeePayload): Promise<Employee>;
  updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee>;
  setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<Employee>;
  uploadEmployeePhoto(id: string, file: File): Promise<{ photoUrl: string }>;
  getEmployeeHistory(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: EmployeeHistoryEntry[]; total: number }>;

  listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  uploadEmployeeDocument(employeeId: string, payload: UploadDocumentPayload): Promise<EmployeeDocument>;
  replaceEmployeeDocument(
    employeeId: string,
    documentId: string,
    payload: ReplaceDocumentPayload,
  ): Promise<EmployeeDocument>;
  removeEmployeeDocument(employeeId: string, documentId: string): Promise<void>;
  getEmployeeDocumentDownloadUrl(employeeId: string, documentId: string): Promise<string>;
  getEmployeeDocumentHistory(employeeId: string, documentId: string): Promise<EmployeeDocument[]>;

  getOverview(locationId?: string): Promise<HrOverview>;
  listShiftsToReview(params: ListShiftsToReviewParams): Promise<ListShiftsToReviewResult>;
  /** Chama a rota legacy `PATCH /api/hr/shifts/:id/attendance` diretamente — não importa `src/pages/hr/hrApi.ts`. */
  confirmShiftAttendance(shiftId: string, payload: ConfirmShiftAttendancePayload): Promise<void>;
}
