import { apiGet } from "../../../../lib/api.ts";
import type { AirMenuApiPort } from "../../domain/ports/out/air-menu-api.port.ts";
import type { AirMenuOrder, AirMenuDocumentType } from "../../domain/entities/air-menu-order.ts";
import type { AirMenuEnterprise } from "../../domain/entities/air-menu-enterprise.ts";
import type { AirMenuSummaryData, AirMenuAnalyticsData } from "../../domain/entities/air-menu-analytics.ts";

interface OrderDto {
  orderId: string;
  platform: string;
  divisionName: string;
  orderDate: string;
  documentDate: string;
  paymentMethod: string;
  items: Array<{ title: string; price: number; count: number }>;
  total: number;
  firstName: string;
  lastName: string;
  activeFlags: Array<{ key: string; operator: string }>;
  providerOrderId: string | null;
  documentType: AirMenuDocumentType;
  extraInfo: Record<string, string>;
  rawData?: Record<string, unknown>[];
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dtoToOrder(dto: OrderDto): AirMenuOrder {
  return {
    ...dto,
    orderDate: new Date(dto.orderDate),
    documentDate: new Date(dto.documentDate),
  };
}

export class HttpAirMenuApiAdapter implements AirMenuApiPort {
  async fetchEnterprises(): Promise<AirMenuEnterprise[]> {
    return apiGet<AirMenuEnterprise[]>("/api/air-menu/enterprises");
  }

  async fetchSummary(enterpriseId: string, startDate: Date, endDate: Date): Promise<AirMenuSummaryData> {
    const qs = new URLSearchParams({
      enterpriseId,
      startDate: toDateStr(startDate),
      endDate: toDateStr(endDate),
    });
    const dto = await apiGet<{ orders: OrderDto[]; analytics: AirMenuAnalyticsData }>(
      `/api/air-menu/summary?${qs}`,
    );
    return {
      orders: dto.orders.map(dtoToOrder),
      analytics: dto.analytics,
    };
  }

  async fetchOrderRaw(enterpriseId: string, orderId: string): Promise<Record<string, unknown>[]> {
    const qs = new URLSearchParams({ enterpriseId });
    return apiGet<Record<string, unknown>[]>(
      `/api/air-menu/orders/${encodeURIComponent(orderId)}/raw?${qs}`,
    );
  }
}
