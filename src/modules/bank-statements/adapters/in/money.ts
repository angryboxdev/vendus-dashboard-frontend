/**
 * Euros com os milhares sempre separados («5 434,26 €»): o pt-PT por defeito não agrupa números de 4
 * dígitos («5434,26 €») e as colunas da tabela da conta desalinham. Só para a vista da conta (task V3).
 */
const EUR = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", useGrouping: true });

export const eur = (cents: number) => EUR.format(cents / 100);

/** «+581,04 €» / «−5 434,26 €» (sinal de menos tipográfico). */
export const signedEur = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${EUR.format(Math.abs(cents) / 100)}`;
