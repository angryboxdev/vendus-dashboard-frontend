/**
 * Regras de assiduidade (Fase 2.1) — configuração global da organização
 * (task, secção 3: nesta fase não há regras por colaborador/função/local).
 * Toda alteração gera uma nova vigência (`effectiveFrom`) em vez de
 * reescrever o valor anterior — ver `AttendanceRuleChangeEntry` para o
 * histórico/auditoria (task, secção 4).
 */
export interface AttendanceRulesConfig {
  /** Minutos após o início do turno sem considerar atraso. */
  entryToleranceMinutes: number;
  /** Minutos antes do fim do turno sem considerar saída antecipada. */
  earlyExitToleranceMinutes: number;
  /** Minutos após o início do turno sem entrada válida até passar a "ausente operacional". */
  absenceThresholdMinutes: number;
  /** Minutos antes do início do turno em que uma marcação pode ser associada automaticamente. */
  preShiftWindowMinutes: number;
  /** Minutos após o fim do turno em que uma marcação de saída ainda é aceite. */
  postShiftWindowMinutes: number;
  /**
   * "Início do controlo de assiduidade" (evolução "Assiduidade —
   * Conferência, Por Colaborador e Horas & Saldos", secção 11) — turnos
   * anteriores a esta data nunca geram pendência automática por
   * tolerância (ausência de marcação); um sinal manual já existente
   * continua a aparecer normalmente. `null` = sem limite.
   */
  controlStartDate: string | null;
  effectiveFrom: string;
  updatedBy: string;
  updatedAt: string;
}

export interface UpdateAttendanceRulesPayload {
  entryToleranceMinutes: number;
  earlyExitToleranceMinutes: number;
  absenceThresholdMinutes: number;
  preShiftWindowMinutes: number;
  postShiftWindowMinutes: number;
  controlStartDate: string | null;
}

/** Só os 5 campos numéricos — o histórico por campo não cobre `controlStartDate` (não é numérico, ver README). */
export type AttendanceToleranceField = Exclude<keyof UpdateAttendanceRulesPayload, "controlStartDate">;

export interface AttendanceRuleChangeEntry {
  id: string;
  field: AttendanceToleranceField;
  previousValue: number;
  newValue: number;
  effectiveFrom: string;
  changedBy: string;
  changedAt: string;
}
