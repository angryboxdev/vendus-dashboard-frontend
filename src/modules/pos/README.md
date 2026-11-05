# Módulo: pos

> Estado: ativo (fases 1 e 2, em testes — documentos de formação) · Atualizado: 2026-11-05

## Propósito
A caixa do Mezza em ecrã inteiro (`/pos`): o funcionário entra com o PIN do registo de ponto, escolhe os produtos, aplica descontos, cobra (Cartão, Dinheiro com troco, MB Way) e sai a fatura-recibo com o talão de 80 mm. Um gestor emite notas de crédito e é o único que sai do POS para a gestão. Os artigos que controlam stock mostram o stock; vender sem stock pede confirmação («Vender na mesma») e fica como alerta no painel. Lê códigos de barras. Na gestão: `Vendas → Produtos` (importar a exportação do Vendus; editar preço, IVA, código de barras, «Controla stock», à venda; entradas e contagens de stock) e `Vendas → Caixa (POS)` (séries FR/NC, vista por omissão e gestores).

Enquanto o programa não está certificado pela AT, os documentos são de formação («DOCUMENTO DE TESTE – SEM VALOR FISCAL»); o Vendus continua oficial. Backend: `src/modules/pos` (API `/api/pos`).

## Conceitos do domínio
- **Produto** (`PosProduct`): referência, nome, categoria, preço com IVA (cêntimos), IVA 6/13/23, foto, código de barras, stock do POS (`stockQty`, pode ser negativo).
- **Stock** (`cart.service.ts`): `stockBadge` (≤ 2 baixo, 0/negativo sem stock), `stockShortages` (aviso antes de faturar), `changedStock` (anel de ~4 s). `StockMove`/`StockDay` vêm do servidor (alerta = venda que deixou o stock negativo).
- **Código de barras** (`cart.service.ts`): `findByCode` (código exato, senão referência exata) e `scanKey` (leitor como teclado: teclas a ≤ 50 ms + Enter; escrever à mão não dispara).
- **Carrinho** (`cart.service.ts`): linhas, descontos por linha e na venda (% ou €), total com a **mesma regra do backend** (repartição ao cêntimo por maior resto) — o total no ecrã é o da fatura; valores rápidos de dinheiro e teclado em cêntimos; pesquisa sem acentos.
- **Venda / devolução** (`PosSale`): o documento fiscal, funcionário, meio de pagamento, entregue/troco.

## Ports
### Entrada (use cases)
- `PosPort` (`PosUseCases`): produtos (listar, importar, editar), `adjustStock` (entrada/contagem), `stockDay`, configuração, funcionários, séries, `login` (PIN, com a vista lembrada), `setView`, `checkout(…, attemptKey)` → `done` | `invalid`, `refund`, `documents`, `summary`, `receipt`.
### Saída
- `PosApiPort` — `/api/pos` e a 2.ª via `/api/invoicing/documents/:id`; vendas e devoluções com chave de idempotência.
- `PosIdGeneratorPort` — chaves.

## Adapters
### Entrada (UI)
- `PosScreen` — PIN, barra superior (vista Grelha/Lista, Documentos, Painel, trocar de funcionário, Gestão com PIN de gestor), vista A (`CategorySidebar` + `ProductGrid` + talão e pagamento em janela), vista B (`SearchBox` com Enter = código exato ou 1.º resultado, `CategoryChips`, `ProductTable`, painel com pagamento compacto), aviso «Stock insuficiente» (Rever venda / Vender na mesma), leitor de código de barras fora dos campos, talão emitido.
- `StockPill` (indicador de stock com anel laranja), `PosPinPad`, `PosTicket` (+ `DiscountEditor`, «stock insuficiente» na linha), `PaymentPanel`, `PosReceipt` (80 mm: ATCUD acima do QR nível M versão ≥ 9, 30 mm; impressão só do talão), `PosDocuments` (+ nota de crédito por quantidades, motivo, confirmação e PIN de gestor), `PosDashboard` (com alertas e movimentos de stock do dia).
- `PosProductsView` (importação com pré-visualização; código de barras, «Controla stock», stock com Entrada/Contagem), `PosSettingsView` (séries, vista por omissão e gestores).
- Paleta própria do POS em `pos-theme.ts` (bege/laranja da especificação), só dentro do POS.
### Saída
- `HttpPosApiAdapter` → `PosApiPort` (`apiGet`/`apiWrite`; 403 → erro de PIN, 4xx/503 com `detail` → `PosError`); `CryptoPosIdGenerator`.

## Decisões de design (ADR resumido)
- **Uma chave por pedido**: repetir a cobrança depois de uma falha de rede usa a mesma chave (nunca duas faturas); mudar o talão, o desconto ou o pagamento gera chave nova.
- **PIN em cada venda**: o PIN fica só em memória na sessão do POS e vai em cada venda/devolução (o servidor valida e regista quem atendeu).
- **Vista preferida por funcionário no servidor** (`PUT /api/pos/view` com o PIN; volta no `login`); quem nunca escolheu fica com a vista por omissão do gestor. Uma falha a gravar não impede de vender.
- **Aviso de stock só no ecrã**: o servidor nunca recusa por falta de stock (regra da gerência); os produtos recarregam depois de cada venda/devolução e ao abrir o Painel.
- **Leitor de código de barras sem dependências**: é um teclado; a deteção pela cadência fica no domínio (`scanKey`), testada.
- **Nota de crédito**: qualquer funcionário a prepara; só o PIN de um gestor a emite.
- Acesso: `/pos` exige `sales.invoicing` (`access-ui.service.ts`); sem acesso carregado, só admin.

## Como testar
- `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/pos`
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit`

## Pontos de atenção / dívidas conhecidas
- O aviso de stock usa a última leitura dos produtos (outro terminal pode ter vendido entretanto); o alerta no servidor é sempre registado.
- Fotos vêm do Vendus (`vendus.pt/foto/…_xs.png`); sem foto, o ícone da categoria.
- Impressão pelo browser (`window.print`) — impressora térmica ESC/POS direta fica para depois.
