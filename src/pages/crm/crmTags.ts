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
