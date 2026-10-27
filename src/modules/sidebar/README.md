# Módulo: sidebar

> Status: ativo
> Última atualização: 2026-10-18 (ícones Lucide e barra recolhível)

## Propósito

Responsável pela navegação principal da aplicação: renderiza a sidebar desktop,
a top bar mobile e o drawer mobile. Sabe quais secções existem, qual está ativa e
gere o estado de expansão dos grupos colapsáveis. NÃO é responsável por routing
nem por autenticação — apenas consome essas dependências via ports.

## Conceitos do domínio

- **NavItem** — entrada de navegação simples com `path`, `label` e `end`.
- **NavGroup** — grupo colapsável com `basePath` e uma lista de `NavItem`.
- **SidebarNavEntry** — union de `NavItem | NavGroup`.
- **SidebarUser** — dados do utilizador autenticado necessários à sidebar (`email`, `role`).
- **SidebarState** — resultado do use case: `tree` (entradas filtradas por role), `activeGroupId` e `user`.

**Regra de visibilidade:** a entrada `Utilizadores` só aparece na árvore quando
`user.role === 'admin'`.

**Expansão de grupos:** um grupo expande-se automaticamente quando o caminho atual
começa com o seu `basePath`. Funciona em acordeão: só um grupo aberto de cada vez —
abrir outro fecha o anterior (incluindo o ativo). A escolha manual vale até mudar de
ecrã; esse estado local é gerido no hook `useSidebar`.

## Ports

### Entrada (use cases)

- `GetNavStatePort` — recebe `currentPath` e devolve `SidebarState` (árvore filtrada + grupo ativo).
- `SignOutPort` — executa o sign-out; o hook trata a navegação para `/login` após.

### Saída (dependências do domínio)

- `AuthPort` — `getUser(): SidebarUser | null` e `signOut(): Promise<void>`. Abstrai o `AuthContext` do React.

## Adapters

### Entrada (UI)

- `useSidebar` (hook) — consome `GetNavStatePort` e `SignOutPort` via `useSidebarModule()`, lê `useLocation` e `useNavigate`, gere estado local de expansão e mobile.
- `Sidebar` (componente) — exporta o componente público; internamente usa `useSidebar` e `SidebarBody`.

### Saída

- `ReactAuthAdapter` — implementa `AuthPort` com getter functions fechadas sobre um ref atualizado a cada render, garantindo que o use case (criado uma única vez) lê sempre os valores de auth mais recentes.

## Decisões de design (ADR resumido)
- **Contador** (`badgeKey`, 2026-10-07): itens podem mostrar um número (ex.: Caixa de pedidos); `BadgeCountsPort` → `HttpBadgeCountsAdapter` (`GET /api/hr/requests`), só pedido quando o item está visível, a cada 60 s.
- **Recursos Humanos** (2026-10-14): as áreas do Novo RH são os itens principais (Visão geral, Colaboradores, Escalas, Assiduidade, Ausências, Documentos); os ecrãs antigos ficam em **RH antigo** (`/hr/antigo`, item com `match` = `LEGACY_HR_PATHS` para ficar ativo em qualquer ecrã antigo; separadores lado a lado em `pages/hr/HrLayout`). `/hr` abre o Novo RH a quem o pode abrir; senão o primeiro ecrã antigo permitido.
- 2026-10-14 (visual): largura 240 px; item ativo navy mais claro com detalhe cobre. "RH antigo" continua no menu (pedido do utilizador: manter para consulta).
- **Ícones** (2026-10-18): grupos e itens têm `icon` opcional — uma chave (`NavIcon`) no domínio, sem React; a vista resolve-a em `AppIcon` (Lucide, `components/ui/app-icons.tsx`), 18 px ao lado do texto.
- **Barra recolhível** (2026-10-18, só desktop): botão «Recolher/Expandir» (`aria-label`, `aria-expanded`); recolhida = 72 px só com ícones (`CollapsedSidebar.tsx`): item ativo realçado, tooltip ao passar o rato e ao focar, grupos abrem menu flutuante com os sub-itens (Esc/clique fora fecham e devolvem o foco), contador de pedidos no ícone, Sair como ícone. O conteúdo ocupa a largura libertada (`main` é `flex-1`). Preferência guardada no navegador (`sidebar.collapsed`, no hook `useSidebar`; sem estado global novo). Mobile mantém a gaveta. Aprovada pelo utilizador depois de uma versão de teste.

- **Tema escuro (teste, 2026-10-06)** — fundo azul-noite `#141B2D` (constante `SIDEBAR_BG`), texto claro, item ativo com barra laranja da marca; rodapé "by" + logótipo Mezza ERP (`public/mezza-erp.png`, 320 px) alinhado à direita, discreto (opacidade 80%). Só a barra lateral muda — as páginas mantêm o tema claro e o laranja.

**Ref pattern no composition root:** o `SidebarProvider` cria o `ReactAuthAdapter`
uma única vez (via `useMemo`) mas passa closures que leem `authRef.current`. Isto
evita recriar os use cases a cada render (estabilidade de referência) sem sacrificar
a frescura dos dados de auth.

**`AuthPort` unifica getUser + signOut:** o sign-out é responsabilidade da sidebar
(é o único ponto da UI que o aciona). Separar num port dedicado seria mais verboso
sem benefício prático.

**Identidade visual alinhada ao `cash-closings`:** tons stone, acentos
`#ED5C32`/`#EF8935`, fundo hover `#FAF6F3`, bordas `#F5C992`. O fundo global da
aplicação em `App.tsx` passou de `bg-slate-100` para `bg-[#FAF6F3]`.

**`NavLink` do react-router-dom no adapter/in:** o estado de item ativo é delegado
ao `NavLink` (que lê a localização atual via context interno). O domínio expõe
`isItemActive` como função pura para uso em testes, mas a UI não a invoca — apenas
o `NavLink`.

## Como testar

- Domínio/use cases: `npx vitest run src/modules/sidebar` (puro, sem DOM).
- UI/hook: substituir o módulo via prop `module` do `SidebarProvider` com fakes dos ports.

## Pontos de atenção / dívidas conhecidas

- Não há testes de UI do componente `Sidebar` — a lógica relevante está nos testes
  do serviço e dos use cases. Um teste de integração com `MemoryRouter` + fake
  module pode ser adicionado se a complexidade visual crescer.
