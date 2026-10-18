import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APP_ICONS, AppIcon } from "./app-icons.tsx";

describe("AppIcon (Lucide, padrão do kit)", () => {
  it("20 px, traço 1.75, cor herdada e decorativo por omissão", () => {
    const { container } = render(<AppIcon name="people" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("tamanho ajustável (18–22) e classes passam", () => {
    const { container } = render(<AppIcon name="rosters" size={18} className="text-stone-400" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "18");
    expect(svg.getAttribute("class")).toContain("text-stone-400");
  });

  it("todas as chaves do catálogo desenham um SVG", () => {
    for (const name of Object.keys(APP_ICONS) as (keyof typeof APP_ICONS)[]) {
      const { container, unmount } = render(<AppIcon name={name} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });
});
