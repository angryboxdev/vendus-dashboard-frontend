export interface SetEmployeeKioskPinPort {
  execute(employeeId: string, pin: string): Promise<void>;
}
