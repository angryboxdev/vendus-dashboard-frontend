import type { CustosVariaveisPayload } from "./custosVariaveis.types";

export const MOCK_CUSTOS_VARIAVEIS: CustosVariaveisPayload = {
  producao: [
    { id: "1", descricao: "Makro", valor: 1657.87, valorSemIva: 1348.67, observacao: "" },
    {
      id: "2",
      descricao: "Dream Plus",
      valor: 751.29,
      valorSemIva: 610.81,
      observacao: "Faturas: 418, 1618, 2772, 3960",
    },
    {
      id: "3",
      descricao: "Unpacks",
      valor: 522.75,
      valorSemIva: 425.0,
      observacao: "Fatura: FT 2026/44",
    },
    {
      id: "4",
      descricao: "San Miguel",
      valor: 500.0,
      valorSemIva: 406.5,
      observacao: "VERIFICAR VALOR",
    },
    {
      id: "5",
      descricao: "Envases Del Mediterraneo",
      valor: 79.98,
      valorSemIva: 79.98,
      observacao: "Pedido: OKWAGPLEV",
    },
  ],
  venda: [
    { id: "6", descricao: "Taxa TPA", valor: 51.84, valorSemIva: 51.84, observacao: "" },
    {
      id: "7",
      descricao: "Taxa Apps",
      valor: 2173.39,
      valorSemIva: 1673.51,
      observacao: "",
    },
  ],
};
