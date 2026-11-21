import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CashClosingsProvider, type CashClosingsModule } from "../../cash-closings.module.tsx";
import type { CashClosing } from "../../domain/entities/cash-closing.ts";
import type { ListClosingsQuery } from "../../domain/ports/in/list-closings.port.ts";
import { CashClosingsHubView } from "./CashClosingsHubView.tsx";

function closing(p: Partial<CashClosing> & Pick<CashClosing, "id">): CashClosing {
  const tpa = p.tpa ?? 0;
  const uber = p.uber ?? 0;
  return {
    closingDate: "2026-11-06",
    employeeId: "e1",
    employeeName: "Ana",
    tpa,
    uber,
    glovo: 0,
    bolt: 0,
    eatz: 0,
    cashSales: 0,
    cashIn: 0,
    cashOut: 0,
    cashDrawerOpen: 100,
    cashDrawerTotal: 100,
    totalCalculated: tpa + uber,
    vendusTotal: tpa,
    sangriaAmount: 0,
    notes: null,
    status: "pending",
    managerNotes: null,
    reviewedAt: null,
    submittedAt: "2026-11-06T10:00:00Z",
    airMenuUber: uber,
    airMenuGlovo: 0,
    airMenuBolt: 0,
    vendusCalculated: tpa,
    airMenuCalculated: uber,
    airMenuTotal: uber,
    ...p,
  };
}

// 06/11: dois fechos (manhã e noite). 05/11: um fecho com 200 € de Uber que o Vendus não conhece.
const CLOSINGS = [
  closing({ id: "m", tpa: 500, uber: 300, airMenuTotal: 300, employeeName: "Ana" }),
  closing({ id: "n", tpa: 100, airMenuTotal: 300, employeeName: "Rui Pedro Costa Lima", submittedAt: "2026-11-06T21:00:00Z" }),
  closing({ id: "o", closingDate: "2026-11-05", tpa: 400, uber: 200, submittedAt: "2026-11-05T10:00:00Z" }),
];

function renderHub() {
  const queries: ListClosingsQuery[] = [];
  const mod = {
    listClosings: {
      execute: async (q: ListClosingsQuery) => {
        queries.push(q);
        return { closings: CLOSINGS, total: CLOSINGS.length };
      },
    },
    reviewClosing: { execute: async () => CLOSINGS[0]! },
    api: {} as CashClosingsModule["api"],
  } satisfies CashClosingsModule;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CashClosingsProvider module={mod}>
        <CashClosingsHubView />
      </CashClosingsProvider>
    </QueryClientProvider>,
  );
  return { queries };
}

describe("CashClosingsHubView — vista Mês", () => {
  it("junta os fechos do mesmo dia numa linha com a etiqueta «2 fechos»", async () => {
    const { queries } = renderHub();
    await userEvent.setup().click(screen.getByRole("button", { name: "Mês" }));

    const rows = await screen.findAllByRole("row");
    // Cabeçalho + um dia por linha (06/11 e 05/11) + totais, não uma linha por fecho.
    expect(rows).toHaveLength(4);
    const day6 = rows[1]!;
    expect(within(day6).getByText("2 fechos")).toBeInTheDocument();
    expect(within(day6).getByText("Ana, Rui Lima")).toBeInTheDocument();
    expect(within(rows[2]!).queryByText(/fechos/)).not.toBeInTheDocument();
    // O mês vem inteiro (sem páginas a partir um dia ao meio).
    expect(queries.at(-1)).toMatchObject({ limit: 200, offset: 0 });
  });

  it("a diferença Vendus ignora as apps de entregas e o AirMenu do dia conta uma vez", async () => {
    renderHub();
    await userEvent.setup().click(screen.getByRole("button", { name: "Mês" }));

    const rows = await screen.findAllByRole("row");
    // Antes: 800 € declarados − 600 € Vendus = +200 €. Agora: Vendus e AirMenu batem certo.
    expect(within(rows[1]!).queryByText(/\+/)).not.toBeInTheDocument();
    expect(within(rows[1]!).getAllByText(/^0,00\s€$/)).toHaveLength(2);
    expect(within(rows[2]!).getAllByText(/^0,00\s€$/)).toHaveLength(2);
  });

  it("clicar num dia com dois fechos abre a lista desse dia", async () => {
    const user = userEvent.setup();
    renderHub();
    await user.click(screen.getByRole("button", { name: "Mês" }));
    const rows = await screen.findAllByRole("row");
    await user.click(rows[1]!);
    expect(await screen.findByText("Rui Pedro Costa Lima")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ana|Rui/ })).toHaveLength(2);
  });

  it("o rodapé soma cada coluna do mês", async () => {
    renderHub();
    await userEvent.setup().click(screen.getByRole("button", { name: "Mês" }));

    const rows = await screen.findAllByRole("row");
    const footer = rows.at(-1)!;
    expect(within(footer).getByText("Total")).toBeInTheDocument();
    expect(within(footer).getByText(/2 dias · 3 fechos/)).toBeInTheDocument();
    expect(within(footer).getByText(/^1500,00\s€$|^1\s?500,00\s€$/)).toBeInTheDocument();
    expect(within(footer).getByText(/^1000,00\s€$|^1\s?000,00\s€$/)).toBeInTheDocument();
  });
});
