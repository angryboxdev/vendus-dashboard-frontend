import { API_BASE } from "./api";

export type DeliveryStatus =
  | "pending"
  | "received"
  | "cooking"
  | "waiting_to_delivery"
  | "delivered"
  | "canceled";

export type DeliveryType = "table" | "delivery" | "takeaway" | "pickup";

export interface DeliveryItem {
  id: number;
  name: string;
  qty: number;
  notes: string;
}

export interface Delivery {
  id: number;
  reference: number;
  type: DeliveryType;
  status: DeliveryStatus;
  source: string;
  kitchenId: number;
  tableId: number;
  table: { id?: number; name?: string } | null;
  items: DeliveryItem[];
  extraInfo: string;
  dateCreate?: string;
  dateUpdate?: string;
}

export async function getDeliveries(): Promise<Delivery[]> {
  const res = await fetch(`${API_BASE}/api/kds/deliveries`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { deliveries: Delivery[] };
  return data.deliveries;
}

export async function updateDeliveryStatus(
  id: number,
  status: DeliveryStatus,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/kds/deliveries/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
