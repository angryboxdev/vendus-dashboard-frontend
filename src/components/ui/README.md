# components/ui — identidade visual do Mezza ERP

> Status: active (partilhado por todos os módulos)

Componentes e classes visuais comuns. **Todas as páginas novas usam isto**;
não criar estilos próprios por módulo. Melhorias aqui valem para todo o ERP.

## Decisões (2026-10-08)

- **Botão principal:** gradiente laranja `#ED5C32 → #EF8935` (um por zona de ação).
- **Bordas:** creme `#F5C992` a 40 % em cartões, tabelas, painéis e cabeçalho.
- **Neutros:** só `stone` (cinzas quentes). Fundo das páginas `#FAF6F3`; hover `#FDF8F5`.
- **Ícones:** ícones novos vêm do **Lucide** (`lucide-react` 1.52.0, versão exata; ISC/MIT — `THIRD_PARTY_NOTICES.md`), sempre através de `app-icons.tsx` (`AppIcon`/`APP_ICONS`, chaves por uso) e nunca importados diretamente: 20 px por omissão (18–22), traço 1.75, `currentColor`, decorativos (`aria-hidden`). Os SVG de `icons.tsx` continuam válidos (mesmo estilo); não se substituem em massa. Decisão de 2026-10-18 (revoga «sem biblioteca externa» de 2026-10-08), aprovada pelo utilizador depois de uma versão de teste. Nada de emojis como ícones.
- **Movimento:** reutiliza `components/motion` (180–220 ms, opacity/transform, respeita movimento reduzido).
- Estados: verde = aprovado/ativo, âmbar = pendente/atenção, vermelho = erro, cinza = neutro/cancelado.

## O que há

| Peça | Uso |
|---|---|
| `SlideSwitch` | Interruptor deslizante entre opções de igual largura (variante do prato, regras de entrada no Stock); setas ← →; `itemWidthClass` para a largura. |
| `PageShell` | Faixa branca: título, descrição curta, ação principal, tabs; conteúdo sobre off-white. |
| `Button` / `buttonClass` | `primary` (gradiente), `secondary` (borda), `tertiary` (texto), `danger`. |
| `Tabs` / `TabNav` | Sublinhado laranja; por estado ou por rota. Contador opcional. |
| `StatusBadge` | Estado com tom + ponto. Não usar para texto normal. |
| `AlertBanner` | Alerta de página — só quando há algo a tratar. |
| `Drawer` | Painel lateral: cabeçalho fixo, scroll único, rodapé fixo; Esc fecha. |
| `ui-classes.ts` | `SURFACE`, `FIELD`, `LABEL`, `TABLE`/`THEAD`/`TH`/`TD`/`TR`… para elementos nativos. |
| `app-icons.tsx` | `AppIcon name="…"` e `APP_ICONS` — catálogo Lucide por chave (sidebar, separadores e ações do RH). |
| `icons.tsx` | `IconPlus`, `IconClose`, `IconCheck`, `IconAlert`, `IconInfo`, `IconCalendar`, `IconClock`, `IconUsers`, `IconDownload`, `IconSearch`, `IconChevron*`, `IconHistory`, `IconBell`. |

## Onde já está aplicado

RH → Colaboradores (Lista, Cargos, Documentos) e Férias & Ausências
(Calendário, Registos, Saldos, Registar ausência, detalhe). O resto do ERP
migra aos poucos, quando cada ecrã for mexido.

## Como testar

`npx vitest run src/components/ui`
