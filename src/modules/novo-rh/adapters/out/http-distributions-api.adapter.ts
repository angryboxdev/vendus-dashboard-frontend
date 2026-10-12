import { apiGet, apiGetBlob, apiPostFormData, apiWrite } from "../../../../lib/api.ts";
import type { Distribution, DistributionAudience, DistributionReport } from "../../domain/entities/distributions.ts";
import type { DistributionsApiPort } from "../../domain/ports/out/distributions-api.port.ts";

export class HttpDistributionsApiAdapter implements DistributionsApiPort {
  private readonly D = "/api/novo-rh/document-distributions";
  list() {
    return apiGet<Distribution[]>(this.D);
  }
  async previewAudience(audience: DistributionAudience) {
    return (await apiWrite<{ recipients: number; withoutAccount: number }>(`${this.D}/audience-preview`, { body: { audience } })).data;
  }
  send(input: { title: string; audience: DistributionAudience; requiresConfirmation: boolean; file: File }) {
    const f = new FormData();
    f.append("title", input.title);
    f.append("audience", JSON.stringify(input.audience));
    f.append("requiresConfirmation", String(input.requiresConfirmation));
    f.append("file", input.file, input.file.name);
    return apiPostFormData<Distribution & { withoutAccount: number }>(this.D, f);
  }
  report(id: string) {
    return apiGet<DistributionReport>(`${this.D}/${id}/report`);
  }
  async remind(id: string) {
    return (await apiWrite<{ pending: number; notified: number; withoutAccount: number }>(`${this.D}/${id}/remind`, {})).data;
  }
  async archive(id: string) {
    await apiWrite(`${this.D}/${id}/archive`, {});
  }
  downloadUrl(id: string) {
    return apiGet<{ url: string }>(`${this.D}/${id}/download-url`);
  }
  proofCsv(id: string) {
    return apiGetBlob(`${this.D}/${id}/proof.csv`);
  }
}
