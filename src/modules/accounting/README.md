# Módulo: accounting

> Status: ativo
> Última atualização: 2026-09-28

---

## O que é e para que serve (perspectiva de negócio)

Área "Contabilidade": uma lista agregada de documentos fiscais (faturas/
notas de crédito, já geridas em Faturas, + `AccountingDocument` — qualquer
documento sem o fluxo bancário normal da empresa: sócio, funcionário,
plataforma, regularização…) e um ecrã de apuramento de IVA por período
(mensal ou trimestral, configurável). Não substitui o módulo Faturas — só o
complementa.

**Conceitos-chave:**

- **`AccountingDocument`** — o único tipo de documento genuinamente novo
  deste módulo. `fundingSource` (sócio/funcionário/plataforma/outra)
  exclui deliberadamente banco/cartão/caixa da empresa: esse fluxo é
  sempre uma Fatura normal (módulo Faturas), nunca um `AccountingDocument`.
- **Documentos** — vista agregada, nunca um CRUD paralelo de faturas.
  "Novo documento" só cria `AccountingDocument`; faturas continuam a
  criar-se em Faturas. Cada linha tem `source: "invoice" | "accounting_document"`
  — só a segunda abre o drawer de edição.
- **Dedutibilidade de IVA** — a subcategoria de centro de custo só
  *sugere* (`vatDeductible` boolean → 100%/0%); o gestor pode divergir via
  `deductiblePercentage` (0-100), mas nesse caso
  `deductibilityOverrideReason` é obrigatório (validado no backend). O
  mesmo mecanismo existe por linha de fatura (módulo Faturas, ver abaixo).
- **Deteção de duplicados** — `POST/PATCH /accounting/documents` pode
  responder 409 com `{ error, candidate }` quando encontra um possível
  duplicado (mesmo NIF+número+data+total). A UI mostra o candidato e deixa
  reenviar o mesmo pedido com `confirmDuplicate: true`.
  Anexos são versionados — cada upload em `POST .../attachment` acrescenta
  uma versão nova, nunca substitui a anterior.
- **Apuramento de IVA** — acompanhamento por período (mensal ou
  trimestral, `GET/PATCH /accounting/settings`). `documents[]` no retorno
  de `/vat-overview` é o drill-down só de compras `AccountingDocument`
  (não têm uma taxa de IVA única fiável, por isso ficam fora de `byRate`
  mas continuam visíveis nessa tabela extra). Ainda sem fecho formal nem
  geração de ZIP/envio ao contabilista (aba "Envios" continua placeholder).

## Propósito técnico

Consome `/api/accounting/*` (backend, módulo `accounting`, reescrito nesta
sessão — `AccountingDocument` substitui o antigo `PartnerExpense`).
Reaproveita `financial-base` (via `useFinancialBaseModule()`) para o
seletor de centro de custo/subcategoria no formulário de documento — nunca
duplica esse carregamento.

## Adapters

### Entrada (UI)

- **`AccountingView`** — módulo único com 4 abas internas (`?tab=`):
  Visão geral / Documentos / IVA / Envios (placeholder). Só a navegação de
  topo é partilhada; cada aba mantém o seu próprio título de página.
- **`AccountingDocumentsView`** (aba "Documentos") — tabs Todos/Faturas/
  Documentos de acompanhamento (contagens client-side), pesquisa por
  entidade, tabela (Entidade/Documento/Data/Tipo/Origem/Valor/Estado/Ação).
  Ação em linhas `source: "invoice"` abre `/financial/invoices` numa nova
  aba (sem pré-filtro — ver Known gaps); ação em linhas
  `source: "accounting_document"` abre `AccountingDocumentDrawer` em modo
  edição. "+ Novo documento" abre o mesmo drawer em modo criação.
- **`AccountingDocumentDrawer`** — criar/editar `AccountingDocument`:
  secções Origem e pagamento / Detalhes / Classificação (com override de
  % dedutível) / Observações / Anexos (histórico de versões, sem tabs —
  ver Design decisions). Mostra o estado e as ações de transição
  disponíveis (Validar/Marcar com pendência/Cancelar — só a partir de
  `pending_review`; `closed` ainda não tem endpoint, sem UI). Trata o 409
  de duplicado com um alerta inline (cancelar ou "Criar mesmo assim").
