import type { JobRole } from "./employee.ts";

export interface DocumentCategoryDefinition {
  id: string;
  slug: string;
  label: string;
  mandatory: boolean;
  /** Vazio = aplica-se a todos os cargos. */
  jobRoles: JobRole[];
  acceptedMimeTypes: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCategoryPayload {
  label: string;
  mandatory: boolean;
  jobRoles: JobRole[];
  acceptedMimeTypes: string[];
}

export const ACCEPTED_MIME_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" },
];
