# Módulo: access

> Status: ativo
> Última atualização: 2026-10-06

## Propósito
Utilizadores & Perfis de Acesso 2.0 (backend `.scratch/utilizadores-perfis`):
ecrãs **Utilizadores**, **Editar utilizador** e **Perfis de acesso** (só
Admin), e as regras de apresentação que adaptam menu e rotas ao acesso
efetivo de quem está autenticado. NÃO decide permissões — o backend
(`/api/*` com a tabela central rota → permissão) recusa cada pedido.

## Conceitos do domínio
- **Perfil de acesso** (`AccessProfile`) → permissões por funcionalidade
  `NONE | READ | MANAGE` + permissões especiais (Permitido / Não permitido).
  Admin e Colaborador são protegidos.
- **Exceções individuais** (`overrides`): prevalecem sobre o perfil; sem
  exceção, herda o valor atual do perfil. "Restaurar padrão" remove a exceção.
- **Acesso efetivo** (`MyAccess`, `GET /api/me/access`) — com o catálogo
  (módulos/funcionalidades/especiais) vindo do backend: nenhuma chave de
  permissão é inventada no frontend, exceto o mapeamento rota do frontend →
  funcionalidade (`requiredPermissionForPath`), que espelha o menu.
- `access-ui.service.ts`: `effectiveOf`, `setUserLevel` (igual ao perfil =
  sem exceção), `restoreDefault`, controlo rápido por módulo, estado do
  módulo (Sem acesso / Ver tudo / Gerir tudo / Personalizado), resumo da
  coluna Acessos, `canOpenPath`.

## Ports
### Entrada (use cases)
- Sem use cases próprios: leituras/escritas diretas de recursos do backend
  (mesmo padrão do módulo `hr`). Os ecrãs usam a porta através dos hooks de
  `use-access-admin.ts`.
### Saída (dependências do domínio)
- `AccessApiPort` — `/api/me/access`, `/api/users*`, `/api/users/employee-options`,
  `/api/access-profiles*`. Erros 400/409 → `AccessRequestError` (mensagem PT-PT).

## Adapters
### Entrada (UI)
- `UsersView` (`/admin/users`) — tabela, pesquisa, filtros, `NewUserModal`
  (email + perfil; Colaborador exige ficha; palavra-passe temporária mostrada uma vez).
- `UserEditorView` (`/admin/users/:userId`) — mockup 3: módulos à esquerda,
  funcionalidades com Origem/Restaurar padrão ao centro, perfil + ficha
  associada + resumo à direita; desativar/reativar, repor palavra-passe.
- `ProfilesView` (`/admin/access-profiles`) — mockup 4: lista, permissões por
  módulo (expandir/recolher), Novo perfil com base, Duplicar, Desativar.
- `HomeRedirect` — `/` vai para a primeira área permitida.
### Saída
- `HttpAccessApiAdapter` — `lib/api`.

## Decisões de design (ADR resumido)
- **Acesso efetivo no `AuthContext`** (`user.access`), recarregado com a
  sessão e quando a app volta a ter foco — a barra lateral e o
  `ProtectedRoute` usam-no; sem acesso carregado, comportam-se como antes.
- **Rascunho local** no Editar/Perfis; grava com a `version` lida — se outro
  Admin gravou entretanto, o backend responde 409 e a mensagem aparece.
- Botões/tema seguem o laranja da marca (os mockups usavam roxo).

## Como testar
- `npx vitest run src/modules/access`

## Pontos de atenção / dívidas conhecidas
- Os ecrãs de cada área ainda não escondem botões de escrita em READ
  (o backend recusa com 403); afinar área a área.
- "Último acesso" mostra só a data (sem tipo de dispositivo — minimização).
