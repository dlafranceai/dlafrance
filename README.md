# D'La France — Loja de perfumes (Frontend + API opcional)

Projeto focado em venda por WhatsApp, com carrinho persistente, catálogo completo e API pronta para subir no Render.

## O que está pronto

- Carrinho robusto (persistência, validação, atualização de quantidade e fallback sem travar).
- Checkout com redirecionamento para WhatsApp corrigido e funcionando em todo o site.
- Catálogo com filtros, busca e página de produto com lógica de estoque e simulação de frete.
- Configuração de runtime sem build (`assets/js/runtime-config.js`) para alternar entre modo estático e backend.
- Backend Node/Express em `backend/` para Render.
- Arquivos de deploy incluídos:
  - `vercel.json` (frontend)
  - `render.yaml` (backend)

## Estrutura

- Frontend estático: HTML + CSS + JS em `assets/`.
- Configuração de ambiente do front: `assets/js/runtime-config.js`.
- API: `backend/server.js`.

## Configuração do WhatsApp

Edite `assets/js/runtime-config.js`:

```js
window.DLF_RUNTIME = {
  whatsappNumber: "5534XXXXXXXX",
  useBackend: false,
  apiBaseUrl: ""
};
```

Formato do número: **DDI + DDD + número**, só dígitos (sem `+`, espaço ou traço).

## Rodar localmente

### 1) Frontend

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`.

### 2) Backend (opcional)

```bash
cd backend
npm install
npm run dev
```

API em `http://localhost:10000`.

Para usar backend local, ajuste `assets/js/runtime-config.js`:

```js
window.DLF_RUNTIME = {
  whatsappNumber: "5534XXXXXXXX",
  useBackend: true,
  apiBaseUrl: "http://localhost:10000"
};
```

## Deploy (GitHub + Vercel + Render)

### 1) Subir no GitHub

```bash
git init
git add .
git commit -m "refactor: frontend + api + deploy configs"
git branch -M main
git remote add origin <SUA_URL_GITHUB>
git push -u origin main
```

### 2) Frontend no Vercel

- Importar o repositório no Vercel.
- Framework preset: **Other**.
- Root Directory: `/`.
- Build command: vazio.
- Output directory: vazio.

### 3) Backend no Render

- Criar serviço Web no Render apontando para o mesmo repositório.
- Root directory: `backend`.
- Build command: `npm install`.
- Start command: `npm start`.
- Health check path: `/health`.
- Pode usar `render.yaml` para blueprint automático.

### 4) Conectar Front + Back

Depois do backend no ar (ex.: `https://dlf-api.onrender.com`), atualize o front:

```js
window.DLF_RUNTIME = {
  whatsappNumber: "5534XXXXXXXX",
  useBackend: true,
  apiBaseUrl: "https://dlf-api.onrender.com"
};
```

No Render, configure `CORS_ORIGIN` com o domínio do Vercel:

```txt
https://SEU-PROJETO.vercel.app
```

## Endpoints da API

- `GET /health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/shipping?cep=00000000&subtotal=149.9`
