# Módulo: sidebar

> Status: ativo
> Última atualização: 2026-06-12

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
começa com o seu `basePath`. O utilizador pode colapsar grupos ativos ou expandir
grupos inactivos manualmente; esse estado local é gerido no hook `useSidebar`.

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
