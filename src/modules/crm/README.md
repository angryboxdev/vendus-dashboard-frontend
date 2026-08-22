# Módulo: CRM

> Status: em refactor
> Última atualização: 2026-08-22

## Propósito

O módulo implementa a página operacional de clientes em `/crm/customers`. Ele apresenta estado, métricas, ações e tags numa tabela pesquisável e paginada, permitindo ao utilizador planejar e registrar o acompanhamento comercial.

A página de listagem já segue arquitetura hexagonal. Dashboard, detalhe do cliente e algumas rotas/tipos legados continuam fora deste módulo durante a migração gradual.

**O problema que resolve:**

O utilizador precisa trabalhar toda a base de clientes sem confundir dados históricos, scripts enviados e ações comerciais. A listagem oferece uma visão consistente e fluxos explícitos para próxima ação, conclusão, histórico e tags.

**Fluxo principal:**

```text
Utilizador                               Interface / backend
────────────────────────────────────    ────────────────────────────────────
1. Abre Clientes                    →   2. Carrega página de 10 clientes
3. Pesquisa, filtra ou ordena       →   4. Reconsulta o read model
5. Agenda uma próxima ação          →   6. Registra tipo, data e notas
7. Clica na ação quando a executa   →   8. Confirma data/hora de conclusão
9. Consulta Última ação             →  10. Carrega histórico sob demanda
11. Edita tags na célula            →  12. Atualiza associações e recarrega
```

## Conceitos do domínio

- **`CrmTableItem`** — read model de uma linha, com identidade, estado, métricas, ações, tags e último script.
- **Relacionamento** — `new`, `recurring` ou `vip`, calculado pelo backend.
- **Inatividade** — indicador independente do relacionamento; pode aparecer junto de qualquer badge.
- **Próxima ação** — ação pendente; sua `scheduledFor` é também a data de follow-up.
- **Última ação** — ação concluída mais recente da timeline nova.
- **Histórico** — ações concluídas/canceladas, paginadas por cursor e carregadas apenas ao abrir o modal.
- **Tipo de ação** — catálogo criado pelo utilizador; `code` é estável e `name` pode ser editado.
- **Tag** — classificação colorida atribuída a clientes individualmente ou em massa.
- **Origem das métricas** — `crm_orders`, `eatz_snapshot` ou `none`, informada pelo backend.
- **Último script** — coluna temporária e independente das ações.

O frontend não recalcula estados, métricas ou qual ação é a última/próxima. Essas regras pertencem ao backend; a UI apenas apresenta o contrato recebido.

## Ports

### Entrada (fachada consumida pela UI)

`CrmWorkspaceService` expõe:

- `listCustomers` — lista clientes com filtros e paginação.
- `listTags` / `createTag` — consulta e cria tags.
- `listActionTypes` / `createActionType` / `updateActionType` — gerencia o catálogo de ações.
- `listScripts` — carrega o catálogo completo, incluindo inativos, usado pelo filtro de último script histórico.
- `createActions` — agenda uma ação para um ou vários clientes.
- `completeAction` / `completeActions` — conclui ações pendentes.
- `listCustomerActions` — carrega próxima ação e histórico.
- `updateTags` — adiciona/remove tags.
- `setInactive` — mantém disponível o comando de inatividade manual.

### Saída (dependência externa)

`CrmWorkspaceApiPort` define o contrato assíncrono usado pela aplicação:

- Leitura paginada da tabela.
- Catálogos de tags e tipos.
- Agendamento/conclusão de ações.
- Histórico por cursor.
- Atualizações em massa de tags e inatividade.

O domínio não importa React, browser APIs ou funções HTTP.

## Adapters

### Entrada (UI)

- `CrmCustomersPage` — boundary da rota; instala `CrmProvider`.
- `CrmCustomersView` — tabela responsiva, filtros, seleção, paginação e modais.
- `ActionModal` — agenda próxima ação e permite criar/renomear tipos.
- `CompleteActionModal` — confirma a conclusão de uma ou várias pendências.
- `ActionHistoryModal` — mostra pendência e timeline paginada.
- `TagModal` — cria, adiciona e remove tags em contexto individual ou em massa.

Todos os pedidos passam por `CrmWorkspaceService`; componentes não chamam HTTP diretamente. React Query controla cache, estados de carregamento e invalidação após mutações.

### Saída

`HttpCrmWorkspaceApiAdapter` implementa `CrmWorkspaceApiPort`:

| Operação | Endpoint |
| --- | --- |
| Listar clientes | `GET /api/crm/customer-table` |
| Listar scripts | `GET /api/crm/scripts` |
| Listar/criar tipos | `GET|POST /api/crm/action-types` |
| Editar tipo | `PATCH /api/crm/action-types/:code` |
| Agendar ações | `POST /api/crm/actions` |
| Concluir ação | `PATCH /api/crm/actions/:id/complete` |
| Concluir em massa | `PATCH /api/crm/actions/complete-bulk` |
| Histórico | `GET /api/crm/customers/:customerId/actions` |
| Listar/criar tags | `GET|POST /api/crm/tags` |
| Atualizar tags | `PATCH /api/crm/customers/tags` |
| Atualizar inatividade | `PATCH /api/crm/customers/inactive` |

