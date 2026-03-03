# Deploy no Vercel

## Pré-requisitos

1. Conta no [Vercel](https://vercel.com) (gratuita)
2. Repositório no GitHub com o código

## Passos

### Opção A: Deploy via GitHub (recomendado)

1. Acede a [vercel.com](https://vercel.com) e faz login
2. Clica em **Add New** → **Project**
3. Importa o repositório do GitHub (autoriza o Vercel se necessário)
4. Na configuração do projeto:
   - **Root Directory**: `vendus-dashboard-frontend` (se o repo tiver backend e frontend na raiz)
   - **Framework Preset**: Vite (detetado automaticamente)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables** (opcional — já está em `.env.production`):
   - `VITE_API_URL` = `https://vendus-dashboard-backend.onrender.com`
   - Só precisa de adicionar se quiseres override no painel
6. Clica em **Deploy**

### Opção B: Deploy via CLI

```bash
cd vendus-dashboard-frontend
npx vercel
```

Segue as instruções no terminal. Para deploy de produção:

```bash
npx vercel --prod
```

## Backend

O frontend está configurado para usar o backend em:

**https://vendus-dashboard-backend.onrender.com**

Verifica que o backend tem CORS configurado para aceitar o domínio do Vercel (ex.: `https://teu-projeto.vercel.app`).

## Desenvolvimento local

Em desenvolvimento, o Vite usa proxy para `/api` → `localhost:3333`. Não é necessário definir `VITE_API_URL`.
