/** Avisos automáticos (`POST /api/novo-rh/reminders/run`, FE-111). */
export interface RemindersApiPort {
  /** Verificar já os avisos devidos (o servidor faz o mesmo de 10 em 10 minutos). */
  run(): Promise<{ people: number; notices: number }>;
}