O adapter aplica valores padrão de `page=1` e `pageSize=10`, serializa tags separadas por vírgula, omite filtros vazios e codifica parâmetros de rota.

### Composition root

`crm.module.tsx` cria `HttpCrmWorkspaceApiAdapter`, injeta-o em `CrmWorkspaceService` e disponibiliza o serviço por Context. `CrmProvider` aceita opcionalmente um serviço alternativo para testes, sem alterar a composição de produção.

## Comportamento da página

### Tabela

Colunas:

1. Seleção.
2. Status de relacionamento e inatividade.
3. Cliente e código.
4. Telefone copiável.
5. Número de pedidos.
6. Data do último pedido.
7. Última ação e data de conclusão.
8. Próxima ação e data de follow-up.
9. Tags.
10. Último script (temporário).

Clicar no nome abre o detalhe legado. Telefone, última ação e próxima ação usam sublinhado discreto para indicar interação. A visualização mobile apresenta os mesmos comandos essenciais em cards.

### Filtros

- Pesquisa por nome, telefone ou código.
- Status: novo, recorrente ou VIP.
- Atividade: ativos/inativos.
- Tipo da última ação.
- Tipo da próxima ação.
- Último script (temporário).
- Tags, com combinação `any` ou `all`.

Qualquer mudança de filtro limpa a seleção e retorna à primeira página.

### Ordenação e paginação

- `Cliente`: código crescente, decrescente e ordem original.
- `Pedidos`: maior, menor e ordem original.
- `Último pedido`: mais recente, mais antigo e ordem original.
- O terceiro clique remove `sortBy`/`sortDirection`.
- Página padrão: 10 linhas.
- Opções: 10, 25, 50 ou 100.
- A paginação numérica é compactada com reticências quando existem muitas páginas.

### Ações

- Uma próxima ação começa sempre `pending`.
- O formulário possui tipo, data de follow-up e notas.
- O seletor começa vazio; sua última opção cria um tipo.
- A label de um tipo existente pode ser editada sem mudar o código.
- Clicar numa próxima ação existente abre a confirmação, preenchida com sua data/hora agendada.
- Após a conclusão, a ação aparece como última ação e o espaço da próxima fica livre.
- O histórico é carregado somente quando o modal é aberto.

### Tags

- Clicar na célula abre o editor com as tags atuais marcadas.
- É possível marcar, desmarcar e criar uma tag sem sair do modal.
- Uma tag recém-criada fica selecionada automaticamente.
- Em massa, `Adicionar tags` e `Remover tags` são comandos separados.
- O modal em massa começa sem tags selecionadas porque os clientes podem ter combinações diferentes.

### Ações em massa

Após selecionar clientes, a barra permite:

- Agendar ação.
- Concluir as próximas ações existentes.
- Adicionar tags.
- Remover tags.
- Cancelar a seleção.

Inativar/reativar foi removido da barra atual; o port permanece disponível para compatibilidade.

## Decisões de design (ADR resumido)

- **Backend como fonte de verdade:** classificação, métricas e seleção da última/próxima ação não são duplicadas na UI.
- **Follow-up sem estado próprio:** a data exibida vem sempre de `nextAction.scheduledFor`.
- **Timeline separada do legado:** scripts, contactos e follow-up manual não preenchem ações.
- **Histórico sob demanda:** reduz payload e custo da tabela principal.
- **Paginação no backend:** a interface não carrega os 289 clientes de uma vez.
- **Tipos e tags criados em contexto:** evita retirar o utilizador do fluxo operacional.
- **Mutação seguida de invalidação:** React Query recarrega o read model e evita atualizações otimistas divergentes.
- **Serviço injetável no provider:** testes de UI usam fakes do port, sem rede nem mock de `fetch`.
- **Visual alinhado ao Financeiro:** fundo, filtros, tabela, paginação e modais seguem o padrão da página de Faturas.

## Como testar

- Módulo CRM: `npm test -- --run src/modules/crm`
- Suíte completa: `npm test`
- Lint dos testes: `./node_modules/.bin/eslint src/modules/crm/adapters/in/CrmCustomersView.test.tsx src/modules/crm/adapters/out/http-crm-workspace-api.adapter.test.ts`
- Build: `npm run build`

Cobertura atual:

- Adapter HTTP: query params, filtros vazios, tags, URLs codificadas e payloads de mutação.
- UI: carregamento padrão, ordenação em três estados, tamanho da página e abertura dos fluxos de agendamento, conclusão e tags.

## Pontos de atenção / dívidas conhecidas

- Dashboard e detalhe permanecem legados e ainda usam contratos fora deste módulo.
- `CrmCustomersView.tsx` concentra vários modais e deve ser dividido quando os fluxos estabilizarem.
- `Último script (Temporário)` será removido numa etapa futura.
- O port de inatividade continua exposto, embora não exista ação em massa na tabela.
- Ainda não existem testes E2E contra um backend real; testes de UI usam um adapter fake.
- A suíte global do frontend possui duas expectativas desatualizadas no módulo `sidebar` (contagem de itens); os testes específicos do CRM passam.
