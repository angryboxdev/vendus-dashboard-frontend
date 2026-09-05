import { API_BASE } from "./api";
import { deviceFetch } from "../modules/location-credentials/adapters/out/device-fetch.ts";

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
  /** Unix ms — set by backend when AirMenu order is marked delivered; cleared on revert. */
  deliveredAt?: number;
}

export async function getDeliveries(): Promise<Delivery[]> {
  const res = await deviceFetch(`${API_BASE}/api/kds/deliveries`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { deliveries: Delivery[] };
  return data.deliveries;
}

export async function updateDeliveryStatus(
  id: number,
  status: DeliveryStatus,
): Promise<void> {
  const res = await deviceFetch(`${API_BASE}/api/kds/deliveries/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function updateAirMenuDeliveryStatus(
  id: number,
  status: DeliveryStatus,
): Promise<void> {
  const res = await deviceFetch(`${API_BASE}/api/kds/air-menu-deliveries/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
