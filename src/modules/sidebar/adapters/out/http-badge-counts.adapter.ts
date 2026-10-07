import { apiGet } from "../../../../lib/api.ts";
import type { BadgeCountsPort } from "../../domain/ports/out/badge-counts.port.ts";

export class HttpBadgeCountsAdapter implements BadgeCountsPort {
  async pendingHrRequests(): Promise<number> {
    return (await apiGet<{ total: number }>("/api/hr/requests")).total;
  }
}
