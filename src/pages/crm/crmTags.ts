export const ALL_TAGS = [
  "elogiou",
  "reclamou",
  "feedback_neutro",
  "review_solicitada",
  "promotor",
  "social_follower",
  "veio_indicado",
  "indicou_alguem",
  "fez_evento",
  "cliente_internacional",
  "frequencia_em_queda",
  "cancelou",
  "hesitou_1a_compra",
  "problema_tecnico",
  "lead_frio",
  "inativo_definitivo",
  "ausencia_justificada",
  "so_nao_pedi",
  "consultou_e_respondeu",
] as const;

export type CrmTag = (typeof ALL_TAGS)[number];

export const TAG_META: Record<CrmTag, { emoji: string; label: string }> = {
  elogiou:               { emoji: "😊", label: "Elogiou" },
  reclamou:              { emoji: "😡", label: "Reclamou" },
  feedback_neutro:       { emoji: "😐", label: "Feedback neutro" },
  review_solicitada:     { emoji: "⭐", label: "Review solicitada" },
  promotor:              { emoji: "📣", label: "Promotor" },
  social_follower:       { emoji: "📱", label: "Seguiu nas redes" },
  veio_indicado:         { emoji: "👥", label: "Veio indicado" },
  indicou_alguem:        { emoji: "🤝", label: "Indicou alguém" },
  fez_evento:            { emoji: "🎉", label: "Fez evento" },
  cliente_internacional: { emoji: "✈️",  label: "Internacional" },
  frequencia_em_queda:   { emoji: "📉", label: "Frequência em queda" },
  cancelou:              { emoji: "❌", label: "Cancelou" },
  hesitou_1a_compra:     { emoji: "🤔", label: "Hesitou na 1ª compra" },
  problema_tecnico:      { emoji: "🔧", label: "Problema técnico" },
  lead_frio:             { emoji: "🧊", label: "Lead frio" },
  inativo_definitivo:    { emoji: "🪦", label: "Inativo definitivo" },
  ausencia_justificada:  { emoji: "📅", label: "Ausência justificada" },
  so_nao_pedi:           { emoji: "🙅", label: "Só não pediu" },
  consultou_e_respondeu: { emoji: "💬", label: "Consultou e respondeu" },
};

export function tagLabel(tag: string): string {
  const meta = TAG_META[tag as CrmTag];
  return meta ? `${meta.emoji} ${meta.label}` : tag;
}
