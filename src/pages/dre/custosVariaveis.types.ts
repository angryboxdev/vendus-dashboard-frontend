export type CustosVariaveisItem = {
  id: string;
  descricao: string;
  valor: number;
  valorSemIva: number;
  observacao: string;
};

export type CustosVariaveisPayload = {
  producao: CustosVariaveisItem[];
  venda: CustosVariaveisItem[];
};
