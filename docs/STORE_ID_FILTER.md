# Filtro por loja (store_id) – Implementação futura

Quando houver mais de uma loja, pode ser útil filtrar o autoconsumo Vendus por loja.

## API

Ambas as rotas aceitam o parâmetro opcional `store_id` (número):

| Rota | Parâmetro | Descrição |
|------|-----------|-----------|
| `GET /api/reports/monthly-summary` | `store_id` | Filtra autoconsumo por loja. Documentos de venda continuam globais. |
| `GET /api/reports/ingredient-consumption` | `store_id` | Filtra autoconsumo Vendus por loja. |

## Implementação sugerida no frontend

### Dashboard (DashboardStoreContext + HeaderFilters)

1. **DashboardStoreContext**
   - Estado: `storeId: string`
   - Na construção do URL: `if (storeId.trim()) params.store_id = storeId.trim();`
   - Expor `storeId`, `setStoreId` no contexto

2. **HeaderFilters**
   - Campo input/select: "Loja (autoconsumo)" com placeholder "Todas"
   - `onChange`: passar `storeId` ao estado

3. **DashboardPage**
   - Consumir `storeId`, `setStoreId` do contexto
   - Passar a `HeaderFilters` e incluir em `onChange`

### Movimentações (MovimentacoesPage)

1. **buildConsumptionUrl**
   - Parâmetro opcional: `storeId?: string`
   - `if (storeId?.trim()) params.set("store_id", storeId.trim());`

2. **Estado**
   - `const [storeId, setStoreId] = useState<string>("");`

3. **UI**
   - Input "Loja (autoconsumo)" junto aos filtros De/Até, Tipo, Categoria

4. **URL**
   - Incluir `storeId` em `buildConsumptionUrl(since, until, storeId)`

## Alinhamento

Para manter o autoconsumo consistente entre Dashboard e Movimentações, usar o mesmo `store_id` nas duas rotas quando o utilizador selecionar uma loja. Considerar partilhar o estado via contexto global ou URL params se fizer sentido.
