/** Entidades legais empregadoras (FE-092) e a entidade de cada centro (FE-093). */
export type Country = "PT" | "ES";
export type TaxIdType = "nif" | "cif" | "nie";

export interface CountryCatalog {
  code: Country;
  label: string;
  taxIdTypes: { key: TaxIdType; label: string }[];
  regionLabel: string;
  socialSecurityLabel: string;
}

export interface LegalEntityInput {
  name: string;
  country: Country;
  taxIdType: TaxIdType;
  taxId: string;
  socialSecurityId: string;
  billingEmail: string;
  street: string;
  postalCode: string;
  city: string;
  region: string;
  phone: string | null;
}

export interface LegalEntity extends LegalEntityInput {
  id: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  etag: string;
  /** N.º de centros ligados. */
  locations: number;
}

export interface LegalEntityUsage {
  locations: number;
  contracts: number;
}

export interface LocationEntity {
  id: string;
  name: string;
  legalEntityId: string | null;
}
