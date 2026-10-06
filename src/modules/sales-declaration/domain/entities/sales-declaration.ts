/** SAF-T enviado pelo utilizador (conteúdo em bytes). */
export interface SaftUpload {
  name: string;
  content: ArrayBuffer;
}

export interface SalesDeclarationFile {
  fileName: string;
  content: ArrayBuffer;
}
