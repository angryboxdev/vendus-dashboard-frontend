# Módulo: invoicing

> Status: ativo (em construção — área «Vendas» de testes da faturação certificada AT)
> Última atualização: 2026-11-04 (F5: SAF-T)

## Propósito
Área **Vendas** (`/vendas`): emitir documentos fiscais certificáveis pela AT (fatura, fatura simplificada, fatura-recibo, consulta de mesa), consultar a 2.ª via com ATCUD e código QR, anular com motivo, e gerir séries. Fala só com `/api/invoicing` do backend. **Não** toca em Vendus, AirMenu, DRE, custos nem stock. Enquanto o programa não tem certificado da AT, só há séries de formação e os documentos dizem «DOCUMENTO DE TESTE – SEM VALOR FISCAL».

## Conceitos do domínio
- `IssueForm` / `IssueFormLine` (`issue-form.service.ts`) — o formulário como o utilizador escreve (vírgula decimal aceite; preço com IVA; IVA 13 % por omissão). `validateIssueForm` (série, linhas completas, números, meio de pagamento na FR, nome com NIF), `toIssueInput` (pedido da API; sem NIF = consumidor final) e `estimateLineGross` (só para mostrar — o total oficial é o do servidor).
- Entidades em `entities/invoicing.ts`: espelho do contrato do backend (`Series`, `DocumentSummary`, `DocumentView` com `printed.atcud`/`printed.mentions`, `InvoicingMeta`), rótulos e totais sempre em texto exato.
- Erros: `IssueNeedsConfirmationError` (avisos de data futura / relógio), `FiscalRuleError` (regra recusada pelo servidor, mensagem já em português).

## Ports
### Entrada (use cases)
- `InvoicingPort` (`InvoicingUseCases`) — `exportSaft` (valida o período e descarrega), `meta`, `listSeries`, `createSeries`, `setValidationCode`, `listDocuments`, `getDocument`, `issue(form, {attemptKey, confirmWarnings})` → `issued` | `invalid` | `needs-confirmation`, `newAttemptKey`, `cancel`, `legalEntities`; comunicação à AT (F6): `atStatus`, `saveAtCredentials`/`removeAtCredentials`, `communicateAt(force)`, `documentAtCommunications`, `registerSeriesAt`/`finalizeSeriesAt`/`cancelSeriesAt` — as escritas validam o utilizador `NIF/n.º` e a senha e devolvem erros do formulário.
### Saída (dependências do domínio)
- `InvoicingApiPort` — a API `/api/invoicing` (+ entidades legais de `/api/novo-rh/legal-entities`); escrita sempre com chave de idempotência.
- `IdGeneratorPort` — chaves de idempotência.

## Adapters
### Entrada (UI)
- `InvoicingLayout` — página «Vendas» com separadores e avisos (não certificado; emissão indisponível sem chave).
- `IssueDocumentView` — formulário de emissão; diálogo para confirmar avisos.
- `DocumentsView` + `DocumentDetail` — lista com filtros; 2.ª via numa gaveta (ATCUD imediatamente acima do QR, menções fiscais) e anulação com motivo da lista fechada.
- `SeriesView` — criar série (formação; normal só com certificado) e registar o código de validação da AT.
- `AtCommunicationView` — separador «Comunicação AT»: pendentes, prazo (dia 5 do mês seguinte, aviso a 3 dias e ultrapassado), recusas da AT, «Comunicar agora» / «Repetir recusados», credenciais WFA por emitente (a senha nunca é mostrada).
- `AtSeriesActions` + `AtCredentialsFields` — nas Séries: registar, finalizar (com documentos) ou anular (sem documentos) na AT com o subutilizador WSE pedido no momento.
- `DocumentDetail` mostra o histórico de envios do documento à AT.
- `SaftExportView` — exportar o SAF-T (PT) 1.04_01 de um emitente e período (mês anterior por omissão; um só ano; formação opcional).
- Hooks em `use-invoicing.ts` (`useIssueDocument` gere a chave de idempotência).
### Saída
- `HttpInvoicingApiAdapter` → `InvoicingApiPort` com `apiGet`/`apiWrite` (`src/lib/api.ts`); traduz 409 com avisos e 400/404/409/422/503 em erros do domínio.
- `CryptoIdGenerator` → `IdGeneratorPort` com `crypto.randomUUID()`.
- `BrowserFileSaver` → `FileSaverPort` (descarga do SAF-T no browser; obrigatório nos casos de uso). O SAF-T exige `sales.invoicing` MANAGE no backend; «Incluir formação» vem ligado só antes do certificado.

## Decisões de design (ADR resumido)
- **Nunca duas faturas por engano**: a mesma chave de idempotência num reenvio do mesmo pedido (falha de rede) devolve a mesma resposta; formulário alterado ou avisos confirmados = pedido novo, chave nova (o backend recusa a mesma chave com outro corpo).
- **Totais oficiais só do servidor**: o ecrã estima o valor das linhas; o documento gravado (e a 2.ª via) traz os totais exatos calculados e assinados no backend.
- **QR pela especificação da AT**: `qrcode.react` (já dependência do projeto), nível M, versão mínima 9, 30 × 30 mm; o conteúdo (`qrPayload`) vem do backend.
- **Acesso**: rota `/vendas` exige `sales.invoicing` (`access-ui.service.ts`); o menu «Vendas» só aparece a quem a tem — por omissão, só o Admin; sem acesso carregado, só o papel admin.
- **Uma instância do módulo por montagem** (`useState` no provider): os hooks dependem dela.
- **Comunicação à AT por webservice escondida** (`AT_WEBSERVICE_ENABLED = false`, decisão do utilizador 2026-11-04): modelo tradicional — SAF-T exportado aqui e carregado no e-Fatura pelo contabilista; séries comunicadas no Portal das Finanças. Ficam escondidos o separador «Comunicação AT», as ações «na AT» das Séries e o histórico de envios da 2.ª via. Para voltar: `true` e repor a entrada no menu (`nav-state.service.ts`).
- **Senhas da AT só em trânsito**: os campos ficam no estado do formulário e limpam-se depois de gravar; WSE nunca é guardada (nem no servidor); `autoComplete="new-password"` para o browser não a sugerir.
- NC/ND ainda não se emitem pelo ecrã (precisam de escolher o documento retificado) — a API já as suporta.

## Como testar
- `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/invoicing`
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit`

## Pontos de atenção / dívidas conhecidas
- Emitir NC/ND e faturar consultas de mesa a partir do ecrã (a API suporta; falta a escolha do documento).
- Taxa por produto e canal (sala/take-away) — hoje escolhe-se em cada linha.
- Impressão térmica (POS) e PDF — fase do POS.
- Comunicação à AT sem teste real (falta o certificado de testes da AT no servidor); a migração `20261220120000` do backend ainda não está aplicada.
