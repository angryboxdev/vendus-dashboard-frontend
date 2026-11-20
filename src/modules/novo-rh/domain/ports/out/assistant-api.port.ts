import type { AssistantReply, AssistantScreenContext, AssistantStatus, ChatTurn, HelpReply } from "../../entities/assistant.ts";

/** Assistente Mezza (`/api/novo-rh/assistant`). As chaves de idempotência vêm de quem chama (retry = mesma chave). */
export interface AssistantApiPort {
  status(): Promise<AssistantStatus>;
  chat(input: { context: AssistantScreenContext; history: ChatTurn[]; message: string }, idempotencyKey: string): Promise<AssistantReply>;
  confirm(token: string, idempotencyKey: string): Promise<AssistantReply>;
  cancel(token: string, idempotencyKey: string): Promise<void>;
  transcribe(audio: Blob): Promise<string>;
  /** Ajuda do RH («como faço…?») — só leitura do guia, sem Idempotency-Key. */
  helpStatus(): Promise<{ available: boolean }>;
  help(input: { history: ChatTurn[]; message: string; page: string }): Promise<HelpReply>;
}
