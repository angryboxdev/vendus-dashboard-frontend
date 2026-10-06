import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute.tsx";

const auth = vi.hoisted(() => ({ value: { user: null as null | { role: string }, loading: false } }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth.value }));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login</p>} />
        <Route
          path="/portal"
          element={
            <ProtectedRoute allowEmployee>
              <p>portal</p>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <p>gestão</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute — Portal do Colaborador", () => {
  it("um colaborador (employee) que abre a área de gestão é levado para /portal", () => {
    auth.value = { user: { role: "employee" }, loading: false };
    renderAt("/hr/pessoas");
    expect(screen.getByText("portal")).toBeInTheDocument();
    expect(screen.queryByText("gestão")).not.toBeInTheDocument();
  });

  it("um gestor vê a área de gestão e também pode abrir o portal", () => {
    auth.value = { user: { role: "manager" }, loading: false };
    renderAt("/hr/pessoas");
    expect(screen.getByText("gestão")).toBeInTheDocument();
  });

  it("sem sessão vai para o login", () => {
    auth.value = { user: null, loading: false };
    renderAt("/portal");
    expect(screen.getByText("login")).toBeInTheDocument();
  });
});