- **`VatControlView`** (aba "IVA", título "Apuramento de IVA") —
  navegação por período sensível à periodicidade configurada (passo de 1
  mês ou 1 trimestre), `<select>` inline para mudar a periodicidade
  (`GET/PATCH /accounting/settings` — sem modal dedicado, ver Design
  decisions), 4 cards (liquidado/dedutível/não-dedutível/saldo), tabela
  "IVA por taxa" e tabela extra "Documentos de acompanhamento" (drill-down
  das compras `AccountingDocument`, fora do breakdown por taxa).

### Saída

- `HttpAccountingApiAdapter` — implementa `AccountingApiPort` usando
  `apiGet`/`apiPost`/`apiPatch`/`apiPostFormData` de `src/lib/api.ts`.
  Intercepta o 409 de duplicado e traduz `{ error, candidate }` num
  `AccountingDuplicateError` tipado (`domain/errors.ts`) — a UI nunca vê o
  `ApiError` genérico para este caso.

## Decisões de design (ADR resumido)

### `ApiError` ganhou um campo `data` (mudança em `src/lib/api.ts`)

Necessário para o fluxo de duplicados: o 409 devolve `{ error, candidate }`
e o `ApiError` anterior só guardava a mensagem, perdendo `candidate`. Passou
a guardar o corpo JSON já parseado em `ApiError.data` — mudança retro-
compatível (todos os outros módulos continuam a ler só `.message`).

### `AccountingDocumentDrawer` sem tabs internas

Mesma decisão do antigo `PartnerExpenseDrawer`: um único formulário com
secções separadas por título, mais rápido de preencher para um registo
pontual. Reavaliar tabs se o formulário crescer muito.

### Sem modal de definições dedicado para a periodicidade de IVA

Não existe no repositório um padrão de modal "Configurar regras"
equivalente ao pedido (procurado em `src/modules/hr/adapters/in/`, sem
resultado). Em vez de construir um sistema de modal novo para uma única
opção, ficou um `<select>` inline junto ao navegador de período — trivial
de promover a modal mais tarde se surgirem mais definições.

### Anexos: histórico de versões sem link de download

`AccountingDocumentAttachmentDTO` só expõe `storagePath` (interno); o
backend não expõe (ainda) uma rota de URL assinada para anexos deste
módulo (ao contrário do padrão "mirror de `HrFileStoragePort`" descrito no
próprio port). A UI lista `version`/`uploadedAt`/`uploadedBy` de cada
versão mas não oferece um link "ver anexo" — ver Known gaps.

### Sem página "Visão geral" redundante

Mantido da Fase 1: a "Visão geral" é um resumo leve que reaproveita as
mesmas queries de Documentos/IVA, nunca uma 3ª agregação própria.

### "Ver" fatura/nota de crédito não pré-filtra a lista de Faturas

Mantido da Fase 1 — `InvoicesView` não lê parâmetro de pesquisa inicial da
URL hoje. Candidato a melhorar (mesmo padrão `?q=` já usado em
`hr`/`AttendanceView`) se isto se tornar um ponto de fricção.

## Como testar

- `npx tsc --noEmit -p tsconfig.app.json` + `npx eslint src/modules/accounting`.
- `npx vitest run` (ainda sem testes de UI próprios deste módulo — mesma
  dívida já existente nos outros módulos financeiros).

## Known gaps / open debt

- Sem paginação em "Documentos" — volume esperado é baixo por agora.
- Sem exportação/CSV nesta vista (existe noutras, ex. Faturas).
- Sem link de download por versão de anexo (backend não expõe URL
  assinada para anexos de `AccountingDocument` — ver Design decisions).
- Fecho formal de período de IVA e pacote de Documentos para
  Contabilidade + Envios ainda não implementados (aba "Envios" continua
  placeholder).
- `closed` existe no tipo `AccountingDocumentStatus` mas nenhum endpoint o
  define ainda — sem UI para essa transição, por desenho.
