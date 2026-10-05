# UI Motion (camada partilhada)

> Status: ativo
> Última atualização: 2026-10-05 (task "UI Motion MVP — Visão Geral + Colaboradores")

## Para que serve

Microanimações discretas e iguais em todo o lado: entrada de cartões e
linhas, KPIs que contam até ao valor, barras de progresso que preenchem,
modais/drawers que entram e saem, "✓ Guardado". **Nunca altera dados nem
regras** — só apresentação.

Âmbito atual: RH → Visão Geral e Colaboradores (lista, Cargos, Documentos,
perfil). Outras áreas ainda não usam (task: "não implementar nesta fase").

## Como funciona

- **Sem biblioteca externa.** Keyframes CSS em `tailwind.config.js`
  (`motion-fade`, `motion-fade-up`, `motion-slide-*-right`, `motion-pop-*`),
  só `opacity`/`transform` (sem layout shift), sempre com o prefixo
  `motion-safe:`.
- **`prefers-reduced-motion`:** com "reduzir movimento" — ou num ambiente
  sem `matchMedia` (testes, browsers antigos) — nada se desloca, os números
  aparecem logo no valor final e os modais fecham de imediato.
- **Velocidades:** hover 150 ms · fade 200 ms · cartões/painéis 220 ms ·
  saída de modais 160–180 ms · KPIs/progresso 600 ms · stagger 50 ms com
  máximo de 8 passos (≤ 350 ms no total, mesmo em listas grandes).

## Primitivas (`index.ts`)

| Primitiva | Uso |
|---|---|
| `MotionFade` | Entrada de um bloco; `variant="fade"` + `key` para conteúdo de tabs e trocas de estado. |
| `MotionStagger` | Grelha de cartões em sequência (`startIndex` continua a sequência de outro grupo). |
| `motionItem` / `useFirstBatch` + `motionListItem` | Linhas de tabela: stagger só no 1.º lote; resultados novos de pesquisa/filtros só com fade, sem atraso; as linhas que ficam não reanimam. |
| `MotionNumber` / `useAnimatedNumber` | KPI do valor anterior ao atual, com a formatação de sempre (`format`). |
| `MotionProgress` | Barra 0 → valor (scaleX), `role="progressbar"` com o valor real. |
| `MotionCollapse` | Expandir/recolher (grid-rows 0fr ↔ 1fr). |
| `MotionPresence` + `MotionLayer` | Modais/drawers: `kind="overlay" \| "drawer" \| "modal"`; dentro de `MotionPresence` também animam a saída. `useRetained` mantém o conteúdo durante a saída. |
| `MotionSuccess` + `useSuccessFlash` | "✓ Guardado" discreto durante ~1,8 s. |
| `MOTION_CARD_HOVER` / `MOTION_ROW_HOVER` | Hover de cartões clicáveis (leve elevação) e de linhas (só cor). |

## Como testar

- `npx vitest run src/components/motion`

## Decisões

- **CSS em vez de biblioteca (ex.: framer-motion):** o projeto não tinha
  nenhuma; tudo o que a task pede faz-se com CSS + `requestAnimationFrame`,
  sem dependência nova nem custo no bundle.
- **Sem animações contínuas nem loading artificial:** dados disponíveis
  aparecem logo; cada animação corre uma vez quando o elemento monta.
