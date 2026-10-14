import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GoogleReviewsOverview } from "../../../domain/entities/dashboard.ts";
import { formatRating } from "../../../domain/services/dashboard.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { GoogleReviewsBody } from "./GoogleReviews.tsx";

// Dados fictícios (RGPD).
const OVERVIEW: GoogleReviewsOverview = {
  configured: true,
  average: { rating: 4.7, count: 400 },
  locations: [
    { locationId: "l1", locationName: "Loja Porto", placeId: "p1", placeName: "Loja Porto", rating: 4.8, userRatingCount: 300, googleMapsUri: "https://maps.google.com/?cid=1", unavailable: false },
    { locationId: "l2", locationName: "Loja Maia", placeId: "p2", placeName: "Loja Maia", rating: null, userRatingCount: null, googleMapsUri: null, unavailable: true },
  ],
  unlinked: [{ locationId: "l3", locationName: "Loja Braga" }],
};

function renderBody(m: NovoRhModule, locationId?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <GoogleReviewsBody locationId={locationId} />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

function withGoogle(over: Partial<NovoRhModule["dashboard"]>) {
  const m = fakeNovoRhModule();
  Object.assign(m.dashboard, over);
  return m;
}

describe("Avaliações Google", () => {
  it("nota formatada em pt-PT", () => {
    expect(formatRating(4.66)).toBe("4,7");
    expect(formatRating(null)).toBe("—");
  });

  it("sem chave no servidor: explica o que falta", async () => {
    renderBody(fakeNovoRhModule());
    expect(await screen.findByText(/falta a chave GOOGLE_PLACES_API_KEY/)).toBeTruthy();
  });

  it("média, nota por local e local indisponível; abre as avaliações com o autor", async () => {
    const m = withGoogle({
      googleReviews: vi.fn(async () => OVERVIEW),
      googleLocationReviews: vi.fn(async () => ({ placeName: "Loja Porto", googleMapsUri: "https://maps.google.com/?cid=1", reviews: [{ author: "Cliente Teste", authorUri: null, rating: 5, text: "Muito bom", relativeTime: "há 1 semana", publishTime: null }] })),
    });
    renderBody(m);
    expect(await screen.findByText("4,7")).toBeTruthy();
    expect(screen.getByText("4,8")).toBeTruthy();
    expect(screen.getByText("indisponível")).toBeTruthy();
    expect(screen.getByText("1 local(is) por ligar")).toBeTruthy();
    await userEvent.click(screen.getByText("Loja Porto"));
    expect(await screen.findByText("Cliente Teste")).toBeTruthy();
    expect(screen.getByText("Muito bom")).toBeTruthy();
    expect(m.dashboard.googleLocationReviews).toHaveBeenCalledWith("l1");
  });

  it("ligar um local: pesquisa pelo nome e grava o candidato escolhido", async () => {
    const googleLink = vi.fn(async () => OVERVIEW);
    const m = withGoogle({
      googleReviews: vi.fn(async () => ({ ...OVERVIEW, locations: [], average: { rating: null, count: 0 } })),
      googleSearch: vi.fn(async () => [{ placeId: "p3", name: "Loja Braga Centro", address: "Braga", rating: 4.5, userRatingCount: 50 }]),
      googleLink,
    });
    renderBody(m);
    await userEvent.click(await screen.findByText("Ligar locais ao Google"));
    await userEvent.click(screen.getByRole("button", { name: "Ligar" }));
    await userEvent.click(await screen.findByText("Loja Braga Centro"));
    expect(m.dashboard.googleSearch).toHaveBeenCalledWith("Loja Braga");
    expect(googleLink).toHaveBeenCalledWith("l3", { placeId: "p3", placeName: "Loja Braga Centro" });
  });
});
