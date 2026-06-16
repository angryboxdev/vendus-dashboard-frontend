# CLAUDE.md (frontend)

Diretrizes deste repositório (frontend). Valem para **todo** trabalho de código.
Não desenvolva fora delas. Em caso de conflito entre um pedido e estas regras,
pare e me avise antes de prosseguir.

## Repositórios (front + back)

Este produto vive em dois repositórios separados, com **a mesma arquitetura
hexagonal**. As regras deste arquivo valem para este repositório (frontend).

- **Frontend** — este repositório, onde você está sendo executado.
- **Backend** — repositório separado. Caminho local (setup da minha máquina):
  `<CAMINHO_DO_BACKEND>`
  <!-- preencha com o caminho local do repo de backend -->

Ao mexer no contrato com o backend (endpoints, formatos de request/response,
tipos compartilhados), ajuste o outro lado na mesma tarefa e me avise se algo
ficar incompatível.

## Estado do projeto: migração em andamento

Este frontend está em **migração gradual** para a arquitetura hexagonal descrita
abaixo. Hoje convivem dois padrões:

- **Padrão novo** (hexagonal): a referência para TODO trabalho novo.
- **Padrão legado**: a maior parte do código ainda está aqui. Está sendo migrado
  aos poucos, um módulo por vez.

**Regra crítica:** a maioria do código ao redor é legada. Isso **não** é endosso.
Nunca imite a estrutura de um módulo legado ao escrever código novo. A fonte de
verdade do padrão é: (1) estas regras e (2) o módulo de referência indicado
abaixo — nunca o código vizinho. Se você não tem certeza se um módulo segue o
padrão novo, abra o `README.md` dele e veja o campo `Status`; sem README ou com
`Status: legado`, trate-o como legado e não o copie.

### Módulos já no padrão novo
<!-- Mantenha esta lista atualizada. É a fonte de verdade de quem já migrou. -->
- `tasks` (módulo de referência)
- `cash-closings`
- `sidebar`
- `financial-base` (junho 2026)
- `invoices` (junho 2026)

## Stack

Antes de escrever código, leia o `package.json` (e configs como `tsconfig.json`,
config de testes, lint) para identificar framework, libs e convenções já em uso,
e siga-as. Não introduza dependências novas sem me perguntar.

## Arquitetura: hexagonal (ports & adapters) no frontend

A ideia é a mesma do backend: o **domínio** (regras e estado da feature) não
conhece o framework de UI nem como os dados chegam. Ele define interfaces (ports)
e o mundo externo (componentes, clients HTTP, storage) as implementa.

Todo módulo novo segue esta estrutura, dentro de `src/modules/<modulo>/`:

```
domain/
  entities/      entidades e value objects — SEM React, fetch ou DOM
  ports/in/      input ports: interfaces dos use cases
  ports/out/     output ports: interfaces de dados/serviços externos
  services/      lógica pura da feature
application/
  use-cases/     implementam os input ports, orquestram o domínio
adapters/
  in/            UI: componentes e hooks que chamam os use cases
  out/           client HTTP/API, storage, etc. (implementam os output ports)
<modulo>.module.ts   composition root: monta o módulo e injeta os adapters
README.md            documentação do módulo (ver template abaixo)
```

**Módulo de referência:** use `src/modules/tasks` como modelo de estrutura e
estilo. É a única referência de padrão — nunca use um módulo legado como modelo.

### O que muda em relação ao backend

- **Adapter de entrada** é a UI: componentes e hooks. Um hook (ex.: `useTasks`)
  consome um input port (use case) e expõe estado/ações para os componentes.
- **Adapter de saída** é o acesso a dados: client HTTP/API, `localStorage`, etc.
- O **composition root** monta os adapters e os disponibiliza para a árvore de
  componentes (via Context/provider, factory, ou o mecanismo de DI já usado no
  projeto).

### Regras de dependência (inegociáveis)

1. **`domain/` não importa React, `fetch`/axios, nem APIs de DOM/browser.** Se o
   domínio precisa de algo externo, declara um **output port** (interface) e
   alguém de fora implementa.
2. **Componentes não falam direto com HTTP/API.** Eles consomem use cases (via
   hook). O acesso a dados vive nos adapters de saída.
3. **Dependências cruzam por interface, nunca por implementação concreta.** Use
   cases recebem os output ports por injeção.
4. **O composition root é o único lugar que conhece os adapters concretos.** É lá
   que se "pluga" qual implementação entra. Em teste, plugam-se fakes no lugar.

As setas de dependência apontam sempre para o domínio.

## Antes de alterar um módulo (comportamento padrão, sem eu pedir)

1. **Identifique o padrão do módulo.** Consulte a lista "Módulos já no padrão
   novo" e o `Status` do README. Se for **legado**, não estenda o padrão antigo;
   faça o mínimo pedido e sugira migração se a mudança for grande (pergunte antes).
2. **Leia o `README.md` do módulo** antes de qualquer mudança. Atenção à seção
   "Decisões de design" — não desfaça escolhas propositais.
3. Identifique se a mudança toca domínio, ports ou adapters (UI/dados) e respeite
   as regras de dependência acima.

## Depois de alterar um módulo (comportamento padrão, sem eu pedir)

1. **Rode os testes do módulo** e garanta que passam antes de concluir.
2. **Atualize o `README.md`** se a mudança alterou ports, adapters, conceitos do
   domínio ou alguma decisão de design.
3. Lógica nova de domínio/use case vem com teste unitário (com fakes dos output
   ports). Componente novo com comportamento relevante vem com teste de UI.

## Testes

- Use o runner já configurado no projeto (Jest ou Vitest — verifique o
  `package.json`).
- Domínio e use cases: testes rápidos e isolados, com fakes dos output ports. Não
  faça rede nem dependa de DOM para testar regra/estado.
- Componentes/hooks: testes de UI (ex.: Testing Library), plugando fakes dos
  adapters de saída pelo composition root.

## Documentação de módulo — template do README.md

Todo módulo tem um `README.md` na raiz da sua pasta seguindo exatamente este
formato:

```markdown
# Módulo: <nome>

> Status: ativo | em refactor | legado
> Última atualização: <data>

## Propósito
O que resolve (2-3 frases). O que é e o que NÃO é responsabilidade dele.

## Conceitos do domínio
Entidades / value objects principais e regras/estado da feature.

## Ports
### Entrada (use cases)
- `NomeDoUseCase` — o que faz, quando é chamado.
### Saída (dependências do domínio)
- `NomeApiClient` / `NomeStorage` — o que o domínio espera dessa interface.

## Adapters
### Entrada (UI)
- `useNome` (hook) / `NomeView` (componente) → consomem os use cases.
### Saída
- `HttpNomeClient` → implementa `NomeApiClient` usando <tecnologia>.

## Decisões de design (ADR resumido)
Decisões não óbvias e o PORQUÊ.

## Como testar
- Domínio/use cases: `<comando>` (rápido, com fakes).
- Componentes/hooks: `<comando de UI>`.

## Pontos de atenção / dívidas conhecidas
O que ainda não está ideal (sobretudo em módulos legados).
```

## Refactor de módulos legados

O refactor é **gradual**, módulo a módulo, nunca um big-bang. Ao migrar: marque o
`README` como `em refactor`, cubra com testes antes de mover código, e migre por
camadas (extrair domínio/estado → definir ports → mover acesso a dados e UI para
adapters). Não altere o comportamento externo do módulo durante o refactor sem me
avisar.
