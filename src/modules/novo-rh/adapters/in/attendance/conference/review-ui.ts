import type { StatusTone } from "../../../../../../components/ui/index.ts";
import type { ExclusionReason, ReviewDecision, ReviewState } from "../../../../domain/entities/attendance-review.ts";

/**
 * Textos e tons da conferência V2 (pré-visualização). Na integração passam
 * para chaves `att.review.*` do i18n; ficam aqui juntos para se rever o texto.
 * Cores contidas: verde conforme, âmbar rever, vermelho só falta.
 */
export const STATE: Record<ReviewState, { label: string; tone: StatusTone }> = {
  ok: { label: "Conforme", tone: "success" },
  reviewed: { label: "Revisto", tone: "success" },
  review: { label: "Por rever", tone: "warning" },
  late: { label: "Atraso", tone: "warning" },
  absent: { label: "Falta", tone: "danger" },
  justified: { label: "Justificada", tone: "neutral" },
  in_progress: { label: "Em curso", tone: "neutral" },
  day_off: { label: "Folga", tone: "neutral" },
  no_schedule: { label: "Sem escala", tone: "neutral" },
  future: { label: "Futuro", tone: "neutral" },
};

export const DECISION: Record<ReviewDecision, { label: string; hint: string }> = {
  fulfilled: {
    label: "Cumpriu o horário planeado",
    hint: "O trabalho foi feito, a picagem é que está errada. Valida as horas do horário publicado.",
  },
  keep: {
    label: "Manter a marcação original",
    hint: "O registo corresponde ao que aconteceu (atraso, saída antecipada). Fica revisto, sem mudar horas.",
  },
  manual: {
    label: "Corrigir manualmente",
    hint: "Ajustar entrada, saída ou pausa de um dia, com motivo.",
  },
  absence: {
    label: "Registar ou justificar ausência",
    hint: "Usa os tipos de ausência existentes; nunca gera horas trabalhadas.",
  },
};

export const REASON: Record<ExclusionReason, string> = {
  closed: "Período fechado",
  in_progress: "Turno ainda em curso",
  future: "Dia futuro",
  day_off: "Folga ou feriado",
  absence: "Ausência aprovada",
  no_schedule: "Sem escala publicada",
  schedule_exception: "Trabalho sem escala publicada — resolver no planeamento",
  no_punches: "Sem picagens — confirmar trabalho dia a dia",
  single_punch: "Só uma picagem — rever o dia",
  overtime: "Trabalhou além do planeado — horas reais preservadas",
  has_work: "Tem trabalho registado — rever o dia",
  already_ok: "Já conforme",
  already_reviewed: "Já revisto",
  batch_manual: "A correção manual é feita dia a dia",
};

/** Motivo padrão (o gestor pode escolher outro e acrescentar detalhe). */
export const REASONS = [
  "Erro de picagem confirmado pelo gestor",
  "Esquecimento de picagem",
  "Falha do equipamento de picagem",
  "Atraso confirmado",
  "Outro",
] as const;

/** Tipos de ausência — na integração vêm de Ausências (tipos e regras atuais), nunca inventados aqui. */
export const ABSENCE_TYPES = ["Falta justificada", "Falta injustificada", "Doença", "Férias"] as const;

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** "Seg 26" a partir de "2026-10-26". */
export const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${WEEKDAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}`;
};
export const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
export const keyOf = (employeeId: string, date: string) => `${employeeId}|${date}`;
