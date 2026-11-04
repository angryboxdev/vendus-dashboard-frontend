# Módulo: invoicing

> Status: ativo (em construção — área «Vendas» de testes da faturação certificada AT)
> Última atualização: 2026-11-04

## Propósito
Área **Vendas** (`/vendas`): emitir documentos fiscais certificáveis pela AT (fatura, fatura simplificada, fatura-recibo, consulta de mesa), consultar a 2.ª via com ATCUD e código QR, anular com motivo, e gerir séries. Fala só com `/api/invoicing` do backend. **Não** toca em Vendus, AirMenu, DRE, custos nem stock. Enquanto o programa não tem certificado da AT, só há séries de formação e os documentos dizem «DOCUMENTO DE TESTE – SEM VALOR FISCAL».

## Conceitos do domínio
- `IssueForm` / `IssueFormLine` (`issue-form.service.ts`) — o formulário como o utilizador escreve (vírgula decimal aceite; preço com IVA; IVA 13 % por omissão). `validateIssueForm` (série, linhas completas, números, meio de pagamento na FR, nome com NIF), `toIssueInput` (pedido da API; sem NIF = consumidor final) e `estimateLineGross` (só para mostrar — o total oficial é o do servidor).
- Entidades em `entities/invoicing.ts`: espelho do contrato do backend (`Series`, `DocumentSummary`, `DocumentView` com `printed.atcud`/`printed.mentions`, `InvoicingMeta`), rótulos e totais sempre em texto exato.
- Erros: `IssueNeedsConfirmationError` (avisos de data futura / relógio), `FiscalRuleError` (regra recusada pelo servidor, mensagem já em português).

## Ports
### Entrada (use cases)
- `InvoicingPort` (`InvoicingUseCases`) — `meta`, `listSeries`, `createSeries`, `setValidationCode`, `listDocuments`, `getDocument`, `issue(form, {attemptKey, confirmWarnings})` → `issued` | `invalid` | `needs-confirmation`, `newAttemptKey`, `cancel`, `legalEntities`.
### Saída (dependências do domínio)
- `InvoicingApiPort` — a API `/api/invoicing` (+ entidades legais de `/api/novo-rh/legal-entities`); escrita sempre com chave de idempotência.
- `IdGeneratorPort` — chaves de idempotência.

## Adapters
### Entrada (UI)
- `InvoicingLayout` — página «Vendas» com separadores e avisos (não certificado; emissão indisponível sem chave).
- `IssueDocumentView` — formulário de emissão; diálogo para confirmar avisos.
- `DocumentsView` + `DocumentDetail` — lista com filtros; 2.ª via numa gaveta (ATCUD imediatamente acima do QR, menções fiscais) e anulação com motivo da lista fechada.
- `SeriesView` — criar série (formação; normal só com certificado) e registar o código de validação da AT.
- Hooks em `use-invoicing.ts` (`useIssueDocument` gere a chave de idempotência).
### Saída
- `HttpInvoicingApiAdapter` → `InvoicingApiPort` com `apiGet`/`apiWrite` (`src/lib/api.ts`); traduz 409 com avisos e 400/404/409/422/503 em erros do domínio.
- `CryptoIdGenerator` → `IdGeneratorPort` com `crypto.randomUUID()`.

## Decisões de design (ADR resumido)
- **Nunca duas faturas por engano**: a mesma chave de idempotência num reenvio do mesmo pedido (falha de rede) devolve a mesma resposta; formulário alterado ou avisos confirmados = pedido novo, chave nova (o backend recusa a mesma chave com outro corpo).
- **Totais oficiais só do servidor**: o ecrã estima o valor das linhas; o documento gravado (e a 2.ª via) traz os totais exatos calculados e assinados no backend.
- **QR pela especificação da AT**: `qrcode.react` (já dependência do projeto), nível M, versão mínima 9, 30 × 30 mm; o conteúdo (`qrPayload`) vem do backend.
- **Acesso**: rota `/vendas` exige `sales.invoicing` (`access-ui.service.ts`); o menu «Vendas» só aparece a quem a tem — por omissão, só o Admin; sem acesso carregado, só o papel admin.
- **Uma instância do módulo por montagem** (`useState` no provider): os hooks dependem dela.
- NC/ND ainda não se emitem pelo ecrã (precisam de escolher o documento retificado) — a API já as suporta.

## Como testar
- `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/invoicing`
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit`

## Pontos de atenção / dívidas conhecidas
- Emitir NC/ND e faturar consultas de mesa a partir do ecrã (a API suporta; falta a escolha do documento).
- Taxa por produto e canal (sala/take-away) — hoje escolhe-se em cada linha.
- Impressão térmica (POS) e PDF — fase do POS.
- Não testado contra a BD real: as migrações do backend ainda não estão aplicadas.
