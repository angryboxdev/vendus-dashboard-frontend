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
  /** Jornada: duração de referência de 1 turno (min). */
  standardShiftMinutes: number;
  /** Jornada: prolongamento de fecho/limpeza que ainda conta como 1 turno (min). */
  closingToleranceMinutes: number;
  /** Jornada: a partir deste total (min) conta 2 turnos (dupla); entre turno+tolerância e isto, 1,5. */
  doubleShiftFromMinutes: number;
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
  standardShiftMinutes: number;
  closingToleranceMinutes: number;
  doubleShiftFromMinutes: number;
  controlStartDate: string | null;
}

/** Limites da jornada (1 turno / 1,5 / dupla). */
export type WorkdayRules = Pick<AttendanceRulesConfig, "standardShiftMinutes" | "closingToleranceMinutes" | "doubleShiftFromMinutes">;

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
