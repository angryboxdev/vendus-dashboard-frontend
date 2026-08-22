export type RelationshipStatus = "new" | "recurring" | "vip";
export type CrmTag = { name: string; label: string; color: string; category: string; active: boolean };
export type CrmActionType = { code: string; name: string; color: string; active: boolean; system: boolean };
export type CrmTableItem = {
  id: string; firstName: string; lastName: string | null; fullName: string; phone: string | null;
  status: { relationship: RelationshipStatus; inactive: boolean; inactiveReason: string | null };
  orderCount: number; ltv: number; avgTicket: number; lastOrderDate: string | null;
  metricsSource: "crm_orders" | "eatz_snapshot" | "none";
  lastAction: { id: string; typeCode: string; typeName: string; completedAt: string; notes: string | null } | null;
  nextAction: { id: string; typeCode: string; typeName: string; scheduledFor: string; notes: string | null; scriptCode: string | null; source: "manual" | "system" } | null;
  followUpDate: string | null; tags: CrmTag[];
  lastScript: { code: string; name: string; sentAt: string } | null;
};
export type CrmTableFilters = {
  search?: string; status?: RelationshipStatus; activity?: "active" | "inactive"; tags?: string[];
  tagMode?: "any" | "all"; lastActionType?: string; nextActionType?: string;
  followUpState?: "overdue" | "today" | "upcoming" | "none";
  sortBy?: "name" | "customerId" | "status" | "orderCount" | "lastOrderDate" | "lastAction" | "followUpDate";
  sortDirection?: "asc" | "desc";
  page?: number; pageSize?: 10 | 25 | 50 | 100;
};
export type CustomerTableResult = { items: CrmTableItem[]; total: number; page: number; pageSize: number };
export type CrmActionHistoryItem = {
  id: string; customerId: string; actionTypeCode: string; actionTypeName: string; actionTypeColor: string;
  status: "pending" | "completed" | "cancelled"; scheduledFor: string | null;
  completedAt: string | null; notes: string | null; scriptCode: string | null; createdAt: string;
};
export type CrmActionHistoryPage = { pending: CrmActionHistoryItem | null; history: CrmActionHistoryItem[]; total: number; nextCursor: string | null };
