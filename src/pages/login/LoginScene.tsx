import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import "./login-scene.css";

/**
 * Cenário decorativo do login (restaurante + painéis ilustrativos).
 *
 * Só visual: dados fictícios fixos, sem chamadas à API, sem links nem
 * handlers de clique, fora da ordem de Tab e escondido das tecnologias
 * assistivas. O hover é todo em CSS (sem estado React por movimento do
 * rato). É carregado com `lazy` pelo LoginPage: o formulário nunca espera
 * por este código nem pelas imagens.
 *
 * Coordenadas em píxeis da imagem de referência (1672×941): o palco escala
 * como `cover`, por isso fundo, painéis e conectores ficam sempre alinhados.
 */

const STAGE_W = 1672;
const STAGE_H = 941;
const DESKTOP_QUERY = "(min-width: 1260px) and (min-height: 640px) and (min-aspect-ratio: 8/5)";

// Sem `matchMedia` (testes/browsers antigos) fica o modo simples, sem painéis.
const hasMatchMedia = () => typeof window.matchMedia === "function";

function subscribeDesktop(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const isDesktop = () => hasMatchMedia() && window.matchMedia(DESKTOP_QUERY).matches;

function at(x: number, y: number, w: number): CSSProperties {
  return { left: `${(x / STAGE_W) * 100}%`, top: `${(y / STAGE_H) * 100}%`, width: `${(w / STAGE_W) * 100}%` };
}

function Ico({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function Panel({ id, style, icon, iconTone, title, children }: { id: LinkId; style: CSSProperties; icon: ReactNode; iconTone: "brand" | "navy"; title: string; children: ReactNode }) {
  const side = LINKS[id].node[0] < STAGE_W / 2 ? "left" : "right";
  return (
    <>
      <div className={`ls-panel ls-panel--${side} ls-panel--${id}`} style={style}>
        <div className="ls-panel__body">
          <div className="ls-head">
            <span className={`ls-head__icon ls-tone-${iconTone}`}>{icon}</span>
            <span className="ls-head__title">{title}</span>
          </div>
          {children}
        </div>
      </div>
      <Link id={id} />
    </>
  );
}

/**
 * Conectores: base discreta + traço ativo + pulso. Cada SVG vem logo a seguir
 * ao seu painel, para o CSS o ativar com `.ls-panel:hover + .ls-link`.
 * Cada ligação é um SVG do tamanho da sua caixa (`box`, em píxeis da
 * referência) para que o pulso só repinte essa zona e não o palco inteiro.
 */
type LinkId = "overview" | "orders" | "finance" | "stock" | "rh" | "delivery";
const LINKS: Record<LinkId, { d: string; node: [number, number]; box: [number, number, number, number] }> = {
  overview: { d: "M590 152 C628 152 626 200 630 240 C634 278 660 292 712 292", node: [590, 152], box: [574, 136, 724, 304] },
  orders: { d: "M530 418 C572 418 590 455 620 482 C650 508 690 515 772 515", node: [530, 418], box: [514, 402, 784, 527] },
  // Coluna da direita: painéis com a mesma largura, centrados, à mesma distância uns dos outros (RIGHT_COLUMN).
  finance: { d: "M1118 145 C1098 145 1095 190 1092 245 C1090 295 1078 320 1040 322", node: [1118, 145], box: [1028, 129, 1134, 334] },
  stock: { d: "M1188 396 C1160 396 1165 440 1150 476 C1120 500 1090 500 1040 500", node: [1188, 396], box: [1028, 380, 1204, 512] },
  rh: { d: "M1188 618 C1150 618 1135 645 1115 662 C1095 676 1060 668 1048 640 L1046 420", node: [1188, 618], box: [1030, 408, 1204, 684] },
  delivery: { d: "M1118 793 C1098 793 1102 730 1096 700 C1090 672 1080 667 1062 664", node: [1118, 793], box: [1050, 652, 1134, 809] },
};

/**
 * Coluna da direita (pedido do utilizador): mesma largura, 16 px de intervalo e o conjunto centrado na
 * vertical — alturas = as dos painéis (`--h` no CSS): 284 + 222 + 157 + 162 + 3 × 16 = 873 → topo 34.
 * Em arco à volta do formulário: o de cima e o de baixo 70 px mais para dentro do que os do meio.
 * Os pontos de ligação ficam 22 px à esquerda de cada painel.
 */
const RIGHT_COLUMN = {
  width: 392,
  finance: { x: 1140, top: 34 },
  stock: { x: 1210, top: 334 },
  rh: { x: 1210, top: 572 },
  delivery: { x: 1140, top: 745 },
} as const;
const rightAt = (id: "finance" | "stock" | "rh" | "delivery") => at(RIGHT_COLUMN[id].x, RIGHT_COLUMN[id].top, RIGHT_COLUMN.width);

function LinkDefs() {
  return (
    <svg className="ls-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ls-fade-l" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0.85" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ls-fade-r" gradientUnits="objectBoundingBox" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0.85" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ls-active-l" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="ls-stop-brand" />
          <stop offset="0.55" className="ls-stop-navy" />
          <stop offset="1" className="ls-stop-navy" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ls-active-r" gradientUnits="objectBoundingBox" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" className="ls-stop-brand" />
          <stop offset="0.55" className="ls-stop-navy" />
          <stop offset="1" className="ls-stop-navy" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Link({ id }: { id: LinkId }) {
  const { d, node, box: [x0, y0, x1, y1] } = LINKS[id];
  const side = node[0] < STAGE_W / 2 ? "l" : "r";
  return (
    <svg
      className="ls-link"
      style={{ ...at(x0, y0, x1 - x0), height: `${((y1 - y0) / STAGE_H) * 100}%` }}
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} className="ls-link__base" stroke={`url(#ls-fade-${side})`} />
      <path d={d} className="ls-link__active" stroke={`url(#ls-active-${side})`} />
      <path d={d} className="ls-link__pulse" pathLength={1000} />
      <circle cx={node[0]} cy={node[1]} r="11" className="ls-node__ring" />
      <circle cx={node[0]} cy={node[1]} r="5" className="ls-node__dot" />
    </svg>
  );
}

function Status({ tone, children }: { tone: "ok" | "info" | "brand"; children: ReactNode }) {
  return <span className={`ls-pill ls-pill--${tone}`}>{children}</span>;
}

function Panels() {
  return (
    <>
      <Panel
        id="overview"
        style={at(122, 62, 446)}
        iconTone="navy"
        title="Visão Geral"
        icon={<Ico><path d="M5 20V12M10 20V8M15 20V4M20 20v-6" /></Ico>}
      >
        <div className="ls-tabs">
          <span className="ls-tab ls-tab--on">Hoje</span>
          <span className="ls-tab">Semana</span>
          <span className="ls-tab">Mês</span>
        </div>
        <div className="ls-overview">
          <div className="ls-bars">
            {[22, 34, 46, 72, 54, 88, 100].map((h, i) => (
              <span key={i} className={`ls-bar${i === 6 ? " ls-bar--brand" : ""}`} style={{ height: `${h}%`, opacity: i === 6 ? 1 : 0.4 + i * 0.1 }} />
            ))}
          </div>
          <div className="ls-kpis">
            <div className="ls-row ls-kpi">
              <Ico className="ls-kpi__icon ls-tone-navy"><path d="M7 17L17 7M9 7h8v8" /></Ico>
              <div>
                <div className="ls-kpi__value">+18%</div>
                <div className="ls-kpi__label">em relação ao mês anterior</div>
              </div>
            </div>
            <div className="ls-row ls-kpi">
              <Ico className="ls-kpi__icon ls-tone-navy"><path d="M3 4h2l2.4 11h10.2L20 8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z" /></Ico>
              <div>
                <div className="ls-kpi__value">324</div>
                <div className="ls-kpi__label">pedidos hoje</div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        id="orders"
        style={at(58, 324, 450)}
        iconTone="brand"
        title="Pedidos em andamento"
        icon={<Ico><path d="M6 3v8M4 3v5a2 2 0 004 0V3M6 11v10M17 21V3c-2 1.5-3 4-3 7v3h3" /></Ico>}
      >
        <div className="ls-list">
          {[
            ["dish-burger", "Cheeseburger Artesanal", "1x", <Status tone="ok">Em preparo</Status>],
            ["dish-salad", "Salada Caesar", "2x", <Status tone="info">Confirmado</Status>],
            ["dish-pasta", "Pasta de Camarão", "1x", <Status tone="brand">Saiu para entrega</Status>],
          ].map(([img, name, qty, status]) => (
            <div key={img as string} className="ls-row ls-order">
              <img className="ls-order__img" src={`/login/${img}.webp`} alt="" width={64} height={40} decoding="async" draggable={false} />
              <span className="ls-order__name">{name}</span>
              <span className="ls-order__qty">{qty}</span>
              {status}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        id="finance"
        style={rightAt("finance")}
        iconTone="brand"
        title="Controle financeiro com AI"
        icon={<Ico><path d="M5 20V13M10 20V9M15 20V5M20 20V11" /></Ico>}
      >
        <div className="ls-revenue">
          <div>
            <div className="ls-revenue__label">Receita hoje</div>
            <div className="ls-revenue__value">
              € 2.450,00 <Status tone="ok">↗ +12%</Status>
            </div>
          </div>
          <div className="ls-revenue__side">
            <span className="ls-chip">Hoje</span>
            <svg className="ls-spark" viewBox="0 0 120 40" aria-hidden="true" focusable="false">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x={50 + i * 12} y={34 - (8 + i * 4)} width="7" height={8 + i * 4} rx="1.5" className="ls-spark__bar" />
              ))}
              <path d="M2 34 C14 30 22 26 32 28 S50 22 60 20 S80 14 92 12 S108 6 118 4" className="ls-spark__line" />
            </svg>
          </div>
        </div>
        <div className="ls-list">
          {[
            ["Vendas", "€ 2.450,00", "+12%", "up"],
            ["Despesas", "€ 820,50", "-3%", "down"],
            ["Lucro estimado", "€ 1.629,50", "+15%", "up"],
          ].map(([label, value, delta, dir]) => (
            <div key={label} className="ls-row ls-money">
              <span className={`ls-money__dot ls-money__dot--${label === "Lucro estimado" ? "muted" : dir}`}>
                <Ico>{dir === "down" ? <path d="M7 7l10 10M17 9v8H9" /> : <path d="M7 17L17 7M9 7h8v8" />}</Ico>
              </span>
              <span className="ls-money__label">{label}</span>
              <span className="ls-money__value">{value}</span>
              <span className={`ls-money__delta ls-money__delta--${dir}`}>{delta}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        id="stock"
        style={rightAt("stock")}
        iconTone="navy"
        title="Stock inteligente com AI"
        icon={<Ico><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" /></Ico>}
      >
        <div className="ls-list">
          {[
            ["ing-tomato", "Tomate", "12 kg", 72, "ok"],
            ["ing-lettuce", "Alface", "8 un", 46, "brand"],
            ["ing-meat", "Carne Angus", "5 kg", 46, "brand"],
            ["ing-oil", "Azeite", "3 lt", 86, "ok"],
          ].map(([img, name, qty, pct, tone]) => (
            <div key={img as string} className="ls-row ls-stock">
              <img className="ls-stock__img" src={`/login/${img}.webp`} alt="" width={28} height={28} decoding="async" draggable={false} />
              <span className="ls-stock__name">{name}</span>
              <span className="ls-stock__qty">{qty}</span>
              <span className="ls-meter">
                <span className={`ls-meter__fill ls-meter__fill--${tone}`} style={{ width: `${pct}%` }} />
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        id="rh"
        style={rightAt("rh")}
        iconTone="brand"
        title="RH"
        icon={<Ico><path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M16 5.5a2.5 2.5 0 010 5M17.5 14c2 .6 3.5 2.2 3.5 5" /></Ico>}
      >
        <div className="ls-list">
          <div className="ls-row ls-hr">
            <Ico className="ls-hr__icon ls-tone-navy"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2" /></Ico>
            <div>
              <div className="ls-hr__title">Escala da semana</div>
              <div className="ls-hr__sub">12 colaboradores</div>
            </div>
          </div>
          <div className="ls-row ls-hr">
            <Ico className="ls-hr__icon ls-tone-navy"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" /></Ico>
            <div>
              <div className="ls-hr__title">Gestão de equipa com AI</div>
              <div className="ls-hr__sub">Desempenho e produtividade</div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        id="delivery"
        style={rightAt("delivery")}
        iconTone="brand"
        title="Delivery"
        icon={<Ico><path d="M3 7h9v8H3zM12 10h4l3 3v2h-7M6.5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></Ico>}
      >
        <div className="ls-row ls-delivery">
          <img className="ls-delivery__rider" src="/login/rider.webp" alt="" width={146} height={93} decoding="async" draggable={false} />
          <div className="ls-delivery__count">
            <div className="ls-kpi__value">18</div>
            <div className="ls-kpi__label">entregas hoje</div>
          </div>
          <Status tone="ok">
            <Ico className="ls-pill__icon"><path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11zM12 12a2 2 0 100-4 2 2 0 000 4z" /></Ico>
            Em rota
          </Status>
        </div>
      </Panel>
    </>
  );
}

export default function LoginScene() {
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);

  return (
    <div className="ls-root" aria-hidden="true">
      {desktop ? (
        <div className="ls-stage">
          <img
            className="ls-bg"
            src="/login/login-bg-1672.webp"
            srcSet="/login/login-bg-1280.webp 1280w, /login/login-bg-1672.webp 1672w"
            sizes="max(100vw, 177.7vh)"
            alt=""
            width={STAGE_W}
            height={STAGE_H}
            decoding="async"
            draggable={false}
          />
          <LinkDefs />
          <Panels />
        </div>
      ) : (
        <img
          className="ls-bg ls-bg--mobile"
          src="/login/login-bg-mobile.webp"
          alt=""
          width={536}
          height={941}
          decoding="async"
          draggable={false}
        />
      )}
    </div>
  );
}
