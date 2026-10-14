import { apiGet, apiPostBinary, apiWrite } from "../../../../lib/api.ts";
import type { AssistantReply, AssistantScreenContext, AssistantStatus, ChatTurn } from "../../domain/entities/assistant.ts";
import type { AssistantApiPort } from "../../domain/ports/out/assistant-api.port.ts";

const B = "/api/novo-rh/assistant";

export class HttpAssistantApiAdapter implements AssistantApiPort {
  status() {
    return apiGet<AssistantStatus>(`${B}/status`);
  }
  async chat(input: { context: AssistantScreenContext; history: ChatTurn[]; message: string }, idempotencyKey: string) {
    return (await apiWrite<AssistantReply>(`${B}/chat`, { body: input, idempotencyKey })).data;
  }
  async confirm(token: string, idempotencyKey: string) {
    return (await apiWrite<AssistantReply>(`${B}/confirm`, { body: { token }, idempotencyKey })).data;
  }
  async cancel(token: string, idempotencyKey: string) {
    await apiWrite<unknown>(`${B}/cancel`, { body: { token }, idempotencyKey }).catch(() => undefined);
  }
  async transcribe(audio: Blob) {
    return (await apiPostBinary<{ text: string }>(`${B}/transcribe`, audio, audio.type || "audio/webm")).text;
  }
}
