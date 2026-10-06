# Módulo: organization

> Status: ativo
> Última atualização: 2026-10-04

## Propósito
Área **Empresa & Estrutura** (`/empresa/*`), fora de Recursos Humanos — dono
da moldura da área (`CompanyStructureLayout`: cabeçalho + abas, conteúdo por
rota filha) e da aba **Empresa**: dados da entidade legal (razão social, NIF,
NISS, morada fiscal, contactos, fuso horário, logotipo) e o respetivo
histórico de alterações. A aba Locais é do módulo `locations`; Calendário e
Documentos entram em tickets seguintes da Base Organizacional (
`.scratch/base-organizacional/` no backend).

## Conceitos do domínio
- **`OrganizationProfile`** — espelho do DTO do backend; a "Empresa" é a
  `Organization` já existente, não uma entidade nova.
- **Formulário** (`organization-form.service.ts`) — `toFormValues`,
  `diffChanges` (só envia campos alterados; opcional esvaziado → `null`,
  obrigatório esvaziado → `""` para o backend o rejeitar no próprio campo),
  `validateLogoFile` (JPG/PNG/WEBP/SVG até 2 MB, os mesmos limites do
  backend).
- **Histórico** (`organization-history.service.ts`) — rótulo da ação e
  campos alterados de cada entrada.
- **Erros** — `OrganizationValidationError` (400 com `fieldErrors`) e
  `InvalidLogoFileError` (validação local, sem pedido).

## Ports
### Entrada (use cases)
- `GetOrganizationProfilePort`, `UpdateOrganizationProfilePort` (sem
  alterações não faz pedido), `UploadOrganizationLogoPort`,
  `ListOrganizationHistoryPort`.
### Saída (dependências do domínio)
- `OrganizationApiPort` — `getProfile`, `updateProfile`, `uploadLogo`,
  `listHistory`.

## Adapters
### Entrada (UI)
- `useOrganizationProfile` / `useOrganizationHistory` (react-query sobre
  os use cases).
- `CompanyStructureLayout` + `CompanyStructureTabs` — moldura de `/empresa/*`
  (abas Empresa, Locais, Calendário & Eventos, Documentos).
- `OrganizationProfileView` — conteúdo da aba Empresa: cartão do logotipo,
  formulário por secções, histórico (colapsável).
### Saída
- `HttpOrganizationApiAdapter` → `/api/organization` (`GET`, `PATCH`,
  `POST /logo`, `GET /history`), via `src/lib/api.ts`.
- `InMemoryOrganizationApiAdapter` → testes/offline (dados fictícios).

## Decisões de design (ADR resumido)
- **Edição só para `admin`**, como no backend — os restantes roles veem
  os dados desativados; histórico também só `admin`.
- **Abas só quando existem** — `CompanyStructureTabs` mostra as 4 abas da task (Empresa, Locais, Calendário & Eventos, Documentos);
  a task proíbe preparar UI sem funcionalidade.
- **Formulário reiniciado por `key={profile.updatedAt}`** em vez de
  `setState` dentro de `useEffect` (regra de lint do projeto); por isso as
  mutations vivem no componente pai, para o estado de sucesso/erro
  sobreviver ao remount.
- **Estado da empresa só de leitura** (spec D8 no backend).

## Como testar
- `npx vitest run src/modules/organization`

## Pontos de atenção / dívidas conhecidas
- Lista de países/fusos é curta (PT/ES e fusos ibéricos); o backend aceita
  qualquer código ISO/IANA — o valor atual é sempre mostrado mesmo que
  não esteja na lista.
- `organization.module.tsx` exporta o hook `useOrganizationModule` ao lado
  do provider (aviso `react-refresh/only-export-components`), tal como o
  módulo de referência `tasks`.
