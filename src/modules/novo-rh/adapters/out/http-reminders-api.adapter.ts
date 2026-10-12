import { apiWrite } from "../../../../lib/api.ts";
import type { RemindersApiPort } from "../../domain/ports/out/reminders-api.port.ts";

export class HttpRemindersApiAdapter implements RemindersApiPort {
  async run() {
    return (await apiWrite<{ people: number; notices: number }>("/api/novo-rh/reminders/run", {})).data;
  }
}
