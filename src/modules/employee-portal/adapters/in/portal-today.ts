/** Data de hoje em Lisboa (`YYYY-MM-DD`) — o calendário do negócio, não o fuso do telemóvel. */
export function todayLisbon(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}
