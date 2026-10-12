import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { DecisionResult, InboxList, InboxSegment, InboxType } from "../../domain/entities/inbox.ts";
import type { InboxApiPort } from "../../domain/ports/out/inbox-api.port.ts";

const P = "/api/novo-rh/inbox";

export class HttpInboxApiAdapter implements InboxApiPort {
  list(filter: { type: InboxType | null; segment: InboxSegment }) {
    const q = new URLSearchParams({ segment: filter.segment });
    if (filter.type) q.set("type", filter.type);
    return apiGet<InboxList>(`${P}?${q.toString()}`);
  }
  async decide(keys: string[], decision: "approve" | "reject", comment: string | null) {
    return (await apiWrite<{ results: DecisionResult[] }>(`${P}/decide`, { body: { items: keys, decision, comment } })).data.results;
  }
}
