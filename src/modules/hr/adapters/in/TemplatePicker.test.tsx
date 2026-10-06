import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { ShiftTemplate, ShiftTemplateGroup } from "../../domain/entities/shift-template.ts";
import { filterTemplates, groupTemplates } from "../../domain/services/shift-template.service.ts";
import { TemplatePicker } from "./TemplatePicker.tsx";

// Dados fictícios.
function tpl(id: string, name: string, group: ShiftTemplateGroup, start: string, end: string, extra: Partial<ShiftTemplate> = {}): ShiftTemplate {
  return {
    id,
    name,
    group,
    description: null,
    color: null,
    kind: "direct",
    startTime: start,
    endTime: end,
    endsNextDay: end <= start,
    secondStartTime: null,
    secondEndTime: null,
    breakMinutes: 0,
    workMinutes: 480,
    spanMinutes: 480,
    locationId: null,
    active: true,
    updatedAt: "",
    ...extra,
  };
}

const LIST = [
  tpl("a1", "Abertura 1", "OPENING", "10:00", "18:00"),
  tpl("f1", "Fecho 1", "CLOSING", "19:00", "23:00"),
  tpl("f3", "Fecho 3", "CLOSING", "20:00", "23:00"),
  tpl("r1", "Intermédio repartido", "INTERMEDIATE", "11:00", "15:00", { kind: "split", secondStartTime: "19:00", secondEndTime: "23:00" }),
  tpl("x1", "Fecho velho", "CLOSING", "20:00", "22:00", { active: false }),
];

function Harness() {
  const [value, setValue] = useState("a1");
  return (
    <>
      <TemplatePicker templates={LIST} value={value} onChange={setValue} />
      <p data-testid="selected">{value}</p>
    </>
  );
}

describe("TemplatePicker (Aplicar modelo)", () => {
  it("pesquisa por horário, filtra Grupo/Tipo, só ativos, e fecha ao selecionar", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Abertura 1/ }));

    const list = () => within(screen.getByRole("listbox", { name: "Modelos" }));
    expect(list().queryByText("Fecho velho")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Pesquisar modelo ou horário"), "20:00");
    expect(list().getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringContaining("Fecho 3")]);
    await user.clear(screen.getByLabelText("Pesquisar modelo ou horário"));

    await user.click(within(screen.getByRole("group", { name: "Tipo do modelo" })).getByRole("button", { name: "Repartido" }));
    expect(list().getAllByRole("option")).toHaveLength(1);
    expect(list().getByText("11:00 – 15:00 · 19:00 – 23:00 · 8h · Repartido")).toBeInTheDocument();
    await user.click(within(screen.getByRole("group", { name: "Tipo do modelo" })).getByRole("button", { name: "Todos" }));

    await user.click(within(screen.getByRole("group", { name: "Grupo do modelo" })).getByRole("button", { name: "Fecho" }));
    await user.click(list().getByRole("option", { name: /Fecho 1/ }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected")).toHaveTextContent("f1");
  });
});

describe("filtros da biblioteca (puros)", () => {
  it("Fecho + Repartido exige os dois; pesquisa encontra pelo Grupo; secções na ordem fixa", () => {
    expect(filterTemplates(LIST, { group: "CLOSING", kind: "split", status: "active", search: "" })).toEqual([]);
    expect(filterTemplates(LIST, { group: null, kind: null, status: "all", search: "fecho" }).map((t) => t.id)).toEqual(["f1", "f3", "x1"]);
    expect(filterTemplates(LIST, { group: null, kind: null, status: "inactive", search: "" }).map((t) => t.id)).toEqual(["x1"]);
    expect(groupTemplates(LIST.filter((t) => t.active)).map((s) => `${s.label} · ${s.templates.length}`)).toEqual(["Abertura · 1", "Intermédio · 1", "Fecho · 2"]);
  });
});
