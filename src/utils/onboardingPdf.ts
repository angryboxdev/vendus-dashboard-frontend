import jsPDF from "jspdf";

// ── Brand palette ─────────────────────────────────────────────────────────────

const RED: [number, number, number] = [193, 49, 26];
const CREAM: [number, number, number] = [240, 232, 213];
const GRAY: [number, number, number] = [150, 150, 150];
const LIGHT: [number, number, number] = [245, 243, 240];
const DARK: [number, number, number] = [40, 40, 40];

// ── Layout constants ──────────────────────────────────────────────────────────

const ML = 14;   // left margin
const MR = 196;  // right edge (210 - 14)
const W = MR - ML;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchLogoBase64(): Promise<string> {
  const res = await fetch("/image.png");
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function drawHeader(doc: jsPDF, logo: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 36, "F");
  doc.addImage(logo, "PNG", 8, 5, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...CREAM);
  doc.text("Angry Box", 42, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Ficha de Admissão de Funcionário", 42, 23);
  doc.setFontSize(8);
  doc.setTextColor(200, 185, 165);
  doc.text("Preencha todos os campos com letra legível e entregue à gerência.", 42, 30);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(ML, y, W, 7, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...RED);
  doc.text(title.toUpperCase(), ML + 3, y + 4.8);
  return y + 11;
}

/** Renders one labelled blank line. Returns next Y. */
function field(doc: jsPDF, label: string, x: number, y: number, w: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(label, x, y);
  const lineY = y + 5.5;
  doc.setDrawColor(180, 175, 170);
  doc.setLineWidth(0.3);
  doc.line(x, lineY, x + w, lineY);
  return lineY + 6;
}

/** Two fields side by side. Returns next Y. */
function fieldRow(doc: jsPDF, left: string, right: string, y: number): number {
  const halfW = (W - 6) / 2;
  field(doc, left, ML, y, halfW);
  field(doc, right, ML + halfW + 6, y, halfW);
  return y + 11.5;
}

/** One full-width field. Returns next Y. */
function fieldFull(doc: jsPDF, label: string, y: number): number {
  field(doc, label, ML, y, W);
  return y + 11.5;
}

function signatureBlock(doc: jsPDF, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const halfW = (W - 10) / 2;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...DARK);
  const declaration =
    "Declaro que os dados acima são verdadeiros e autorizo o seu tratamento para fins de gestão de recursos humanos.";
  const lines = doc.splitTextToSize(declaration, W) as string[];
  doc.text(lines, ML, y);
  y += lines.length * 4.5 + 6;

  // Left: date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("Data", ML, y);
  doc.setDrawColor(180, 175, 170);
  doc.setLineWidth(0.3);
  doc.line(ML, y + 5.5, ML + halfW, y + 5.5);

  // Right: signature
  doc.text("Assinatura do Funcionário", ML + halfW + 10, y);
  doc.line(ML + halfW + 10, y + 5.5, pageW - ML, y + 5.5);
}

function addFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 215, 210);
  doc.setLineWidth(0.2);
  doc.line(ML, pageH - 11, pageW - ML, pageH - 11);
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-PT")} · Angry Box · Uso interno`,
    ML,
    pageH - 6,
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function printOnboardingForm(): Promise<void> {
  const logo = await fetchLogoBase64();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawHeader(doc, logo);
  let y = 44;

  // ── Dados pessoais ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, "Dados Pessoais", y);
  y = fieldFull(doc, "Nome completo", y);
  y = fieldRow(doc, "Data de nascimento", "Nacionalidade", y);
  y = fieldFull(doc, "Morada (rua, nº, andar)", y);
  y = fieldRow(doc, "Código postal", "Localidade", y);
  y = fieldRow(doc, "Telemóvel", "Email", y);

  // ── Documentos ──────────────────────────────────────────────────────────────
  y += 2;
  y = sectionTitle(doc, "Documentos e Identificação", y);
  y = fieldRow(doc, "NIF (Número de Identificação Fiscal)", "Nº Segurança Social", y);
  y = fieldRow(doc, "Nº Cartão de Cidadão / BI", "Validade do CC/BI", y);

  // ── Dados bancários ─────────────────────────────────────────────────────────
  y += 2;
  y = sectionTitle(doc, "Dados Bancários", y);
  y = fieldFull(doc, "IBAN", y);
  y = fieldRow(doc, "Banco", "Titular da conta", y);

  // ── Contacto de emergência ──────────────────────────────────────────────────
  y += 2;
  y = sectionTitle(doc, "Contacto de Emergência", y);
  y = fieldRow(doc, "Nome", "Relação (pai/mãe/cônjuge/outro)", y);
  y = fieldRow(doc, "Telemóvel", "Email (opcional)", y);

  // ── Assinatura ──────────────────────────────────────────────────────────────
  y += 4;
  signatureBlock(doc, y);

  addFooter(doc);

  doc.save("ficha_admissao_angry_box.pdf");
}
