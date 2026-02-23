export type ReceitaBrutaItem = {
  id: string;
  descricao: string;
  valor: number;
  taxa: number;
  observacao: string;
};

export type ReceitaBrutaPayload = {
  dinheiro: ReceitaBrutaItem[];
  tpa: ReceitaBrutaItem[];
  apps: ReceitaBrutaItem[];
  tax_amount: number;
};

export type ReceitaBrutaSectionKey = "dinheiro" | "tpa" | "apps";

export const RECEITA_BRUTA_TAX_RATE: Record<ReceitaBrutaSectionKey, number> = {
  dinheiro: 0,
  tpa: 0.01,
  apps: 0.3,
};
