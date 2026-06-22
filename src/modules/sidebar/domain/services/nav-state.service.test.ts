import { describe, expect, it } from "vitest";
import {
  buildTree,
  isItemActive,
  resolveActiveGroup,
} from "./nav-state.service.ts";

describe("buildTree", () => {
  it("returns 8 entries for a non-admin user", () => {
    const tree = buildTree({ email: "a@b.com", role: "manager" });
    expect(tree).toHaveLength(8);
  });

  it("returns 9 entries for admin (includes Utilizadores)", () => {
    const tree = buildTree({ email: "a@b.com", role: "admin" });
    expect(tree).toHaveLength(9);
    const last = tree[tree.length - 1];
    expect(last?.kind).toBe("item");
    expect(last?.kind === "item" && last.path).toBe("/admin/users");
  });

  it("admin entry is not present for non-admin roles", () => {
    for (const role of ["manager", "hr_viewer"]) {
      const tree = buildTree({ email: "a@b.com", role });
      const haAdmin = tree.some(
        (e) => e.kind === "item" && e.path === "/admin/users",
      );
      expect(haAdmin).toBe(false);
    }
  });
});

describe("resolveActiveGroup", () => {
  const tree = buildTree({ email: "a@b.com", role: "manager" });

  it.each([
    ["/dre/demonstrativo", "dre"],
    ["/dre/receita-bruta", "dre"],
    ["/stock/movimentacoes", "stock"],
    ["/hr", "hr"],
    ["/hr/calendar", "hr"],
    ["/crm", "crm"],
    ["/crm/customers", "crm"],
    ["/financial/cost-centers", "financial"],
    ["/financial/suppliers", "financial"],
    ["/financial/invoices", "financial"],
    ["/financial/payable-entries", "financial"],
  ])("path %s → group %s", (path, expected) => {
    expect(resolveActiveGroup(tree, path)).toBe(expected);
  });

  it.each(["/", "/analytics", "/cash-closings", "/admin/users"])(
    "top-level path %s → null",
    (path) => {
      expect(resolveActiveGroup(tree, path)).toBeNull();
    },
  );
});

describe("isItemActive", () => {
  it("matches exact path when end=true", () => {
    expect(isItemActive("/", "/", true)).toBe(true);
    expect(isItemActive("/", "/analytics", true)).toBe(false);
  });

  it("matches exact path or sub-path when end=false", () => {
    expect(isItemActive("/analytics", "/analytics")).toBe(true);
    expect(isItemActive("/analytics", "/analytics/sub")).toBe(true);
  });

  it("does not match partial prefix", () => {
    expect(isItemActive("/analytics", "/analytics-new")).toBe(false);
  });

  it("dashboard with end=true does not match sub-paths", () => {
    expect(isItemActive("/", "/analytics", true)).toBe(false);
  });
});
