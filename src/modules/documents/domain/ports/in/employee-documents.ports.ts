import type { EmployeeDocumentsApiPort } from "../out/employee-documents-api.port.ts";

/**
 * Casos de uso dos documentos de colaborador (ficha do Novo RH) e da
 * importação de recibos. Hoje coincidem com as operações do backend — a regra
 * (versões, períodos, aplicabilidade) vive no servidor.
 */
export type EmployeeDocumentsPort = EmployeeDocumentsApiPort;
