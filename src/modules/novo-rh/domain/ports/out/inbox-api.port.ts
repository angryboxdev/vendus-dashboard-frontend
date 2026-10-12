import type { DecisionResult, InboxList, InboxSegment, InboxType } from "../../entities/inbox.ts";

export interface InboxApiPort {
  list(filter: { type: InboxType | null; segment: InboxSegment }): Promise<InboxList>;
  decide(keys: string[], decision: "approve" | "reject", comment: string | null): Promise<DecisionResult[]>;
}
